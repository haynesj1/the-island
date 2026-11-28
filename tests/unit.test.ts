import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FORBIDDEN_CLAIMS, TAGLINE } from '../src/lib/site';
import { injectAssets } from '../scripts/precache-assets.mjs';
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

describe('service worker precache of built assets', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  it('injects built assets into the precache list', () => {
    const out = injectAssets(sw, ['/_astro/a.css', '/_astro/b.js']);
    expect(out).toContain('const BUILT_ASSETS = ["/_astro/a.css","/_astro/b.js"];');
  });
  it('precaches built assets on install', () => {
    expect(sw).toContain('...BUILT_ASSETS');
  });
  it('fails loudly if the placeholder is missing', () => {
    expect(() => injectAssets('nothing', [])).toThrow();
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

describe('service worker offline save', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  it('uses the same session cache name as the page and keeps it when the shell updates', async () => {
    const { SESSION_CACHE } = await import('../src/lib/shell');
    expect(sw).toContain(`const SESSION_CACHE = '${SESSION_CACHE}'`);
    expect(sw).toContain('k !== SESSION_CACHE');
  });
  it('handles save-session messages and ranged audio requests', () => {
    expect(sw).toContain("data.type !== 'save-session'");
    expect(sw).toContain('status: 206');
  });
});
