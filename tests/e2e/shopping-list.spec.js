// The shopping list: "Add to list" buttons, the header counter and the list page.
// Every test starts in a fresh browser context, so the list starts empty.
import { expect, test } from '@playwright/test';

/** The header link; its accessible name says how many items the list has. */
const headerLink = (page) => page.locator('[data-shopping-list-link]');

/**
 * A button name like "Add to list: Almond Date Bar". The product name is in a
 * visually hidden span, and browsers may put a space before its colon.
 */
const label = (action, product) => new RegExp(`^${action} ?: ${product}$`);

test('adds a product from its page, counts it in the header and keeps it after a reload', async ({ page }) => {
  await page.goto('/products/almond-date-bar');
  await expect(headerLink(page)).toHaveAttribute('aria-label', 'Shopping list, empty');

  await page.getByRole('button', { name: label('Add to list', 'Almond Date Bar') }).click();
  await expect(page.getByRole('button', { name: label('Remove from list', 'Almond Date Bar') })).toBeVisible();
  await expect(headerLink(page)).toHaveAttribute('aria-label', 'Shopping list, 1 item');
  await expect(page.locator('[data-shopping-list-count]')).toHaveText('1');

  await page.reload();
  await expect(page.getByRole('button', { name: label('Remove from list', 'Almond Date Bar') })).toBeVisible();
  await expect(headerLink(page)).toHaveAttribute('aria-label', 'Shopping list, 1 item');
});

test('adds products from the React catalog cards', async ({ page }) => {
  await page.goto('/products');
  await page.getByRole('button', { name: label('Add to list', 'Berry Kombucha') }).click();
  await page.getByRole('button', { name: label('Add to list', 'Green Glow Smoothie') }).click();
  await expect(headerLink(page)).toHaveAttribute('aria-label', 'Shopping list, 2 items');

  // Removing from the card works the same way.
  await page.getByRole('button', { name: label('Remove from list', 'Berry Kombucha') }).click();
  await expect(headerLink(page)).toHaveAttribute('aria-label', 'Shopping list, 1 item');
});

test('changes quantities, updates the totals and removes products on the list page', async ({ page }) => {
  await page.goto('/products/almond-date-bar');
  await page.getByRole('button', { name: label('Add to list', 'Almond Date Bar') }).click();
  await headerLink(page).click();

  await expect(page).toHaveURL(/\/shopping-list$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Shopping list' })).toBeVisible();
  const item = page.getByRole('listitem').filter({ hasText: 'Almond Date Bar' });
  await expect(item.getByRole('link', { name: 'Almond Date Bar' })).toHaveAttribute('href', /almond-date-bar$/);

  const quantity = item.getByRole('group', { name: 'Quantity of Almond Date Bar' });
  // One is the minimum: "One less" is disabled.
  await expect(quantity.getByRole('button', { name: 'One less' })).toHaveAttribute('aria-disabled', 'true');
  // Keyboard: Enter on the limit does nothing, and the button keeps focus.
  await quantity.getByRole('button', { name: 'One less' }).press('Enter');
  await expect(quantity.getByRole('button', { name: 'One less' })).toBeFocused();
  await expect(quantity).toContainText('1');
  await quantity.getByRole('button', { name: 'One more' }).click();
  await expect(quantity).toContainText('2');
  await expect(item).toContainText('€3.80');
  await expect(page.getByText('Estimated total: €3.80')).toBeVisible();
  // The header counts items, not products.
  await expect(headerLink(page)).toHaveAttribute('aria-label', 'Shopping list, 2 items');

  await item.getByRole('button', { name: label('Remove', 'Almond Date Bar') }).click();
  await expect(page.getByText('Your shopping list is empty.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse products' })).toBeVisible();
  await expect(headerLink(page)).toHaveAttribute('aria-label', 'Shopping list, empty');
});

test('asks before clearing the list, and Cancel keeps it', async ({ page }) => {
  await page.goto('/products');
  await page.getByRole('button', { name: label('Add to list', 'Berry Kombucha') }).click();
  await page.getByRole('button', { name: label('Add to list', 'Almond Date Bar') }).click();
  await page.goto('/shopping-list');
  await expect(page.getByRole('listitem').filter({ hasText: 'Berry Kombucha' })).toBeVisible();

  const clear = page.getByRole('button', { name: 'Clear list' });
  await clear.click();
  const confirm = page.getByRole('group', { name: 'Clear the list?' });
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  // Focus goes back to the button that opened the question.
  await expect(clear).toBeFocused();
  await expect(page.getByRole('listitem').filter({ hasText: 'Almond Date Bar' })).toBeVisible();

  await clear.click();
  await confirm.getByRole('button', { name: 'Yes, clear' }).click();
  await expect(page.getByText('Your shopping list is empty.')).toBeVisible();
  await expect(headerLink(page)).toHaveAttribute('aria-label', 'Shopping list, empty');
});

test('shows the empty state to a first-time visitor', async ({ page }) => {
  await page.goto('/shopping-list');
  await expect(page.getByText('Your shopping list is empty.')).toBeVisible();
  await page.getByRole('link', { name: 'Browse products' }).click();
  await expect(page).toHaveURL(/\/products$/);
});

test('works in Ukrainian, with Ukrainian product names and prices', async ({ page }) => {
  await page.goto('/uk/products');
  await page.getByRole('button', { name: label('До списку', 'Батончик з мигдалем і фініками') }).click();
  await expect(headerLink(page)).toHaveAttribute('aria-label', 'Список покупок, 1 позиція');

  await headerLink(page).click();
  await expect(page).toHaveURL(/\/uk\/shopping-list$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Список покупок' })).toBeVisible();
  const item = page.getByRole('listitem').filter({ hasText: 'Батончик з мигдалем і фініками' });
  await expect(item.getByRole('link')).toHaveAttribute('href', /^\/uk\//);
  await expect(item).toContainText('1,90 €');
});
