import { test, expect } from '@playwright/test';
test('three demo journeys, deterministic repeat and two dates', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /^Популярная категория/ }).click();
  await expect(page.getByTestId('match-results').getByTestId('match-card')).toHaveCount(3);
  const first = await page.getByTestId('match-results').getByTestId('match-card').allTextContents();
  await page.getByRole('button', { name: 'Подобрать подрядчиков', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Подобрать подрядчиков', exact: true })).toBeEnabled();
  expect(await page.getByTestId('match-results').getByTestId('match-card').allTextContents()).toEqual(first);
  await page.getByRole('button', { name: /^Редкая категория/ }).click();
  await expect(page.getByTestId('match-results').getByTestId('match-card')).toHaveCount(2);
  await page.getByRole('button', { name: /^Никто не подходит/ }).click();
  await expect(page.getByTestId('match-results').getByTestId('match-card')).toHaveCount(0);
  await expect(page.getByTestId('match-results')).toContainText(/занят|бюджет|услови/i);
  await page.getByRole('button', { name: /^Популярная категория/ }).click();
  await expect(page.getByTestId('match-results').getByTestId('match-card')).toHaveCount(3);
  await page.getByLabel('Сравнить две даты', { exact: true }).check();
  await page.getByLabel('Вторая дата', { exact: true }).fill('2026-12-19');
  await page.getByRole('button', { name: /Сравнить|Подобрать подрядчиков/, exact: false }).last().click();
  await expect(page.getByTestId('compare-first').getByTestId('match-card')).toHaveCount(3);
  await expect(page.getByTestId('compare-second').getByTestId('match-card')).toHaveCount(1);
  await expect(page.getByText(/занят/).first()).toBeVisible();
});
test('responsive form and empty category state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Выбрать формат', exact: true })).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const response=await page.request.post('/api/match',{data:{city:'Астана',date:'2026-10-15',eventType:'свадьба',category:'Декоратор',budget:2000000}});
  expect(response.ok()).toBeTruthy();expect((await response.json()).outcome).toBe('no_category_in_city');
});
test('HTTP API meets latency target after app starts',async({request})=>{
 const started=Date.now();
 const response=await request.post('/api/match',{data:{city:'Алматы',date:'2026-10-15',eventType:'свадьба',category:'Ведущий',budget:1000000}});
 expect(response.status()).toBe(200);expect((await response.json()).cards).toHaveLength(3);
 expect(Date.now()-started).toBeLessThan(10000);
});
