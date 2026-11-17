// The Ukrainian version: URLs, translated content and the catalog filter.
import { expect, test } from '@playwright/test';

test('the language switcher moves between translations of the same page', async ({ page }) => {
  await page.goto('/products/green-glow-smoothie');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  await page.getByRole('navigation', { name: 'Language' }).getByRole('link', { name: 'УКР' }).click();
  await expect(page).toHaveURL(/\/uk\/products\/smuzi-zelene-syayvo$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Смузі «Зелене сяйво»');
  // Decimal comma and the euro sign after the number.
  await expect(page.locator('.product__price')).toHaveText(/^3,90\s€$/);

  const switcher = page.getByRole('navigation', { name: 'Мова' });
  await expect(switcher.getByRole('link', { name: 'УКР' })).toHaveAttribute('aria-current', 'true');
  await switcher.getByRole('link', { name: 'ENG' }).click();
  await expect(page).toHaveURL(/\/products\/green-glow-smoothie$/);
});

test('translated pages point to each other with hreflang', async ({ page }) => {
  await page.goto('/uk/products/smuzi-zelene-syayvo');
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    'href',
    /\/products\/green-glow-smoothie$/,
  );
  await expect(page.locator('link[rel="alternate"][hreflang="uk"]')).toHaveAttribute(
    'href',
    /\/uk\/products\/smuzi-zelene-syayvo$/,
  );
});

test('home page in Ukrainian', async ({ page }) => {
  await page.goto('/uk');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Свіжа їжа, від якої добре');
  await expect(page.getByRole('heading', { name: 'Рекомендовані продукти' })).toBeVisible();
  await expect(page.locator('.teaser-grid').first().locator('.card')).toHaveCount(4);
});

test('the catalog filter searches Ukrainian titles and keeps the language in links', async ({ page }) => {
  await page.goto('/uk/products');
  const status = page.getByRole('status');
  await expect(status).toHaveText('Знайдено 14 продуктів');

  await page.getByLabel('Пошук за назвою').fill('боул');
  // Ukrainian has three plural forms: 1 продукт, 3 продукти, 14 продуктів.
  await expect(status).toHaveText('Знайдено 3 продукти');
  const links = page.locator('.catalog-filter__results .card__link');
  await expect(links).toHaveCount(3);
  for (const href of await links.evaluateAll((elements) => elements.map((a) => a.getAttribute('href')))) {
    expect(href).toMatch(/^\/uk\/products\//);
  }
});
