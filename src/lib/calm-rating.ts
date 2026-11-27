/** Before-and-after calm ratings, kept on this device only (no account, no network). */
export const STORAGE_KEY = 'island.calm-ratings.v1';
export const SCALE = [1, 2, 3, 4, 5] as const;
export type Rating = (typeof SCALE)[number];

export interface RatingPair {
  /** ISO timestamp of when the session finished. */
  at: string;
  session: string;
  before: Rating | null;
  after: Rating | null;
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function isRating(value: unknown): value is Rating {
  return typeof value === 'number' && (SCALE as readonly number[]).includes(value);
}

function parse(raw: string | null): RatingPair[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (p): p is RatingPair =>
        typeof p === 'object' && p !== null && typeof p.at === 'string' && typeof p.session === 'string' &&
        (p.before === null || isRating(p.before)) && (p.after === null || isRating(p.after)),
    );
  } catch {
    return [];
  }
}

/** Reads saved pairs; never throws (storage may be blocked or corrupt). */
export function loadRatings(store: Store | undefined): RatingPair[] {
  try {
    return store ? parse(store.getItem(STORAGE_KEY)) : [];
  } catch {
    return [];
  }
}

/** Saves a pair unless both ratings were skipped. Returns whether it was stored. */
export function saveRating(store: Store | undefined, pair: RatingPair): boolean {
  if (!store || (pair.before === null && pair.after === null)) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify([...loadRatings(store), pair]));
    return true;
  } catch {
    return false;
  }
}

export function clearRatings(store: Store | undefined): void {
  try {
    store?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function ratingLabel(n: Rating): string {
  return `${n} of 5${n === 1 ? ', not at all calm' : n === 5 ? ', very calm' : ''}`;
}
