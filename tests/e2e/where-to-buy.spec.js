// "Where to buy" on product pages.
import { expect, test } from '@playwright/test';

test('lists online shops as external links and store chains with cities', async ({ page }) => {
  await page.goto('/products/green-glow-smoothie');
  const block = page.getByRole('region', { name: 'Where to buy' });
  await expect(block).toBeVisible();

  // The hidden hint is part of the link's accessible name.
  const shop = block.getByRole('link', { name: 'Buy at GreenBasket (external site)' });
  await expect(shop).toHaveAttribute('href', 'https://www.example.com/greenbasket');
  await expect(shop).toHaveAttribute('rel', /external/);
  // Same tab: no target="_blank".
  await expect(shop).not.toHaveAttribute('target', /.*/);

  await expect(block.getByRole('heading', { name: 'In stores' })).toBeVisible();
  await expect(block.getByText('FreshCorner')).toBeVisible();
  await expect(block.getByText('Lviv, Kyiv, Kharkiv')).toBeVisible();
});

test('says so when no shop sells the product', async ({ page }) => {
  await page.goto('/products/spelt-banana-loaf');
  const block = page.getByRole('region', { name: 'Where to buy' });
  await expect(block.getByText('Not in shops yet. Check back soon.')).toBeVisible();
  await expect(block.getByRole('link')).toHaveCount(0);
});

test('is translated on Ukrainian pages, with translated city names', async ({ page }) => {
  await page.goto('/uk/products/smuzi-zelene-syayvo');
  const block = page.getByRole('region', { name: 'Де купити' });
  await expect(block.getByRole('link', { name: 'Купити в GreenBasket (зовнішній сайт)' })).toBeVisible();
  await expect(block.getByText('Львів, Київ, Харків')).toBeVisible();
  // Dietary tags and the category of the product are in Ukrainian too.
  await expect(page.locator('.product__badges')).toContainText('Веганське');
  await expect(page.locator('.product__category')).toHaveText('Напої');
});
