// Renders content/world-bible.md from content/places.json (the single source of truth).
// Usage: node scripts/render-world-bible.mjs        (writes the file)
import { readFileSync, writeFileSync } from 'node:fs';

export function render(data) {
  const out = [
    '# World bible',
    '',
    '<!-- Generated from content/places.json by scripts/render-world-bible.mjs. Edit the JSON, then re-run the script. -->',
    '',
    'Every place sessions visit, with fixed sensory details so that returning feels like coming back. Every place passes the Imagery rules in `docs/script-guardrails.md`. "Phases" are the curriculum phases (1 to 4) a place suits; the 100-day map is a separate piece of work and may adjust them.',
    '',
  ];
  for (const region of data.regions) {
    out.push(`## ${region.name}`, '', region.summary, '');
    for (const p of data.places.filter((x) => x.region === region.id)) {
      out.push(
        `### ${p.name}`,
        '',
        p.description,
        '',
        `- **Sights:** ${p.sights.join('; ')}`,
        `- **Sounds:** ${p.sounds.join('; ')}`,
        `- **Textures:** ${p.textures.join('; ')}`,
        `- **Smells:** ${p.smells.join('; ')}`,
        `- **Time of day:** ${p.timeOfDay}`,
        `- **Light:** ${p.light}`,
        `- **Way in:** ${p.wayIn}`,
        `- **Way out:** ${p.wayOut}`,
        `- **Suits phases:** ${p.phases.join(', ')}`,
        '',
      );
    }
  }
  return out.join('\n');
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const data = JSON.parse(readFileSync('content/places.json', 'utf8'));
  writeFileSync('content/world-bible.md', render(data));
}
