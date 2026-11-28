/** Optional anonymous share of the two calm numbers (specs/share-rating.md). Sends day, before, after only. */
import type { Rating } from './calm-rating';

export const ASK_KEY = 'island.share-ask.v1';

export interface SharePayload {
  day: number;
  before: Rating;
  after: Rating;
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** The endpoint from the public build setting; undefined means the share line is never shown. */
export function shareUrl(raw: string | undefined = import.meta.env.PUBLIC_SHARE_URL): string | undefined {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value ? value : undefined;
}

/** On by default; only an explicit "off" stored on the device turns the question off. */
export function askEnabled(store: Store | undefined): boolean {
  try {
    return store?.getItem(ASK_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setAskEnabled(store: Store | undefined, on: boolean): void {
  try {
    store?.setItem(ASK_KEY, on ? 'on' : 'off');
  } catch {
    // The choice cannot be kept; the question simply follows the default next time.
  }
}

/** Builds the payload only when everything needed is present: both ratings and a day of the programme. */
export function buildPayload(day: number | undefined, before: Rating | null, after: Rating | null): SharePayload | null {
  if (day === undefined || !Number.isInteger(day) || day < 1 || before === null || after === null) return null;
  return { day, before, after };
}

export function shouldAsk(url: string | undefined, store: Store | undefined, payload: SharePayload | null): boolean {
  return Boolean(url) && payload !== null && askEnabled(store);
}

/** Sends the three numbers once. Never throws, never retries, no cookies. Returns whether it was accepted. */
export async function sendShare(
  url: string | undefined,
  payload: SharePayload,
  doFetch: typeof fetch = globalThis.fetch,
): Promise<boolean> {
  if (!url) return false;
  try {
    const body = { day: payload.day, before: payload.before, after: payload.after };
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;
  }
}
