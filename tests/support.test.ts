import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isSupportPlaceholder, SUPPORT_PATH, SUPPORT_PLACEHOLDER } from '../src/lib/support';

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? pages(p) : p.endsWith('.astro') ? [p] : [];
  });
}

describe('support page', () => {
  const text = readFileSync('content/signposting.md', 'utf8');

  it('keeps a single placeholder line and no other wording until Jordan writes it', () => {
    if (!isSupportPlaceholder(text)) return;
    expect(text.trim()).toBe(SUPPORT_PLACEHOLDER);
  });

  it('is renderable at /support and shows only the pending message while a placeholder remains', () => {
    const page = readFileSync('src/pages/support.astro', 'utf8');
    expect(page).toContain('content/signposting.md');
    expect(page).toContain('isSupportPlaceholder');
  });

  // Launch gate: replaced by `npm run check:launch` (#50) when that exists.
  it.skipIf(!process.env.LAUNCH_CHECK)('LAUNCH CHECK: the placeholder has been replaced by the real text', () => {
    expect(isSupportPlaceholder(text)).toBe(false);
  });

  it('links to /support from the footer of the shared layout', () => {
    const base = readFileSync('src/layouts/Base.astro', 'utf8');
    expect(base).toContain('<footer');
    expect(base).toContain('SUPPORT_PATH');
    expect(SUPPORT_PATH).toBe('/support');
  });

  it('every page (home, player check, sessions, support) uses the shared layout', () => {
    const all = pages('src/pages');
    expect(all).toContain(join('src/pages', 'index.astro'));
    for (const p of all) expect(readFileSync(p, 'utf8'), p).toMatch(/layouts\/Base\.astro/);
  });

  it('has a footer link on the built pages', () => {
    if (!existsSync('dist')) return;
    for (const f of ['dist/index.html', 'dist/support/index.html']) {
      expect(readFileSync(f, 'utf8'), f).toContain('href="/support"');
    }
  });
});
