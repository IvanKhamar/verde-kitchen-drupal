// Security regression tests: headers, read-only API, closed registration and
// output escaping in the React widget.
import { expect, test } from '@playwright/test';

test('pages are sent with security headers', async ({ request }) => {
  const headers = (await request.get('/products')).headers();
  const csp = headers['content-security-policy'];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  // Visitors get a policy without inline code: no 'unsafe-inline', no 'unsafe-eval'.
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
});

test('JSON:API is read-only', async ({ request }) => {
  const response = await request.post('/jsonapi/node/product', {
    headers: { 'Content-Type': 'application/vnd.api+json' },
    data: { data: { type: 'node--product', attributes: { title: 'Created through the API' } } },
  });
  expect([403, 405]).toContain(response.status());
});

test('visitors cannot create accounts', async ({ request }) => {
  expect((await request.get('/user/register')).status()).toBe(403);
});

test('the React widget shows HTML from the API as text and runs no script', async ({ page }) => {
  // Put markup into the first product title the API returns, as an attacker
  // who could edit a product might try.
  const payload = '<img src="x" onerror="window.__xss = true">Bowl';
  await page.route('**/jsonapi/node/product?**', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    if (json.data.length > 0) json.data[0].attributes.title = payload;
    await route.fulfill({ response, json });
  });

  await page.goto('/products');
  await page.getByLabel('Search by name').fill('bowl');
  const firstTitle = page.locator('.catalog-filter__results .card__title').first();
  await expect(firstTitle).toHaveText(payload);
  await expect(page.locator('.catalog-filter__results img[src="x"]')).toHaveCount(0);
  // The callback runs in the browser, where globalThis is the window.
  expect(await page.evaluate(() => globalThis.__xss)).toBeUndefined();
});
