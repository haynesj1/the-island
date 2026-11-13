import { expect, test } from '@playwright/test';

test('home page says what this is and isn\'t, without sideways scroll', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'The Island' })).toBeVisible();
  await expect(page.getByText('Short guided escapes to a calm island. Relaxation practice, not therapy.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Session player' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('manifest is served and a service worker registers', async ({ page, request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);
  await page.goto('/');
  const ready = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return !!reg.active;
  });
  expect(ready).toBe(true);
});

test('home page reloads offline with styles and player intact', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the worker
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'The Island' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Session player' })).toBeVisible();
  const sheets = await page.evaluate(() => document.styleSheets.length);
  expect(sheets).toBeGreaterThan(0);
  await context.setOffline(false);
});
