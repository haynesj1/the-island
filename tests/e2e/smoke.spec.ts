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
  // Wait for the worker to control this first page, with no online reload: anything the
  // page loaded before that point reached the cache only if it was precached at install.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  const missing = await page.evaluate(async () => {
    const built = performance
      .getEntriesByType('resource')
      .map((e) => new URL(e.name).pathname)
      .filter((p) => p.startsWith('/_astro/'));
    const absent: string[] = [];
    for (const p of built) if (!(await caches.match(p))) absent.push(p);
    return { count: built.length, absent };
  });
  expect(missing.count).toBeGreaterThan(0);
  expect(missing.absent).toEqual([]);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'The Island' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Session player' })).toBeVisible();
  const sheets = await page.evaluate(() => document.styleSheets.length);
  expect(sheets).toBeGreaterThan(0);
  await context.setOffline(false);
});
