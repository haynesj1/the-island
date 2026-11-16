import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { render } from '../scripts/render-world-bible.mjs';

type Place = Record<string, unknown> & { id: string; name: string; region: string; description: string; phases: number[] };
const data = JSON.parse(readFileSync('content/places.json', 'utf8')) as {
  island: { summary: string; palette: string; rules: string[]; themes: string[] };
  regions: { id: string; name: string; summary: string }[];
  places: Place[];
};

const TEXT_FIELDS = ['name', 'description', 'timeOfDay', 'light', 'wayIn', 'wayOut', 'feeling'];
const LIST_FIELDS = ['sights', 'sounds', 'textures', 'smells'];

// Banned imagery from docs/script-guardrails.md § Imagery. Whole words/phrases, case-insensitive.
const BANNED = [
  'submerge', 'submerged', 'submersion', 'sinking', 'sink', 'drown', 'drowning', 'deep', 'dark', 'darkness', 'dim',
  'storm', 'storms', 'stormy', 'thunder', 'lightning', 'rip tide', 'rip tides', 'rip',
  'cave', 'caves', 'tunnel', 'tunnels', 'cellar', 'cupboard', 'closet', 'cabin',
  'cliff', 'cliffs', 'edge', 'ledge', 'precipice', 'summit', 'peak', 'height', 'heights', 'drop', 'fall', 'falling',
  'stranded', 'lost', 'trapped', 'no way off', 'no way out', 'heavy', 'heaviness', 'dissolve', 'dissolving',
  'injury', 'injured', 'illness', 'sick', 'death', 'dead', 'die', 'abandoned', 'threat',
];
const banned = new RegExp(`\\b(${BANNED.join('|')})\\b`, 'i');

function allText(p: Place): string[] {
  return [...TEXT_FIELDS.map((f) => p[f] as string), ...LIST_FIELDS.flatMap((f) => p[f] as string[])];
}

describe('places.json', () => {
  it('has island-wide rules and themes with no banned image word', () => {
    expect(data.island.summary.trim().length).toBeGreaterThan(0);
    expect(data.island.palette.trim().length).toBeGreaterThan(0);
    expect(data.island.rules.length).toBeGreaterThan(0);
    expect(data.island.themes.length).toBeGreaterThan(0);
    for (const t of [data.island.summary, data.island.palette, ...data.island.rules, ...data.island.themes]) {
      expect(t, t).not.toMatch(banned);
    }
  });
  it('has 15 to 20 places in a few regions', () => {
    expect(data.places.length).toBeGreaterThanOrEqual(15);
    expect(data.places.length).toBeLessThanOrEqual(20);
    expect(data.regions.length).toBeGreaterThanOrEqual(3);
  });
  it('has unique ids and names, and valid regions', () => {
    const ids = data.places.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(data.places.map((p) => p.name)).size).toBe(ids.length);
    const regionIds = data.regions.map((r) => r.id);
    for (const p of data.places) expect(regionIds).toContain(p.region);
    for (const r of data.regions) expect(data.places.some((p) => p.region === r.id)).toBe(true);
  });
  it.each(data.places.map((p) => [p.id, p] as const))('%s has every field', (_id, p) => {
    for (const f of [...TEXT_FIELDS, 'id', 'region']) {
      expect(typeof p[f], f).toBe('string');
      expect((p[f] as string).trim().length, f).toBeGreaterThan(0);
    }
    for (const f of LIST_FIELDS) {
      expect(Array.isArray(p[f]), f).toBe(true);
      expect((p[f] as string[]).length, f).toBeGreaterThan(0);
      for (const s of p[f] as string[]) expect(s.trim().length).toBeGreaterThan(0);
    }
    expect(p.phases.length).toBeGreaterThan(0);
    for (const ph of p.phases) expect(Number.isInteger(ph) && ph >= 1 && ph <= 4).toBe(true);
  });
  it.each(data.places.map((p) => [p.id, p] as const))('%s has no banned image word', (_id, p) => {
    for (const t of allText(p)) expect(t, t).not.toMatch(banned);
  });
  it('covers every phase', () => {
    for (const ph of [1, 2, 3, 4]) expect(data.places.some((p) => p.phases.includes(ph))).toBe(true);
  });
  it('has a safe default place for phase 1 in each of several regions', () => {
    const regions = new Set(data.places.filter((p) => p.phases.includes(1)).map((p) => p.region));
    expect(regions.size).toBeGreaterThanOrEqual(3);
  });
});

describe('banned-word check', () => {
  it('catches the words it should', () => {
    for (const s of ['a deep cave', 'the cliff edge', 'a dark tunnel', 'a storm', 'no way off']) expect(s).toMatch(banned);
  });
  it('does not flag ordinary words', () => {
    expect('a shallow, sunlit beach path').not.toMatch(banned);
  });
});

describe('world-bible.md', () => {
  it('is up to date with places.json', () => {
    expect(readFileSync('content/world-bible.md', 'utf8')).toBe(render(data));
  });
  it('mentions every place', () => {
    const md = readFileSync('content/world-bible.md', 'utf8');
    for (const p of data.places) expect(md).toContain(`### ${p.name}`);
  });
});
