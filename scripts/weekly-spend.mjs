#!/usr/bin/env node
// Cross-run spend accounting for the weekly workflow. Each run uploads an artifact named
// spend-<ISO week>-<cents>-<run>-<attempt>; later runs add up this week's names so the cap holds across retries.
// Usage: node scripts/weekly-spend.mjs sum <week>            (artifact names on stdin, one per line; prints cents)
//        node scripts/weekly-spend.mjs name <week> <spend.json> <priorUsd> <runId> <attempt>   (prints the artifact name)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Cents already spent in `week` (e.g. "2026-W48"), from artifact names. Other weeks and other names are ignored. */
export function sumWeekCents(names, week) {
  const prefix = `spend-${week}-`;
  let total = 0;
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const cents = Number(name.slice(prefix.length).split('-')[0]);
    if (Number.isInteger(cents) && cents >= 0) total += cents;
  }
  return total;
}

/** Artifact name recording what this run spent beyond what earlier runs had already spent. */
export function spendArtifactName({ week, spentUsd, priorUsd = 0, runId, attempt }) {
  const cents = Math.max(0, Math.ceil((spentUsd - priorUsd) * 100 - 1e-9));
  return `spend-${week}-${cents}-${runId}-${attempt}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, week, ...rest] = process.argv.slice(2);
  if (cmd === 'sum') {
    console.log(sumWeekCents(readFileSync(0, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean), week));
  } else if (cmd === 'name') {
    const [file, priorUsd, runId, attempt] = rest;
    const { spentUsd } = JSON.parse(readFileSync(file, 'utf8'));
    console.log(spendArtifactName({ week, spentUsd, priorUsd: Number(priorUsd), runId, attempt }));
  } else {
    console.error('Usage: weekly-spend.mjs sum <week> | name <week> <spend.json> <priorUsd> <runId> <attempt>');
    process.exit(1);
  }
}
