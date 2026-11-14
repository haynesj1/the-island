// Post-build: add the generated (hashed) assets to the service worker's precache list in dist/sw.js,
// so an offline launch can load the CSS and JS the home page needs, not just the HTML.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function listBuiltAssets(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(css|js|mjs)$/.test(name)) out.push('/' + relative(dir, p).split(sep).join('/'));
    }
  };
  walk(join(dir, '_astro'));
  return out.sort();
}

export function injectAssets(swSource, assets) {
  const re = /const BUILT_ASSETS = \[[^\]]*\];/;
  if (!re.test(swSource)) throw new Error('sw.js has no BUILT_ASSETS placeholder');
  return swSource.replace(re, `const BUILT_ASSETS = ${JSON.stringify(assets)};`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = join(process.cwd(), 'dist');
  const assets = listBuiltAssets(dist);
  if (assets.length === 0) throw new Error('no built assets found in dist/_astro');
  const swPath = join(dist, 'sw.js');
  writeFileSync(swPath, injectAssets(readFileSync(swPath, 'utf8'), assets));
  console.log(`precache: ${assets.length} built assets added to dist/sw.js`);
}
