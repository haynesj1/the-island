import { expect, test } from '@playwright/test';

test('choose today\'s session, open it, and save it for offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Today's session" })).toBeVisible();
  await page.getByRole('link', { name: "Open today's session" }).click();

  await expect(page).toHaveURL(/\/sessions\/placeholder\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Placeholder');
  await expect(page.getByRole('button', { name: 'Eyes open' })).toBeVisible();

  // The transcript is collapsed until the listener opens it.
  const details = page.locator('details.transcript');
  await expect(details).not.toHaveAttribute('open', '');
  await expect(page.getByText('Welcome. You might keep your eyes open')).toBeHidden();
  await page.getByText('Transcript', { exact: true }).click();
  await expect(page.getByText('Welcome. You might keep your eyes open')).toBeVisible();
  await expect(page.getByText('[PAUSE')).toHaveCount(0);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
  await page.getByRole('button', { name: 'Save for offline' }).click();
  await expect(page.getByRole('button', { name: 'Saved for offline' })).toBeVisible();
  const cached = await page.evaluate(async () => !!(await caches.match('/audio/placeholder.wav')));
  expect(cached).toBe(true);

  // Offline, the saved page and its audio still load (audio is fetched with a byte range).
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Placeholder');
  const status = await page.evaluate(async () => {
    const r = await fetch('/audio/placeholder.wav', { headers: { Range: 'bytes=0-99' } });
    return [r.status, (await r.arrayBuffer()).byteLength];
  });
  expect(status).toEqual([206, 100]);
  await context.setOffline(false);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
