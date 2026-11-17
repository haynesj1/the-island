#!/usr/bin/env node
// Safety lint for session scripts (Markdown). Rules come from docs/script-guardrails.md.
// Usage: node scripts/lint-script.mjs <file.md|dir> [...]
// Each script starts with front matter naming its curriculum entry:
//   ---
//   speech_minutes: 8
//   max_silence_seconds: 20
//   ---
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORDS_PER_MINUTE = 105;
const BUDGET_TOLERANCE = 0.1;

const imagery = [
  'submerge', 'submerged', 'submersion', 'sinking', 'sink', 'sinks', 'drown', 'drowning', 'deep water', 'dark water', 'darkness', 'dark',
  'storm', 'storms', 'stormy', 'thunder', 'lightning', 'rip tide', 'rip tides',
  'cave', 'caves', 'tunnel', 'tunnels', 'small room', 'cellar', 'cupboard', 'closet',
  'cliff', 'cliffs', 'cliff edge', 'ledge', 'precipice',
  'stranded', 'lost', 'trapped', 'no way off', 'no way out',
  'heavy', 'heaviness', "can't move", 'cannot move', 'dissolve', 'dissolving', 'no longer separate', 'float out of your body', 'floating out of your body',
  'injury', 'injured', 'illness', 'sick', 'death', 'dead', 'die', 'abandoned', 'threat', 'sudden noise', 'suddenly',
];
const body = [
  'heartbeat', 'heart beat', 'hold your breath', 'holding your breath', 'breath-holding', 'count your breaths', 'counting your breaths', 'count each breath',
  'scan your chest', 'scan your throat', 'scan your abdomen', 'scan your stomach',
];
const memory = ['painful memory', 'painful memories', 'inner child', 'sit with your fear', 'recall a time', 'remember a time when you'];
const phrases = ['close your eyes', 'breathe deeply', 'deep breath', 'relax now', 'let go completely', 'you are completely safe'];
const claims = [
  'treat', 'treats', 'treatment', 'cure', 'cures', 'reduce anxiety', 'reduces anxiety', 'therapy', 'therapeutic', 'cbt', 'clinically proven',
  'anxiety disorder', 'depression', 'ptsd', 'panic disorder', 'insomnia', 'in just minutes', 'in 7 days', 'in a week',
];
const us = {
  color: 'colour', colors: 'colours', favorite: 'favourite', neighbor: 'neighbour', center: 'centre', gray: 'grey', realize: 'realise',
  realized: 'realised', recognize: 'recognise', imagine: null, harbor: 'harbour', honor: 'honour', flavor: 'flavour', odor: 'odour',
  meter: 'metre', theater: 'theatre', fiber: 'fibre', organize: 'organise', apologize: 'apologise', cozy: 'cosy', mom: 'mum',
  vapor: 'vapour', labor: 'labour', rumor: 'rumour', humor: 'humour', skeptical: 'sceptical', pajamas: 'pyjamas', aluminum: 'aluminium',
};
delete us.imagine;

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (list) => new RegExp(`(?<![\\w'-])(${list.map(esc).join('|')})(?![\\w-])`, 'gi');

const TOKEN = /\[(PAUSE|SILENCE) (\d+) s\]/g;
const ANY_BRACKET = /\[[^\]]*\]/g;

function parse(text) {
  const lines = text.split(/\r?\n/);
  const meta = {};
  let start = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) {
      for (const l of lines.slice(1, end)) {
        const m = /^(\w+):\s*(.*)$/.exec(l.trim());
        if (m) meta[m[1]] = m[2].trim();
      }
      start = end + 1;
    }
  }
  return { lines, meta, start };
}

/** @returns {{line:number, rule:string, message:string}[]} */
export function lintScript(text) {
  const out = [];
  const add = (line, rule, message) => out.push({ line, rule, message });
  const { lines, meta, start } = parse(text);

  // Spoken lines: everything after front matter, excluding headings and blank lines.
  const spoken = [];
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim() || /^#{1,6}\s/.test(l)) continue;
    spoken.push({ n: i + 1, text: l.replace(TOKEN, ' ') });
  }

  const scan = (list, rule, label) => {
    const re = wordRe(list);
    for (const s of spoken) for (const m of s.text.matchAll(re)) add(s.n, rule, `${label}: "${m[0]}"`);
  };
  scan(imagery, 'imagery', 'banned imagery');
  scan(body, 'body-and-breath', 'banned body or breath focus');
  scan(memory, 'memories', 'banned memory work');
  scan(phrases, 'banned-phrase', 'banned phrase');
  scan(claims, 'claims', 'banned claim');
  scan(Object.keys(us), 'uk-spelling', 'US spelling');
  // Add the UK suggestion to US-spelling messages.
  for (const f of out) {
    if (f.rule !== 'uk-spelling') continue;
    const w = /"(.+)"/.exec(f.message)[1].toLowerCase();
    f.message += ` (use "${us[w]}")`;
  }

  // Pause tokens: only [PAUSE n s] / [SILENCE n s]; no silence over the phase maximum.
  const maxSilence = Number(meta.max_silence_seconds);
  for (let i = start; i < lines.length; i++) {
    for (const b of lines[i].matchAll(ANY_BRACKET)) {
      const m = /^\[(PAUSE|SILENCE) (\d+) s\]$/.exec(b[0]);
      if (!m) add(i + 1, 'tokens', `only [PAUSE n s] and [SILENCE n s] tokens are allowed, found "${b[0]}"`);
      else if (Number.isFinite(maxSilence) && Number(m[2]) > maxSilence) {
        add(i + 1, 'silence-max', `${m[1]} ${m[2]} s is over this phase's maximum of ${maxSilence} s`);
      }
    }
    // Ellipsis or voice tags as silence are not allowed.
    if (i >= start && /(\.{3}|…)/.test(lines[i])) add(i + 1, 'tokens', 'silence must use [PAUSE n s] / [SILENCE n s], not ellipses');
    if (i >= start && /<[^>]+>/.test(lines[i])) add(i + 1, 'tokens', 'no voice or SSML tags; silences are added at assembly');
  }

  // Word budget.
  const minutes = Number(meta.speech_minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    add(1, 'budget', 'front matter needs speech_minutes (a number) from the curriculum entry');
  } else {
    if (!Number.isFinite(maxSilence)) add(1, 'silence-max', 'front matter needs max_silence_seconds (a number) from the curriculum entry');
    const words = spoken.reduce((n, s) => n + (s.text.match(/[\p{L}\p{N}'’-]+/gu)?.length ?? 0), 0);
    const budget = minutes * WORDS_PER_MINUTE;
    if (words > budget * (1 + BUDGET_TOLERANCE) || words < budget * (1 - BUDGET_TOLERANCE)) {
      add(1, 'budget', `${words} words; budget is ${budget} (${minutes} min x ${WORDS_PER_MINUTE}) give or take ${BUDGET_TOLERANCE * 100}%`);
    }
  }

  // Structure. Positions are by share of spoken text.
  const total = spoken.length;
  const at = (a, b) => spoken.filter((_, i) => i >= Math.floor(total * a) && i < Math.ceil(total * b));
  const find = (rows, re) => rows.find((r) => re.test(r.text));
  const need = (rows, re, rule, msg) => { if (!find(rows, re)) add(rows[0]?.n ?? 1, rule, msg); };
  if (total === 0) {
    add(1, 'structure', 'script has no spoken text');
  } else {
    const opening = at(0, 0.25);
    const closing = at(0.75, 1);
    const stop = /(stop|pause|open your eyes|open them|step away)/i;
    need(opening, /(eyes (open|closed)|open or closed|closed or open)/i, 'structure-opening-choice', 'opening must offer a choice of eyes open or closed');
    need(opening, /(anchor|rest your attention|rest your gaze|settle your attention)/i, 'structure-opening-choice', 'opening must offer an anchor for attention');
    need(opening, stop, 'structure-permission-start', 'opening must give permission to pause, open the eyes or stop');
    need(at(0.4, 0.6), stop, 'structure-permission-midway', 'midway must again give permission to pause, open the eyes or stop');
    need(closing, /(feet|seat|chair|ground)/i, 'structure-closing-grounding', 'closing must ground through feet or seat');
    need(closing, /(sound|hear)/i, 'structure-closing-grounding', 'closing must invite noticing three sounds in the room');
    need(closing, /fingers/i, 'structure-closing-grounding', 'closing must mention fingers and toes');
    need(closing, /(open your eyes|eyes open).*(own time|when you(.re| are) ready)|(own time|when you(.re| are) ready).*(open your eyes|eyes open)/i, 'structure-closing-grounding', 'closing must invite opening the eyes in your own time');
    need(spoken, /(not while driving|while driving|if you are driving|behind the wheel)/i, 'structure-driving-notice', 'a "not while driving" notice is required');
    if (!find(at(0, 0.2), /driving/i) && find(spoken, /driving/i)) add(find(spoken, /driving/i).n, 'structure-driving-notice', 'the "not while driving" notice must come at the start');
  }

  return out.sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
}

function files(p) {
  if (!statSync(p).isDirectory()) return [p];
  return readdirSync(p, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(p, e.name)) : /\.md$/.test(e.name) ? [join(p, e.name)] : []));
}

export function main(argv) {
  if (!argv.length) {
    console.error('usage: lint-script.mjs <file.md|dir> [...]');
    return 2;
  }
  const targets = argv.flatMap(files);
  let failures = 0;
  for (const f of targets) {
    for (const r of lintScript(readFileSync(f, 'utf8'))) {
      console.error(`${f}:${r.line}: [${r.rule}] ${r.message}`);
      failures++;
    }
  }
  console.error(failures ? `\n${failures} failure(s)` : `ok: ${targets.length} script(s) pass`);
  return failures ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
