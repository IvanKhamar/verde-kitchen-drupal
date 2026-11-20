// The contact form (module verde_leads).
// The flood limit is raised for these tests (scripts/ci/install-test.sh), and
// checked by a PHPUnit test instead: all browsers here share one IP address.
import { expect, test } from '@playwright/test';

/** Fills the form with valid values; `overrides` changes single fields. */
async function fillValid(page, overrides = {}) {
  const values = {
    Name: 'Olena Test',
    Email: 'olena@example.com',
    Message: 'Do you deliver to Lviv? We run a small cafe.',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await page.getByLabel(/I agree that Verde Kitchen processes my data/).check();
}

test('an empty form lists every error, linked to its field, and focuses the summary', async ({ page }) => {
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Send message' }).click();

  const summary = page.getByRole('region', { name: 'Error message' });
  await expect(summary).toBeFocused();
  for (const field of ['Name', 'Email', 'Message']) {
    await expect(summary.getByRole('link', { name: field, exact: true })).toBeVisible();
  }

  // Each control points to its error message.
  const name = page.getByLabel('Name', { exact: true });
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  const errorId = (await name.getAttribute('aria-describedby')).split(' ')[0];
  await expect(page.locator(`#${errorId}`)).toContainText('Name field is required.');

  // The summary link moves to the field.
  await summary.getByRole('link', { name: 'Email', exact: true }).click();
  await expect(page).toHaveURL(/#edit-email$/);
});

test('checks the email format, the message length and the consent', async ({ page }) => {
  await page.goto('/contact');
  await fillValid(page, { Email: 'olena@', Message: 'Too short' });
  await page.getByLabel(/I agree that Verde Kitchen processes my data/).uncheck();
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('The email address olena@ is not valid.')).toBeVisible();
  await expect(page.getByText('Your message must be from 10 to 2000 characters long.')).toBeVisible();
  await expect(page.getByText('Please agree to the processing of your data, so we can answer you.')).toBeVisible();
  // What the visitor typed is kept.
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Olena Test');
});

test('a valid message shows the thank-you message, focused, on a clean form', async ({ page }) => {
  await page.goto('/contact');
  await fillValid(page);
  await page.getByRole('button', { name: 'Send message' }).click();

  const status = page.getByRole('region', { name: 'Status message' });
  await expect(status).toBeFocused();
  await expect(status).toContainText('Thank you! We have your message');
  // Post/Redirect/Get: a fresh, empty form.
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
});

test('the honeypot field is hidden from people and keyboard users', async ({ page }) => {
  await page.goto('/contact');
  const trap = page.locator('.contact-form__trap');
  await expect(trap).toHaveAttribute('aria-hidden', 'true');
  await expect(trap.locator('input')).toHaveAttribute('tabindex', '-1');
  // Off-screen, not display: none.
  const box = await trap.boundingBox();
  expect(box === null || box.x + box.width <= 0).toBe(true);
});

test('a bot that fills the honeypot sees the usual thank-you message', async ({ page }) => {
  await page.goto('/contact');
  await fillValid(page);
  await page.locator('.contact-form__trap input').fill('https://spam.example.com', { force: true });
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('region', { name: 'Status message' })).toContainText('Thank you!');
});

test('the form is in Ukrainian on /uk/contact, with the Privacy link in Ukrainian', async ({ page }) => {
  await page.goto('/uk/contact');
  await expect(page.getByRole('heading', { level: 1, name: 'Контакти' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'політика приватності' })).toHaveAttribute('href', '/uk/pryvatnist');
  await page.getByRole('button', { name: 'Надіслати' }).click();
  await expect(page.getByRole('region', { name: 'Повідомлення про помилку' })).toBeFocused();
  await expect(page.getByText('Погодьтеся, будь ласка, на обробку даних')).toBeVisible();
});

test('the contact page is linked from the main menu and sent with a strict CSP', async ({ page }) => {
  const response = await page.goto('/');
  // On phones the menu is collapsed, so check the link instead of clicking it.
  await expect(page.locator('nav.navigation a[href="/contact"]')).toHaveText('Contact');
  await page.goto('/contact');
  await expect(page).toHaveURL(/\/contact$/);

  const contact = await page.request.get('/contact');
  const csp = contact.headers()['content-security-policy'];
  // default-src 'self' also covers scripts; no 'unsafe-inline' anywhere.
  expect(csp).toContain("default-src 'self'");
  expect(csp).not.toContain("'unsafe-inline'");
  expect(response.ok()).toBe(true);
  // No inline scripts: every <script> has a src, or is a JSON data block.
  const inline = await page
    .locator('script:not([src]):not([type="application/json"]):not([type="application/ld+json"])')
    .count();
  expect(inline).toBe(0);
});

test('the list of contact messages is closed to anonymous visitors', async ({ request }) => {
  for (const path of ['/admin/content/contact-messages', '/admin/content/contact-messages/1']) {
    expect((await request.get(path)).status()).toBe(403);
  }
});
