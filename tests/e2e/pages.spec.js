// Page structure, SEO data and images on the main page types.
import { expect, test } from '@playwright/test';

const pages = [
  ['home', '/'],
  ['catalog', '/products'],
  ['product', '/products/green-glow-smoothie'],
  ['article', '/articles/green-shakshuka-20-minutes'],
];

for (const [name, path] of pages) {
  test(`${name} page has one h1, a language and a meta description`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{20,}/);
  });
}

test('home page hero holds the h1 and links to the catalog', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fresh food that feels good');
  await page.getByRole('link', { name: 'Browse products' }).click();
  await expect(page).toHaveURL(/\/products$/);
});

test('product page has Product structured data', async ({ page }) => {
  await page.goto('/products/green-glow-smoothie');
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const data = JSON.parse(json);
  expect(data['@type']).toBe('Product');
  expect(data.name).toBe('Green Glow Smoothie');
  expect(data.offers).toMatchObject({ price: '3.90', priceCurrency: 'EUR' });
});

test('product image is responsive WebP and loads with high priority', async ({ page }) => {
  await page.goto('/products/green-glow-smoothie');
  const image = page.locator('.product__media img');
  await expect(image).toHaveAttribute('srcset', /\.webp/);
  await expect(image).toHaveAttribute('fetchpriority', 'high');
  await expect(image).toHaveAttribute('loading', 'eager');
  // The browser really decoded the image (it is not broken).
  expect(await image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
});
