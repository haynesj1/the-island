import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CostCapError } from '../scripts/generate-script.mjs';
import { formatPrBody, formatReview, main, reviewScript } from '../scripts/safety-review.mjs';

const config = JSON.parse(readFileSync('scripts/pipeline.config.json', 'utf8'));
const guardrails = readFileSync('docs/script-guardrails.md', 'utf8');
const text = readFileSync('tests/fixtures/scripts/pass.md', 'utf8');
const fake = (reply: string) => {
  const calls: { stage: string; system: string; prompt: string }[] = [];
  return { calls, async complete(c: { stage: string; system: string; prompt: string }) { calls.push(c); return { text: reply, inputTokens: 1000, outputTokens: 100 }; } };
};

describe('reviewScript', () => {
  it('passes only on an exact PASS and sends the guardrails and script to a separate stage', async () => {
    const p = fake(' PASS\n');
    const r = await reviewScript({ text, guardrails, provider: p, config });
    expect(r.pass).toBe(true);
    expect(p.calls[0].stage).toBe('safety');
    expect(p.calls[0].prompt).toContain('# Script guardrails');
    expect(p.calls[0].prompt).toContain(text.slice(-40));
    expect(r.spentUsd).toBeGreaterThan(0);
  });

  it('turns each line of any other reply into a finding', async () => {
    const r = await reviewScript({ text, guardrails, provider: fake('- Imagery: "dark water"\n- Claims: "reduce anxiety"'), config });
    expect(r.pass).toBe(false);
    expect(r.findings).toEqual(['Imagery: "dark water"', 'Claims: "reduce anxiety"']);
  });

  it('never reads an empty or chatty reply as clear', async () => {
    expect((await reviewScript({ text, guardrails, provider: fake(''), config })).pass).toBe(false);
    expect((await reviewScript({ text, guardrails, provider: fake('Looks fine to me'), config })).pass).toBe(false);
  });

  it('stops before the call when the weekly cap is spent', async () => {
    const p = fake('PASS');
    await expect(reviewScript({ text, guardrails, provider: p, config, spentUsd: 5 })).rejects.toBeInstanceOf(CostCapError);
    expect(p.calls).toHaveLength(0);
  });
});

describe('PR text', () => {
  const session = { day: 8, theme: 'The Cove' };
  it('lists findings in the review and body, and states the owner step', () => {
    const review = { pass: false, findings: ['Imagery: "cave"'], spentUsd: 0.5 };
    expect(formatReview(review)).toMatch(/1 finding\(s\)[\s\S]*- Imagery: "cave"/);
    const body = formatPrBody({ session, revisions: 2, spentUsd: 0.5, review });
    expect(body).toMatch(/content\/sessions\/008\/script\.md/);
    expect(body).toMatch(/1 finding\(s\)/);
    expect(body).toMatch(/Nothing is voiced or published until Jordan/);
  });
  it('says clear when there are no findings', () => {
    const review = { pass: true, findings: [], spentUsd: 0.2 };
    expect(formatReview(review)).toMatch(/no findings/);
    expect(formatPrBody({ session, revisions: 0, spentUsd: 0.2, review })).toMatch(/Model safety review: no findings/);
  });
});

describe('main', () => {
  it('writes the body and review files from a faked model', async () => {
    const root = mkdtempSync(join(tmpdir(), 'rev-'));
    mkdirSync(join(root, '001'));
    writeFileSync(join(root, '001', 'script.md'), text);
    const body = join(root, 'body.md');
    const rev = join(root, 'review.md');
    expect(await main(['--day', '1', '--body-out', body, '--review-out', rev], fake('- Language: "relax now"'), root)).toBe(0);
    expect(readFileSync(rev, 'utf8')).toMatch(/relax now/);
    expect(readFileSync(body, 'utf8')).toMatch(/day 1/);
  });
});
