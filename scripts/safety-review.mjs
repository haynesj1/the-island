#!/usr/bin/env node
// Separate model safety review of a finished draft against docs/script-guardrails.md.
// Runs after scripts/generate-script.mjs in the weekly workflow; it only reports, never edits the script.
// Usage: node scripts/safety-review.mjs --day N [--spent-usd X] [--spend-file FILE] [--body-out FILE] [--review-out FILE]
// The only secret read is ANTHROPIC_API_KEY (environment); agents never handle it.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CostCapError, anthropicProvider, dayDir } from './generate-script.mjs';

const SYSTEM = 'You are an independent safety reviewer of guided relaxation scripts. You did not write the script. ' +
  'Judge it only against the guardrails you are given: imagery, language, structure, pacing and claims. Be strict: anxious listeners are the most likely to be harmed. ' +
  'Reply with exactly PASS on its own if nothing breaks a guardrail. Otherwise reply with one finding per line, each starting "- ", naming the guardrail and quoting the offending words. No other text.';

/**
 * Ask the model for a safety review. `provider.complete({ stage, system, prompt, maxTokens })` as in the generator.
 * Anything other than an exact "PASS" counts as findings, so an odd reply never reads as clear.
 * @returns {{ pass: boolean, findings: string[], spentUsd: number }}
 */
export async function reviewScript({ text, guardrails, provider, config, spentUsd = 0 }) {
  const prompt = `Guardrails:\n${guardrails}\n\nScript to review:\n${text}`;
  const maxTokens = config.maxOutputTokens.safety;
  const price = config.pricing;
  const est = (Math.ceil((SYSTEM + prompt).length / 3) * price.inputPerMTokUsd + maxTokens * price.outputPerMTokUsd) / 1e6;
  if (spentUsd + est > config.weeklyCapUsd) throw new CostCapError(`safety review would exceed the weekly cap ($${config.weeklyCapUsd}); stopping`);
  const r = await provider.complete({ stage: 'safety', system: SYSTEM, prompt, maxTokens });
  const reply = r.text.trim();
  const cost = (r.inputTokens * price.inputPerMTokUsd + r.outputTokens * price.outputPerMTokUsd) / 1e6;
  if (reply === 'PASS') return { pass: true, findings: [], spentUsd: spentUsd + cost };
  const findings = reply.split('\n').map((l) => l.replace(/^[-*\s]+/, '').trim()).filter(Boolean);
  return { pass: false, findings: findings.length ? findings : ['The reviewer gave an empty reply; treat as not reviewed.'], spentUsd: spentUsd + cost };
}

/** Text of the review as posted on the PR. */
export function formatReview(review) {
  if (review.pass) return '🤖 Safety review (separate model pass against docs/script-guardrails.md): **no findings**. This does not replace listening: Jordan listens before approving.';
  return `🤖 Safety review (separate model pass against docs/script-guardrails.md): **${review.findings.length} finding(s)**. Do not approve until each is resolved or judged a false alarm.\n\n${review.findings.map((f) => `- ${f}`).join('\n')}`;
}

/** PR body: what this is, the lint and review results, and what Jordan has to do. */
export function formatPrBody({ session, revisions, spentUsd, review }) {
  return `Weekly draft for day ${session.day}: ${session.theme}\n\n` +
    `Adds \`content/sessions/${dayDir(session.day)}/script.md\`. Nothing is voiced or published until Jordan listens and merges this PR.\n\n` +
    `- Automated safety lint: passed (after ${revisions} revision(s)).\n` +
    `- Model safety review: ${review.pass ? 'no findings' : `${review.findings.length} finding(s), see the comment below`}.\n` +
    `- Estimated model spend this run: $${spentUsd.toFixed(2)}.\n\n` +
    `**Owner step:** read the script and the review, then merge to approve (or close to reject).\n`;
}

export async function main(argv, provider, root = 'content/sessions') {
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const config = JSON.parse(readFileSync(new URL('./pipeline.config.json', import.meta.url), 'utf8'));
  const day = Number(arg('--day'));
  const session = JSON.parse(readFileSync('content/curriculum.json', 'utf8')).sessions.find((s) => s.day === day);
  if (!session) { console.error('Unknown --day.'); return 1; }
  const spend = arg('--spend-file') ? JSON.parse(readFileSync(arg('--spend-file'), 'utf8')) : { revisions: 0, spentUsd: Number(arg('--spent-usd') ?? 0) };
  try {
    const text = readFileSync(join(root, dayDir(day), 'script.md'), 'utf8');
    const guardrails = readFileSync('docs/script-guardrails.md', 'utf8');
    const review = await reviewScript({ text, guardrails, provider: provider ?? anthropicProvider(config), config, spentUsd: spend.spentUsd });
    writeFileSync(arg('--body-out') ?? 'pr-body.md', formatPrBody({ session, revisions: spend.revisions, spentUsd: review.spentUsd, review }));
    writeFileSync(arg('--review-out') ?? 'review.md', formatReview(review) + '\n');
    if (arg('--spend-file')) writeFileSync(arg('--spend-file'), JSON.stringify({ ...spend, spentUsd: review.spentUsd }));
    console.error(review.pass ? 'Safety review: no findings.' : `Safety review: ${review.findings.length} finding(s); they go on the PR.`);
    return 0;
  } catch (e) {
    if (arg('--spend-file') && typeof e.spentUsd === 'number') writeFileSync(arg('--spend-file'), JSON.stringify({ ...spend, spentUsd: e.spentUsd }));
    console.error(e instanceof CostCapError ? `Cost cap: ${e.message}` : `Failed: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
