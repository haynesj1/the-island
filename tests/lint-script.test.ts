import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { lintScript, main } from '../scripts/lint-script.mjs';

const dir = 'tests/fixtures/scripts/';
const read = (f: string) => readFileSync(dir + f, 'utf8');

describe('lint-script', () => {
  it('passes the good fixture', () => {
    expect(lintScript(read('pass.md'))).toEqual([]);
  });

  // fixture file -> rule it must trip (and the line it must be reported on, where it is line-specific)
  const failing: [string, string, number?][] = [
    ['fail-imagery.md', 'imagery', 15],
    ['fail-body-breath.md', 'body-and-breath', 15],
    ['fail-memory.md', 'memories', 15],
    ['fail-banned-phrase.md', 'banned-phrase', 9],
    ['fail-claims.md', 'claims', 9],
    ['fail-uk-spelling.md', 'uk-spelling', 15],
    ['fail-token.md', 'tokens', 7],
    ['fail-ellipsis.md', 'tokens', 15],
    ['fail-silence-max.md', 'silence-max', 11],
    ['fail-budget.md', 'budget'],
    ['fail-no-opening-choice.md', 'structure-opening-choice'],
    ['fail-no-permission-start.md', 'structure-permission-start'],
    ['fail-no-permission-midway.md', 'structure-permission-midway'],
    ['fail-no-grounding.md', 'structure-closing-grounding'],
    ['fail-no-driving.md', 'structure-driving-notice'],
    ['fail-driving-affirmative.md', 'structure-driving-notice'],
    ['fail-softbreak-phrase.md', 'body-and-breath'],
    ['fail-oneline-midway.md', 'structure-permission-midway'],
    ['fail-emphasis-phrase.md', 'body-and-breath'],
    ['fail-silence-run.md', 'silence-max'],
  ];

  it.each(failing)('%s fails rule %s', (file, rule, line) => {
    const found = lintScript(read(file));
    const hits = found.filter((f) => f.rule === rule);
    expect(hits.length, JSON.stringify(found)).toBeGreaterThan(0);
    if (line) expect(hits.map((h) => h.line)).toContain(line);
    // A fixture should break only the rule it is for.
    expect(found.filter((f) => f.rule !== rule), JSON.stringify(found)).toEqual([]);
  });

  it('has a fixture for every failing case on disk', () => {
    const onDisk = readdirSync(dir).filter((f) => f.startsWith('fail-')).sort();
    expect(onDisk).toEqual(failing.map((f) => f[0]).sort());
  });

  it('exits non-zero on failure and zero on a pass', () => {
    const quiet = console.error;
    console.error = () => {};
    try {
      expect(main([dir + 'pass.md'])).toBe(0);
      expect(main([dir + 'fail-claims.md'])).toBe(1);
      expect(main([])).toBe(2);
    } finally {
      console.error = quiet;
    }
  });
});
