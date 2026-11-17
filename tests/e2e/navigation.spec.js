// Navigation: skip link and the main menu on small and wide screens.
import { expect, test } from '@playwright/test';

test.describe('Skip link', () => {
  test('moves focus to the main content', async ({ page }) => {
    await page.goto('/');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    // focus() instead of Tab: Safari does not move focus to links with Tab by default.
    await skipLink.focus();
    await expect(skipLink).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });
});

test.describe('Main menu on a phone', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('opens with the keyboard and closes with Escape', async ({ page }) => {
    await page.goto('/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    const productsLink = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Products' });

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(productsLink).toBeHidden();

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(productsLink).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    await expect(productsLink).toBeHidden();
  });

  test('leads to the catalog', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Products' }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Products');
  });
});

test.describe('Main menu on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('shows the links without a menu button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Products' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });
});
