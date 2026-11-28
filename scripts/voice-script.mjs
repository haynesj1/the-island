#!/usr/bin/env node
// Voice an approved script: one narrator voice -> pauses and silences -> mastered audio -> transcript.
// Usage: node scripts/voice-script.mjs --day N [--out DIR]
// The only secret read is VOICE_API_KEY (environment); agents never handle it. Nothing is published here.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export class LoudnessError extends Error {}

const TOKEN = /\[(?:PAUSE|SILENCE) (\d+) s\]/g;
const dayDir = (day) => String(day).padStart(3, '0');

/** Drop the front matter, leaving the script body. */
export function body(text) {
  return text.replace(/^\s*---[\s\S]*?\n---\s*\n/, '');
}

/** Split a script into ordered segments: {type:'speech', text} or {type:'gap', seconds}. Headings are not spoken. */
export function segments(text) {
  const out = [];
  const speech = (s) => {
    const t = s.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join(' ').replace(/\s+/g, ' ').trim();
    if (t) out.push({ type: 'speech', text: t });
  };
  let last = 0;
  const b = body(text);
  for (const m of b.matchAll(TOKEN)) {
    speech(b.slice(last, m.index));
    out.push({ type: 'gap', seconds: Number(m[1]) });
    last = m.index + m[0].length;
  }
  speech(b.slice(last));
  return out;
}

/** The transcript: the script with pause and silence tokens removed. */
export function transcript(text) {
  return body(text).replace(TOKEN, '').replace(/[ \t]+$/gm, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

/** Join 16-bit mono PCM pieces, turning gaps into digital silence. */
export function assemble(parts, sampleRate) {
  return Buffer.concat(parts.map((p) => (p.type === 'gap' ? Buffer.alloc(Math.round(p.seconds * sampleRate) * 2) : p.pcm)));
}

/** Wrap 16-bit mono PCM in a WAV header. */
export function wav(pcm, sampleRate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Run ffmpeg; returns its log (stderr), throws on a non-zero exit. */
const ffmpeg = (args) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.error || r.status !== 0) throw new Error(`ffmpeg failed: ${r.error?.message ?? r.stderr.slice(-300)}`);
  return r.stderr;
};

/** Measure integrated loudness (LUFS) and true peak (dBTP) of an audio file. */
export function measure(file) {
  const log = ffmpeg(['-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const m = /\{[^{}]*"input_i"[^{}]*\}/.exec(log);
  if (!m) throw new Error('could not measure loudness');
  const j = JSON.parse(m[0]);
  return { lufs: Number(j.input_i), truePeak: Number(j.input_tp) };
}

/** Throws unless loudness and true peak meet the targets in the config. */
export function checkLoudness(m, audio) {
  if (!Number.isFinite(m.lufs) || !Number.isFinite(m.truePeak)) throw new LoudnessError('loudness could not be measured (silent audio?)');
  if (Math.abs(m.lufs - audio.targetLufs) > audio.toleranceLu) throw new LoudnessError(`loudness ${m.lufs} LUFS is not within ${audio.toleranceLu} LU of ${audio.targetLufs}`);
  if (m.truePeak > audio.maxTruePeakDb) throw new LoudnessError(`true peak ${m.truePeak} dBTP is above ${audio.maxTruePeakDb}`);
}

/** Master a WAV to the target loudness (two passes) and encode it. */
export function master(inWav, outFile, audio) {
  const target = `I=${audio.targetLufs}:TP=${audio.masterTruePeakDb}:LRA=11`;
  const log = ffmpeg(['-i', inWav, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-']);
  const m = /\{[^{}]*"input_i"[^{}]*\}/.exec(log);
  if (!m) throw new Error('could not analyse audio for mastering');
  const j = JSON.parse(m[0]);
  const second = `loudnorm=${target}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  ffmpeg(['-i', inWav, '-af', second, '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '128k', outFile]);
}

/** The real voice provider: one fixed model, voice, settings and seed from the config. */
export function httpProvider(voice, apiKey, fetchImpl = fetch) {
  return {
    async synthesize(text) {
      if (!voice.voiceId) throw new Error('voice.voiceId is not set in scripts/pipeline.config.json (Jordan chooses the narrator voice)');
      const res = await fetchImpl(`${voice.baseUrl}/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}?output_format=pcm_${voice.sampleRate}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': apiKey },
        body: JSON.stringify({ text, model_id: voice.model, seed: voice.seed, voice_settings: voice.settings }),
      });
      if (!res.ok) throw new Error(`voice provider returned ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

/** Voice one script into outDir: session.mp3, transcript.txt. Returns paths and the loudness measurement. */
export async function voiceScript({ text, provider, config, outDir }) {
  const { voice, audio } = config;
  const parts = [];
  for (const s of segments(text)) parts.push(s.type === 'gap' ? s : { type: 'speech', pcm: await provider.synthesize(s.text, voice) });
  mkdirSync(outDir, { recursive: true });
  const raw = join(outDir, 'raw.wav');
  const audioFile = join(outDir, 'session.mp3');
  writeFileSync(raw, wav(assemble(parts, voice.sampleRate), voice.sampleRate));
  master(raw, audioFile, audio);
  const loudness = measure(audioFile);
  checkLoudness(loudness, audio);
  const transcriptFile = join(outDir, 'transcript.txt');
  writeFileSync(transcriptFile, transcript(text));
  return { audioFile, transcriptFile, loudness };
}

export async function main(argv, env = process.env) {
  const i = argv.indexOf('--day');
  const o = argv.indexOf('--out');
  if (i < 0 || !/^\d+$/.test(argv[i + 1] ?? '')) { console.error('usage: voice-script.mjs --day N [--out DIR]'); return 2; }
  const day = dayDir(argv[i + 1]);
  const outDir = o >= 0 ? argv[o + 1] : join('build', 'audio', day);
  if (!env.VOICE_API_KEY) { console.error('VOICE_API_KEY is not set'); return 1; }
  const config = JSON.parse(readFileSync('scripts/pipeline.config.json', 'utf8'));
  const text = readFileSync(join('content/sessions', day, 'script.md'), 'utf8');
  try {
    const r = await voiceScript({ text, provider: httpProvider(config.voice, env.VOICE_API_KEY), config, outDir });
    console.error(`ok: ${r.audioFile} (${r.loudness.lufs} LUFS, ${r.loudness.truePeak} dBTP)`);
    return 0;
  } catch (e) {
    console.error(`voicing failed: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(await main(process.argv.slice(2)));
