import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { CostCapError, makeBudget } from '../scripts/generate-script.mjs';
import { reviewScript } from '../scripts/safety-review.mjs';
import { spendArtifactName, sumWeekCents } from '../scripts/weekly-spend.mjs';

const config = JSON.parse(readFileSync('scripts/pipeline.config.json', 'utf8'));

describe('sumWeekCents', () => {
  it('adds every run and retry of the week, failed runs included', () => {
    const names = ['spend-2026-W48-120-1001-1', 'spend-2026-W48-35-1001-2', 'spend-2026-W48-0-1002-1'];
    expect(sumWeekCents(names, '2026-W48')).toBe(155);
  });
  it('ignores other weeks, other artifacts and malformed names', () => {
    const names = ['spend-2026-W47-500-9-1', 'spend-2026-W480-500-9-1', 'playwright-report', 'spend-2026-W48-abc-9-1', 'spend-2026-W48--5-9-1', 'spend-2026-W48-40-9-1'];
    expect(sumWeekCents(names, '2026-W48')).toBe(40);
  });
  it('is zero with no artifacts', () => {
    expect(sumWeekCents([], '2026-W48')).toBe(0);
  });
});

describe('spendArtifactName', () => {
  it('records only what this run added, rounded up to a cent', () => {
    expect(spendArtifactName({ week: '2026-W48', spentUsd: 1.5, priorUsd: 1.2, runId: 7, attempt: 1 })).toBe('spend-2026-W48-30-7-1');
    expect(spendArtifactName({ week: '2026-W48', spentUsd: 1.2034, priorUsd: 1.2, runId: 7, attempt: 2 })).toBe('spend-2026-W48-1-7-2');
  });
  it('never records a negative amount', () => {
    expect(spendArtifactName({ week: '2026-W48', spentUsd: 0.1, priorUsd: 0.5, runId: 7, attempt: 1 })).toBe('spend-2026-W48-0-7-1');
  });
});

describe('weekly allowance across runs', () => {
  it('a failed attempt’s recorded spend is carried into the next run and counts against the cap', () => {
    const cap = config.weeklyCapUsd;
    // Run 1 fails after spending $2; its record names the spend.
    const run1 = spendArtifactName({ week: '2026-W48', spentUsd: 2, priorUsd: 0, runId: 1, attempt: 1 });
    // Run 2 starts from what the names say.
    const prior = sumWeekCents([run1], '2026-W48') / 100;
    expect(prior).toBe(2);
    expect(makeBudget(config, prior).total()).toBe(2);
    const run2 = spendArtifactName({ week: '2026-W48', spentUsd: cap - 0.5, priorUsd: prior, runId: 2, attempt: 1 });
    expect(sumWeekCents([run1, run2], '2026-W48') / 100).toBeCloseTo(cap - 0.5, 5);
  });
  it('stops a run once earlier runs have used the allowance', async () => {
    const prior = sumWeekCents([`spend-2026-W48-${Math.round(config.weeklyCapUsd * 100)}-1-1`], '2026-W48') / 100;
    const provider = { calls: 0, async complete() { this.calls++; return { text: 'PASS', inputTokens: 1, outputTokens: 1 }; } };
    await expect(reviewScript({ text: 'x', guardrails: 'y', provider, config, spentUsd: prior })).rejects.toBeInstanceOf(CostCapError);
    expect(provider.calls).toBe(0);
  });
});
