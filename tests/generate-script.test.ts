import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CostCapError, criticChecks, generate, main, nextSession, similarity, worldContext } from '../scripts/generate-script.mjs';
import { lintScript } from '../scripts/lint-script.mjs';

const config = JSON.parse(readFileSync('scripts/pipeline.config.json', 'utf8'));
const good = readFileSync('tests/fixtures/scripts/pass.md', 'utf8').replace(/^---[\s\S]*?---\n/, '');
const session = { id: 's01', day: 1, theme: 'Arrive', speechMinutes: 2.4, wordBudget: 252, maxSilenceSeconds: 20 };
const place = { name: 'The Cove', description: 'A sheltered bay.' };
const island = { summary: 'A rugged island.' };

type Call = { stage: string; prompt: string };
function fake(replies: Record<string, string[]>, usage = { inputTokens: 100, outputTokens: 100 }) {
  const calls: Call[] = [];
  const n: Record<string, number> = {};
  return {
    calls,
    async complete({ stage, prompt }: Call) {
      calls.push({ stage, prompt });
      const list = replies[stage];
      const text = list[Math.min(n[stage] ?? 0, list.length - 1)];
      n[stage] = (n[stage] ?? 0) + 1;
      return { text, ...usage };
    },
  };
}

describe('generate', () => {
  it('produces a lint-clean script with no revision when the draft is good', async () => {
    const p = fake({ outline: ['- arrive'], draft: [good], critic: ['OK'], revise: ['unused'] });
    const out = await generate({ session, place, island, provider: p, config });
    expect(out.revisions).toBe(0);
    expect(lintScript(out.text)).toEqual([]);
    expect(out.text.startsWith('---\nspeech_minutes: 2.4\nmax_silence_seconds: 20\n---')).toBe(true);
    expect(p.calls.map((c) => c.stage)).toEqual(['outline', 'draft', 'critic']);
  });

  it('revises when the lint fails, passing the lint finding to the reviser', async () => {
    const bad = good.replace('soft morning light', 'a storm over deep water');
    const p = fake({ outline: ['o'], draft: [bad], critic: ['OK'], revise: [good] });
    const out = await generate({ session, place, island, provider: p, config });
    expect(out.revisions).toBe(1);
    const rev = p.calls.find((c) => c.stage === 'revise')!;
    expect(rev.prompt).toMatch(/banned imagery/);
    expect(lintScript(out.text)).toEqual([]);
  });

  it('revises on a continuity complaint from the critic', async () => {
    const p = fake({ outline: ['o'], draft: [good], critic: ['- The cove has no hut in the bible', 'OK'], revise: [good] });
    const out = await generate({ session, place, island, provider: p, config });
    expect(out.revisions).toBe(1);
    expect(p.calls.find((c) => c.stage === 'revise')!.prompt).toMatch(/continuity: The cove has no hut/);
  });

  it('gives up after maxRevisions', async () => {
    const bad = good.replace('soft morning light', 'a storm');
    const p = fake({ outline: ['o'], draft: [bad], critic: ['OK'], revise: [bad] });
    await expect(generate({ session, place, island, provider: p, config })).rejects.toThrow(/still failing after 3 revisions/);
  });

  it('stops when estimated spend would exceed a stage share', async () => {
    const p = fake({ outline: ['o'], draft: [good], critic: ['OK'], revise: [good] }, { inputTokens: 1_000_000, outputTokens: 100 });
    await expect(generate({ session, place, island, provider: p, config })).rejects.toBeInstanceOf(CostCapError);
  });

  it('stops before the first call when the weekly cap is already spent', async () => {
    const p = fake({ outline: ['o'], draft: [good], critic: ['OK'], revise: [good] });
    await expect(generate({ session, place, island, provider: p, config, spentUsd: 5 })).rejects.toBeInstanceOf(CostCapError);
    expect(p.calls).toHaveLength(0);
  });

  it('exposes the spend of a failed attempt (including earlier weekly spend) on the error', async () => {
    const bad = 'You will cure your anxiety.';
    const p = fake({ outline: ['o'], draft: [bad], critic: ['OK'], revise: [bad] });
    const err = await Promise.resolve(generate({ session, place, island, provider: p, config, spentUsd: 1 })).then(() => null, (e: unknown) => e as { message: string; spentUsd: number });
    expect(err?.message).toMatch(/still failing/);
    expect(err?.spentUsd).toBeGreaterThan(1);
  });
});

describe('critic checks', () => {
  it('flags clichés and near-copies of recent scripts', () => {
    expect(criticChecks('A tapestry of sound.', [], config)[0]).toMatch(/cliché/);
    const issues = criticChecks(good, [{ day: 1, text: good }], config);
    expect(issues[0]).toMatch(/too similar to the script for day 1/);
    expect(similarity('one two three four five six', 'nothing in common here at all ever')).toBe(0);
  });
});

describe('nextSession', () => {
  it('returns the first session without a script', () => {
    const cur = { sessions: [{ day: 1 }, { day: 8 }] };
    expect(nextSession(cur, 'tests/fixtures/none')).toEqual({ day: 1 });
  });
});

describe('world context', () => {
  it('reaches the critic with sensory fields and island rules', async () => {
    const rich = { name: 'Pine Shade', description: 'Shade.', timeOfDay: 'early afternoon', sights: ['dappled pines'] };
    const p = fake({ outline: ['o'], draft: [good], critic: ['OK'], revise: [good] });
    await generate({ session, place: rich, island: { summary: 'S', rules: ['No palms'] }, provider: p, config });
    const critic = p.calls.find((c) => c.stage === 'critic')!.prompt;
    expect(critic).toMatch(/early afternoon/);
    expect(critic).toMatch(/dappled pines/);
    expect(critic).toMatch(/No palms/);
    expect(worldContext(rich, { summary: 'S' })).toMatch(/Time of day \(fixed\): early afternoon/);
  });
});

describe('main', () => {
  it('refuses to overwrite an existing script and makes no model calls', async () => {
    const root = mkdtempSync(join(tmpdir(), 'sessions-'));
    mkdirSync(join(root, '001'));
    writeFileSync(join(root, '001', 'script.md'), 'human edits');
    const p = fake({ outline: ['o'], draft: [good], critic: ['OK'], revise: [good] });
    expect(await main(['--day', '1'], p, root)).toBe(1);
    expect(p.calls).toHaveLength(0);
    expect(readFileSync(join(root, '001', 'script.md'), 'utf8')).toBe('human edits');
  });
});
