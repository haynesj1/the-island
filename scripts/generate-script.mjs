#!/usr/bin/env node
// Draft generator: next unwritten curriculum session -> outline -> draft -> critic -> revise -> lint.
// Writes content/sessions/<day>/script.md locally. Nothing is voiced or published.
// Usage: node scripts/generate-script.mjs [--day N] [--spent-usd X] [--spend-out FILE] [--dry-run]
// The only secret read is ANTHROPIC_API_KEY (environment); agents never handle it.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintScript } from './lint-script.mjs';

export class CostCapError extends Error {}

const CLICHES = ['tapestry', 'symphony of', 'dance of', 'whisper of', 'kaleidoscope of', 'embrace', 'journey within', 'inner peace', 'tranquil oasis', 'paradise', 'melt away', 'wash over you', 'dive deeper'];
const words = (t) => t.toLowerCase().match(/[\p{L}\p{N}'-]+/gu) ?? [];

/** Directory name for a day: zero-padded to three digits so listings sort. */
export const dayDir = (day) => String(day).padStart(3, '0');

/** First curriculum session with no script yet. */
export function nextSession(curriculum, root = 'content/sessions') {
  return curriculum.sessions.find((s) => !existsSync(join(root, dayDir(s.day), 'script.md')));
}

/** Full world-bible constraints for a place plus the island-wide rules (fixed sensory continuity). */
export function worldContext(place, island) {
  const list = (label, v) => (v?.length ? `${label}: ${[].concat(v).join('; ')}\n` : '');
  return `Place: ${place.name}. ${place.description}\n` +
    list('Sights', place.sights) + list('Sounds', place.sounds) + list('Textures', place.textures) + list('Smells', place.smells) +
    list('Time of day (fixed)', place.timeOfDay) + list('Light', place.light) + list('Feeling', place.feeling) +
    `Island: ${island.summary}\n` + list('Island rules', island.rules);
}

/** Share of the candidate's 5-word runs that also appear in `other` (0 to 1). */
export function similarity(a, b) {
  const grams = (t) => {
    const w = words(t);
    return new Set(w.slice(0, Math.max(w.length - 4, 0)).map((_, i) => w.slice(i, i + 5).join(' ')));
  };
  const ga = grams(a);
  const gb = grams(b);
  if (!ga.size) return 0;
  let hit = 0;
  for (const g of ga) if (gb.has(g)) hit++;
  return hit / ga.size;
}

/** Strip any front matter the model emitted and attach the curriculum's own. */
export function withFrontMatter(body, session) {
  const clean = body.replace(/^\s*---[\s\S]*?\n---\s*\n/, '').trim();
  return `---\nspeech_minutes: ${session.speechMinutes}\nmax_silence_seconds: ${session.maxSilenceSeconds}\n---\n${clean}\n`;
}

/** Deterministic critic checks (similarity, clichés). Safety, claims and budget come from the lint. */
export function criticChecks(text, recent, config) {
  const issues = [];
  const lower = text.toLowerCase();
  for (const c of CLICHES) if (lower.includes(c)) issues.push(`cliché: "${c}"`);
  for (const r of recent) {
    const s = similarity(text, r.text);
    if (s > config.similarityLimit) issues.push(`too similar to the script for day ${r.day} (${Math.round(s * 100)}% shared phrasing)`);
  }
  return issues;
}

/** Tracks estimated spend against per-stage shares of the cap. */
export function makeBudget(config, spentUsd = 0) {
  const spent = { outline: 0, draft: 0, critic: 0, revise: 0 };
  const cost = (inTok, outTok) => (inTok * config.pricing.inputPerMTokUsd + outTok * config.pricing.outputPerMTokUsd) / 1e6;
  return {
    spent,
    total: () => spentUsd + Object.values(spent).reduce((a, b) => a + b, 0),
    /** Throws before a call whose worst-case cost would break the stage share or the whole cap. */
    check(stage, prompt, maxTokens) {
      const est = cost(Math.ceil(prompt.length / 3), maxTokens);
      const stageCap = config.weeklyCapUsd * config.stageShare[stage];
      if (spent[stage] + est > stageCap) throw new CostCapError(`${stage} stage would exceed its share ($${stageCap.toFixed(2)}); stopping`);
      if (this.total() + est > config.weeklyCapUsd) throw new CostCapError(`pipeline would exceed the weekly cap ($${config.weeklyCapUsd}); stopping`);
    },
    record(stage, usage) { spent[stage] += cost(usage.inputTokens, usage.outputTokens); },
  };
}

/**
 * Run the pipeline. `provider.complete({ stage, system, prompt, maxTokens })` returns
 * `{ text, inputTokens, outputTokens }`; tests pass a fake.
 * @returns {{ text:string, revisions:number, spentUsd:number }} lint-clean script text.
 */
export async function generate({ session, place, island, recent = [], provider, config, spentUsd = 0 }) {
  const budget = makeBudget(config, spentUsd);
  try {
    return await generateWith({ session, place, island, recent, provider, config, budget });
  } catch (e) {
    // Failed attempts still cost money: expose the spend so callers can persist it.
    if (e && typeof e === 'object') e.spentUsd = budget.total();
    throw e;
  }
}

async function generateWith({ session, place, island, recent, provider, config, budget }) {
  const call = async (stage, system, prompt) => {
    const maxTokens = config.maxOutputTokens[stage];
    budget.check(stage, system + prompt, maxTokens);
    const r = await provider.complete({ stage, system, prompt, maxTokens });
    budget.record(stage, r);
    return r.text;
  };
  const brief = `Session ${session.id}, day ${session.day}. Theme: ${session.theme}\n${worldContext(place, island)}` +
    `Speech length: ${session.speechMinutes} minutes, about ${session.wordBudget} words (stay within 10%). Longest silence: ${session.maxSilenceSeconds} s.`;
  const rules = 'You write guided relaxation scripts. Second person, present tense, UK spelling, invitational wording. Pauses only as [PAUSE n s] or [SILENCE n s]. ' +
    'Never claim to treat or cure anything. Follow docs/script-guardrails.md: opening choice of eyes open or closed and an anchor, permission to stop at the start and midway, gradual return, grounding, a not-while-driving notice. ' +
    'No deep water, storms, caves, darkness or cliffs. Output the spoken script body only, in Markdown, with no front matter.';

  const outline = await call('outline', rules, `Outline the session in short bullet points.\n${brief}`);
  let body = await call('draft', rules, `Write the full script from this outline.\n${brief}\nOutline:\n${outline}`);

  let revisions = 0;
  for (;;) {
    const text = withFrontMatter(body, session);
    const issues = [
      ...lintScript(text).map((f) => `lint (line ${f.line}, ${f.rule}): ${f.message}`),
      ...criticChecks(text, recent, config),
    ];
    // Model critic: continuity with the world bible. Reply "OK" or one issue per line.
    const verdict = (await call('critic', 'You check continuity only. Reply exactly OK, or list one problem per line.',
      `World bible for this place (fixed details; the script must not contradict them, including time of day and light):\n${worldContext(place, island)}\nScript:\n${body}`)).trim();
    if (verdict !== 'OK') issues.push(...verdict.split('\n').map((l) => `continuity: ${l.replace(/^[-*\s]+/, '')}`).filter((l) => l.length > 12));
    if (!issues.length) return { text, revisions, spentUsd: budget.total() };
    if (revisions >= config.maxRevisions) throw new Error(`still failing after ${revisions} revisions:\n${issues.join('\n')}`);
    body = await call('revise', rules, `${brief}\nRevise the script to fix every problem listed, changing as little else as possible.\nProblems:\n${issues.map((i) => `- ${i}`).join('\n')}\n\nScript:\n${body}`);
    revisions++;
  }
}

/** Anthropic Messages API provider. Key comes from the environment only. */
export function anthropicProvider(config, env = process.env) {
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set in the environment');
  return {
    async complete({ system, prompt, maxTokens }) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: config.model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) throw new Error(`model request failed: ${res.status}`);
      const j = await res.json();
      return { text: j.content.map((c) => c.text ?? '').join(''), inputTokens: j.usage.input_tokens, outputTokens: j.usage.output_tokens };
    },
  };
}

function recentScripts(curriculum, session, root, n) {
  return curriculum.sessions
    .filter((s) => s.day < session.day && existsSync(join(root, dayDir(s.day), 'script.md')))
    .slice(-n)
    .map((s) => ({ day: s.day, text: readFileSync(join(root, dayDir(s.day), 'script.md'), 'utf8') }));
}

export async function main(argv, provider, root = 'content/sessions') {
  const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  const config = JSON.parse(readFileSync(new URL('./pipeline.config.json', import.meta.url), 'utf8'));
  const curriculum = JSON.parse(readFileSync('content/curriculum.json', 'utf8'));
  const places = JSON.parse(readFileSync('content/places.json', 'utf8'));
  const session = arg('--day') ? curriculum.sessions.find((s) => s.day === Number(arg('--day'))) : nextSession(curriculum, root);
  if (!session) { console.error('No session to write.'); return 1; }
  const target = session && join(root, dayDir(session.day), 'script.md');
  if (session && existsSync(target)) { console.error(`Refusing to overwrite existing script: ${target}`); return 1; }
  const place = places.places.find((p) => p.id === session.place);
  try {
    const out = await generate({
      session, place, island: places.island, config,
      recent: recentScripts(curriculum, session, root, config.recentScripts),
      provider: provider ?? anthropicProvider(config),
      spentUsd: Number(arg('--spent-usd') ?? 0),
    });
    const dir = join(root, dayDir(session.day));
    mkdirSync(dir, { recursive: true });
    if (!argv.includes('--dry-run')) writeFileSync(target, out.text, { flag: 'wx' });
    if (arg('--spend-out')) writeFileSync(arg('--spend-out'), JSON.stringify({ day: session.day, revisions: out.revisions, spentUsd: out.spentUsd }));
    console.error(`Day ${session.day}: draft passes the lint after ${out.revisions} revision(s); est. spend $${out.spentUsd.toFixed(2)}. Not voiced or published; listen and approve first.`);
    return 0;
  } catch (e) {
    if (arg('--spend-out') && typeof e.spentUsd === 'number') writeFileSync(arg('--spend-out'), JSON.stringify({ day: session.day, revisions: 0, spentUsd: e.spentUsd, failed: true }));
    console.error(e instanceof CostCapError ? `Cost cap: ${e.message}` : `Failed: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
