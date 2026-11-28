import { expect, test } from '@playwright/test';

/** Silent audio: silent 8 kHz mono 8-bit PCM WAV (length set by the argument), served in place of real session audio. */
function silentWav(seconds: number): Buffer {
  const rate = 8000;
  const n = rate * seconds;
  const b = Buffer.alloc(44 + n, 0x80);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34);
  b.write('data', 36); b.writeUInt32LE(n, 40);
  return b;
}

test('asks eyes open or closed, then plays, pauses and resumes', async ({ page }) => {
  await page.route('**/fixture-silence.wav', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav(60) }),
  );
  await page.goto('/player-check/');
  await expect(page.getByText('eyes open or closed')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Eyes open' })).toBeVisible();
  await page.getByRole('button', { name: 'Eyes closed' }).click();

  const pause = page.getByRole('button', { name: 'Pause' });
  await expect(pause).toBeVisible({ timeout: 2000 });
  await expect(page.getByRole('status')).toContainText('Eyes closed · Playing');

  await pause.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status')).toContainText('Paused');
  const t1 = await page.evaluate(() => document.querySelector('audio')!.currentTime);

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('status')).toContainText('Playing');
  await expect.poll(() => page.evaluate(() => document.querySelector('audio')!.currentTime)).toBeGreaterThan(t1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});

test('registers Media Session handlers for background playback', async ({ page }) => {
  await page.route('**/fixture-silence.wav', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav(60) }),
  );
  await page.goto('/player-check/');
  await page.getByRole('button', { name: 'Eyes open' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  const title = await page.evaluate(() => navigator.mediaSession.metadata?.title);
  expect(title).toBe('Fixture session');
});

const WAV = (route: import('@playwright/test').Route) =>
  route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav(1) });

test('rate before, listen to the end, rate after; stored on the device and clearable', async ({ page }) => {
  await page.route('**/fixture-silence.wav', WAV);
  await page.goto('/player-check/');
  await page.getByRole('button', { name: '2 of 5' }).click();
  await expect(page.getByRole('button', { name: '2 of 5' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Eyes open' }).click();
  await expect(page.getByText('How calm do you feel now?')).toBeVisible({ timeout: 10_000 });
  // The end of the session and the question are announced to screen readers, as the finish message was before.
  await expect(page.getByRole('status')).toContainText('The session has finished. How calm do you feel now?');
  await page.getByRole('button', { name: '4 of 5' }).click();
  await expect(page.getByRole('status')).toContainText('Thank you');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('island.calm-ratings.v1')!));
  expect(stored).toHaveLength(1);
  expect(stored[0]).toMatchObject({ before: 2, after: 4 });
  await expect(page.getByText('1 rating saved on this device only.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear my ratings' }).click();
  expect(await page.evaluate(() => localStorage.getItem('island.calm-ratings.v1'))).toBeNull();
});

test('skipping both ratings is fine and stores nothing', async ({ page }) => {
  await page.route('**/fixture-silence.wav', WAV);
  await page.goto('/player-check/');
  await page.getByRole('button', { name: 'Eyes closed' }).click();
  await expect(page.getByRole('button', { name: 'Skip' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('status')).toContainText('Thank you');
  expect(await page.evaluate(() => localStorage.getItem('island.calm-ratings.v1'))).toBeNull();
});

test.describe('anonymous share of the two numbers', () => {
  async function rateAndFinish(page: import('@playwright/test').Page, requests: string[]) {
    await page.route('**/fixture-silence.wav', WAV);
    await page.route('https://share.example.test/**', (route) => {
      requests.push(route.request().method());
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    });
    await page.goto('/player-check/');
    await page.getByRole('button', { name: '2 of 5' }).click();
    await page.getByRole('button', { name: 'Eyes open' }).click();
    await expect(page.getByText('How calm do you feel now?')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '4 of 5' }).click();
  }

  test('no request is made before Share is tapped, and Not now sends nothing', async ({ page }) => {
    const requests: string[] = [];
    await rateAndFinish(page, requests);
    await expect(page.getByText('Share these two numbers anonymously?')).toBeVisible();
    await page.waitForTimeout(500);
    expect(requests).toEqual([]);
    await page.getByRole('button', { name: 'Not now' }).click();
    await expect(page.getByText('Share these two numbers anonymously?')).toBeHidden();
    await page.waitForTimeout(300);
    expect(requests).toEqual([]);
  });

  test('Share sends one request with only the three numbers; a failure shows nothing', async ({ page }) => {
    let body = '';
    await page.route('**/fixture-silence.wav', WAV);
    await page.route('https://share.example.test/**', (route) => {
      if (route.request().method() === 'POST') body = route.request().postData() ?? '';
      return route.abort();
    });
    await page.goto('/player-check/');
    await page.getByRole('button', { name: '2 of 5' }).click();
    await page.getByRole('button', { name: 'Eyes open' }).click();
    await expect(page.getByText('How calm do you feel now?')).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: '4 of 5' }).click();
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect.poll(() => body).not.toBe('');
    expect(JSON.parse(body)).toEqual({ day: 3, before: 2, after: 4 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('1 rating saved on this device only.')).toBeVisible();
  });

  test('the setting is kept on the device', async ({ page }) => {
    await page.goto('/player-check/');
    await page.getByLabel('Ask to share my calm numbers').uncheck();
    expect(await page.evaluate(() => localStorage.getItem('island.share-ask.v1'))).toBe('off');
    await page.reload();
    await expect(page.getByLabel('Ask to share my calm numbers')).not.toBeChecked();
  });

  test('with the setting off the question never appears', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('island.share-ask.v1', 'off'));
    await rateAndFinish(page, []);
    await expect(page.getByText('Thank you')).toBeVisible();
    await expect(page.getByText('Share these two numbers anonymously?')).toBeHidden();
  });
});
