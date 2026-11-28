import { describe, expect, it, vi } from 'vitest';
import { ASK_KEY, askEnabled, buildPayload, sendShare, setAskEnabled, shareUrl, shouldAsk } from '../src/lib/share';

function memory() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}
const payload = { day: 3, before: 2, after: 4 } as const;

describe('share client', () => {
  it('is off when the endpoint is unset or blank', () => {
    expect(shareUrl(undefined)).toBeUndefined();
    expect(shareUrl('  ')).toBeUndefined();
    expect(shouldAsk(undefined, memory(), { ...payload })).toBe(false);
    expect(shareUrl('https://s.test/')).toBe('https://s.test/');
  });
  it('needs both ratings and a day', () => {
    expect(buildPayload(3, 2, 4)).toEqual(payload);
    expect(buildPayload(3, null, 4)).toBeNull();
    expect(buildPayload(3, 2, null)).toBeNull();
    expect(buildPayload(undefined, 2, 4)).toBeNull();
  });
  it('keeps the switch on the device, on by default, and survives blocked storage', () => {
    const s = memory();
    expect(askEnabled(s)).toBe(true);
    setAskEnabled(s, false);
    expect(s.getItem(ASK_KEY)).toBe('off');
    expect(shouldAsk('https://s.test/', s, { ...payload })).toBe(false);
    setAskEnabled(s, true);
    expect(shouldAsk('https://s.test/', s, { ...payload })).toBe(true);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(askEnabled(broken)).toBe(true);
    expect(() => setAskEnabled(broken, false)).not.toThrow();
  });
  it('share: sends exactly the three numbers, nothing else', async () => {
    const f = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await sendShare('https://s.test/', { ...payload }, f as unknown as typeof fetch)).toBe(true);
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ day: 3, before: 2, after: 4 });
    expect(init.credentials).toBe('omit');
  });
  it('not now: nothing is sent because sendShare is never called (and no url sends nothing)', async () => {
    const f = vi.fn();
    expect(await sendShare(undefined, { ...payload }, f as unknown as typeof fetch)).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('failure: a rejected or non-ok request returns false without throwing', async () => {
    expect(await sendShare('https://s.test/', { ...payload }, (async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBe(false);
    expect(await sendShare('https://s.test/', { ...payload }, (async () => new Response(null, { status: 500 })) as unknown as typeof fetch)).toBe(false);
  });
});
