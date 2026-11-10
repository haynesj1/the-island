import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FORBIDDEN_CLAIMS, TAGLINE } from '../src/lib/site';
import { SHELL_CACHE, SHELL_URLS } from '../src/lib/shell';

describe('copy', () => {
  it('uses the agreed tagline', () => {
    expect(TAGLINE).toBe('Short guided escapes to a calm island. Relaxation practice, not therapy.');
  });
  it('makes no forbidden claims', () => {
    const lower = TAGLINE.toLowerCase().replace('not therapy', '');
    for (const w of FORBIDDEN_CLAIMS) expect(lower).not.toContain(w);
  });
});

describe('service worker', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  it('matches the shell constants', () => {
    expect(sw).toContain(`const SHELL_CACHE = '${SHELL_CACHE}'`);
    expect(sw).toContain(`const SHELL_URLS = ${JSON.stringify(SHELL_URLS).replace(/"/g, "'").replace(/,/g, ', ')}`);
  });
});

describe('manifest', () => {
  const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
  it('is installable', () => {
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.lang).toBe('en-GB');
    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });
  it('lists only icons that exist', () => {
    for (const i of m.icons) expect(() => readFileSync(`public${i.src}`)).not.toThrow();
  });
});
