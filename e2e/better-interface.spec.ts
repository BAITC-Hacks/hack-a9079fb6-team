import { test, expect } from '@playwright/test';

test('empty outcome, explicit suggestion action and recovery preserve the request', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Никто не подходит/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('нет совпадений');
  const sent = page.waitForRequest(r => r.url().endsWith('/api/match'));
  await page.getByRole('button', { name: 'Бюджет 3 000 000 ₸', exact: true }).click();
  expect((await sent).postDataJSON()).toMatchObject({ budget: 3000000, date: '2026-12-26', city: 'Алматы', category: 'Банкетный зал', eventType: 'той' });
  await expect(page.getByTestId('match-card')).toHaveCount(1);
  await page.getByRole('button', { name: /^Категории нет в городе/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('В городе нет');
  await expect(page.getByTestId('match-card')).toHaveCount(0);
});

test('network failure is localized, retry is visible and restores results', async ({ page }) => {
  await page.goto('/');
  await page.route('**/api/match', route => route.abort('failed'));
  await page.getByRole('button', { name: /^Популярная категория/ }).click();
  await expect(page.locator('.step-error')).toContainText('Проверьте соединение');
  await expect(page.locator('.step-error')).not.toContainText('Failed to fetch');
  await page.unroute('**/api/match');
  await page.getByRole('button', { name: 'Повторить подбор', exact: true }).click();
  await expect(page.getByTestId('match-card')).toHaveCount(3);
});

test('results show shared criteria once and expandable profile facts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: /^Популярная категория/ }).click();
  await expect(page.locator('.request-summary')).toContainText('1 000 000');
  await expect(page.locator('.layout-results')).toBeVisible();
  await expect(page.locator('#assistant')).toHaveCount(0);
  const card = page.getByTestId('match-card').first();
  await expect(card).not.toContainText('Условия: 5 из 5');
  await card.getByText('Все условия профиля', { exact: true }).click();
  await expect(card.getByText('На 2026-10-15 занятость не отмечена', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
