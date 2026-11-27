import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, clearRatings, loadRatings, ratingLabel, saveRating, type RatingPair } from '../src/lib/calm-rating';

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
    removeItem: (k: string) => void delete data[k],
  };
}
const pair = (over: Partial<RatingPair> = {}): RatingPair => ({ at: '2026-11-27T20:00:00Z', session: 's1', before: 2, after: 4, ...over });

describe('calm rating storage', () => {
  it('starts empty and stores pairs in order', () => {
    const s = memory();
    expect(loadRatings(s)).toEqual([]);
    expect(saveRating(s, pair())).toBe(true);
    expect(saveRating(s, pair({ session: 's2', before: null }))).toBe(true);
    expect(loadRatings(s).map((p) => p.session)).toEqual(['s1', 's2']);
  });
  it('does not store a pair where both ratings were skipped', () => {
    const s = memory();
    expect(saveRating(s, pair({ before: null, after: null }))).toBe(false);
    expect(loadRatings(s)).toEqual([]);
  });
  it('clears everything', () => {
    const s = memory();
    saveRating(s, pair());
    clearRatings(s);
    expect(loadRatings(s)).toEqual([]);
    expect(s.data[STORAGE_KEY]).toBeUndefined();
  });
  it('ignores corrupt or invalid stored data', () => {
    expect(loadRatings(memory({ [STORAGE_KEY]: 'not json' }))).toEqual([]);
    expect(loadRatings(memory({ [STORAGE_KEY]: '{"a":1}' }))).toEqual([]);
    expect(loadRatings(memory({ [STORAGE_KEY]: JSON.stringify([pair(), { ...pair(), before: 9 }]) }))).toHaveLength(1);
  });
  it('survives unavailable or throwing storage', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadRatings(broken)).toEqual([]);
    expect(saveRating(broken, pair())).toBe(false);
    expect(() => clearRatings(broken)).not.toThrow();
    expect(loadRatings(undefined)).toEqual([]);
    expect(saveRating(undefined, pair())).toBe(false);
  });
  it('labels the ends of the scale', () => {
    expect(ratingLabel(1)).toContain('not at all calm');
    expect(ratingLabel(5)).toContain('very calm');
    expect(ratingLabel(3)).toBe('3 of 5');
  });
});
