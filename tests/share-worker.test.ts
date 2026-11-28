import { describe, expect, it } from 'vitest';
import { countKey, handle, validate } from '../worker/share/index.js';

const ORIGIN = 'https://the-island.example';

function kv() {
  const data = new Map<string, string>();
  return { data, get: async (k: string) => data.get(k) ?? null, put: async (k: string, v: string) => void data.set(k, v) };
}
const post = (body: unknown, origin: string | null = ORIGIN, method = 'POST') =>
  new Request('https://share.test/', {
    method,
    headers: origin ? { origin, 'content-type': 'application/json' } : {},
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });

describe('validate', () => {
  it('accepts exactly day, before, after in range', () => {
    expect(validate({ day: 3, before: 2, after: 4 })).toEqual({ day: 3, before: 2, after: 4 });
    expect(validate({ day: 100, before: 1, after: 5 })).not.toBeNull();
  });
  it.each([
    [{ day: 3, before: 2 }],
    [{ day: 3, before: 2, after: 4, note: 'hi' }],
    [{ day: 0, before: 2, after: 4 }],
    [{ day: 101, before: 2, after: 4 }],
    [{ day: 3, before: 0, after: 4 }],
    [{ day: 3, before: 2, after: 6 }],
    [{ day: 3.5, before: 2, after: 4 }],
    [{ day: '3', before: 2, after: 4 }],
    [{ day: 3, before: null, after: 4 }],
    [[1, 2, 3]],
    [null],
    ['text'],
  ])('rejects %j', (body) => {
    expect(validate(body)).toBeNull();
  });
});

describe('worker', () => {
  it('adds one to the count for the combination and stores nothing else', async () => {
    const store = kv();
    const env = { ALLOWED_ORIGIN: ORIGIN, SHARE_COUNTS: store };
    for (let i = 0; i < 3; i++) expect((await handle(post({ day: 3, before: 2, after: 4 }), env)).status).toBe(204);
    expect((await handle(post({ day: 3, before: 2, after: 5 }), env)).status).toBe(204);
    expect([...store.data.entries()]).toEqual([
      [countKey({ day: 3, before: 2, after: 4 }), '3'],
      [countKey({ day: 3, before: 2, after: 5 }), '1'],
    ]);
  });
  it('answers only the app origin', async () => {
    const store = kv();
    const env = { ALLOWED_ORIGIN: ORIGIN, SHARE_COUNTS: store };
    const ok = await handle(post({ day: 1, before: 1, after: 1 }), env);
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    for (const origin of ['https://evil.example', null]) {
      const res = await handle(post({ day: 1, before: 1, after: 1 }, origin), env);
      expect(res.status).toBe(403);
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    }
    expect(store.data.size).toBe(1);
  });
  it('rejects bad bodies, large bodies and every method but POST (and the preflight)', async () => {
    const store = kv();
    const env = { ALLOWED_ORIGIN: ORIGIN, SHARE_COUNTS: store };
    expect((await handle(post('not json'), env)).status).toBe(400);
    expect((await handle(post({ day: 1, before: 1, after: 1, extra: 1 }), env)).status).toBe(400);
    expect((await handle(post('x'.repeat(500)), env)).status).toBe(413);
    expect((await handle(post(null, ORIGIN, 'GET'), env)).status).toBe(405);
    expect((await handle(post(null, ORIGIN, 'OPTIONS'), env)).status).toBe(204);
    expect(store.data.size).toBe(0);
  });
  it('has no response body, so nothing can read the counts', async () => {
    const env = { ALLOWED_ORIGIN: ORIGIN, SHARE_COUNTS: kv() };
    expect(await (await handle(post({ day: 1, before: 1, after: 1 }), env)).text()).toBe('');
  });
});
