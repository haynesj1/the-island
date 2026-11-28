/**
 * Anonymous share endpoint (specs/share-rating.md).
 * Accepts one POST of { day, before, after } and adds one to a count for that combination.
 * Stores counts only: no row per listener, no time, no address. There is no route that reads the counts;
 * read them in the Cloudflare dashboard (KV namespace SHARE_COUNTS).
 */
export const MAX_DAY = 100;
const MAX_BODY = 200;

/** Returns { day, before, after } when the body has exactly those three whole numbers in range, else null. */
export function validate(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const keys = Object.keys(body).sort();
  if (keys.join() !== 'after,before,day') return null;
  const { day, before, after } = body;
  const whole = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
  if (!whole(day, 1, MAX_DAY) || !whole(before, 1, 5) || !whole(after, 1, 5)) return null;
  return { day, before, after };
}

export function countKey({ day, before, after }) {
  return `day:${day}:before:${before}:after:${after}`;
}

function reply(status, origin) {
  const headers = { 'cache-control': 'no-store' };
  if (origin) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'POST';
    headers['access-control-allow-headers'] = 'content-type';
    headers.vary = 'origin';
  }
  return new Response(null, { status, headers });
}

/** env.ALLOWED_ORIGIN is the app's own address; env.SHARE_COUNTS is a KV namespace. */
export async function handle(request, env) {
  const origin = request.headers.get('origin');
  if (!origin || !env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return reply(403, null);
  if (request.method === 'OPTIONS') return reply(204, origin);
  if (request.method !== 'POST') return reply(405, origin);

  const text = await request.text();
  if (text.length > MAX_BODY) return reply(413, origin);
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return reply(400, origin);
  }
  const valid = validate(parsed);
  if (!valid) return reply(400, origin);

  // Counts are small and a lost increment under a race is acceptable; the number is a tally, not a ledger.
  const key = countKey(valid);
  const current = Number.parseInt((await env.SHARE_COUNTS.get(key)) ?? '0', 10) || 0;
  await env.SHARE_COUNTS.put(key, String(current + 1));
  return reply(204, origin);
}

export default { fetch: (request, env) => handle(request, env) };
