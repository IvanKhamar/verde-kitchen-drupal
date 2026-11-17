// The React catalog filter on /products.
import { expect, test } from '@playwright/test';

const status = (page) => page.getByRole('status');
const liveCards = (page) => page.locator('.catalog-filter__results .card');

test.describe('Catalog filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
    // The widget has loaded its data when the status shows the count.
    await expect(status(page)).toHaveText('14 products found');
  });

  test('keeps the server-rendered list until a filter is used', async ({ page }) => {
    await expect(page.locator('#catalog-fallback')).toBeVisible();
    await expect(page.locator('#catalog-fallback .card')).toHaveCount(14);
    await expect(liveCards(page)).toHaveCount(0);
  });

  test('searches by name', async ({ page }) => {
    await page.getByLabel('Search by name').fill('bowl');
    await expect(status(page)).toHaveText('3 products found');
    await expect(liveCards(page)).toHaveCount(3);
    await expect(page.locator('#catalog-fallback')).toBeHidden();
    for (const title of await liveCards(page).locator('.card__title').allTextContents()) {
      expect(title).toMatch(/bowl/i);
    }
  });

  test('requires every selected dietary tag', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Vegan' }).check();
    await expect(status(page)).toHaveText('11 products found');
    await page.getByRole('checkbox', { name: 'Gluten-free' }).check();
    await expect(status(page)).toHaveText('9 products found');
  });

  test('filters by category', async ({ page }) => {
    await page.getByLabel('Category').selectOption({ label: 'Drinks' });
    await expect(status(page)).toHaveText('4 products found');
  });

  test('shows an empty state, and "Clear filters" resets and focuses the search', async ({ page }) => {
    await page.getByLabel('Search by name').fill('bowl');
    await expect(status(page)).toHaveText('3 products found');
    await page.getByRole('checkbox', { name: 'No added sugar' }).check();
    await expect(page.getByText('No products match your filters.')).toBeVisible();
    await expect(status(page)).toHaveText('0 products found');

    await page.locator('.catalog-filter__empty').getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByLabel('Search by name')).toBeFocused();
    await expect(page.getByLabel('Search by name')).toHaveValue('');
    await expect(status(page)).toHaveText('14 products found');
    await expect(page.locator('#catalog-fallback')).toBeVisible();
  });

  test('reports an API error and recovers with "Try again"', async ({ page }) => {
    // Every products request now fails, like a lost connection.
    await page.route('**/jsonapi/node/product?**', (route) => route.abort());
    await page.getByLabel('Category').selectOption({ label: 'Drinks' });
    await expect(status(page)).toHaveText('Products could not be loaded.');

    await page.unroute('**/jsonapi/node/product?**');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(status(page)).toHaveText('4 products found');
    await expect(liveCards(page)).toHaveCount(4);
  });
});

test.describe('Catalog without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows every product, without the filter form', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('.card')).toHaveCount(14);
    await expect(page.getByLabel('Search by name')).toHaveCount(0);
  });
});
