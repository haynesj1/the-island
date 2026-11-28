import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assemble, checkLoudness, httpProvider, LoudnessError, measure, segments, transcript, voiceScript } from '../scripts/voice-script.mjs';

const config = JSON.parse(readFileSync('scripts/pipeline.config.json', 'utf8'));
const short = '---\nspeech_minutes: 1\nmax_silence_seconds: 20\n---\n# Title\n\nHello there. [PAUSE 2 s]\n\nSecond line.   [SILENCE 3 s]\n\nEnd.\n';
// Fake voice: a quiet 220 Hz tone, 0.5 s per word, and a record of every call.
const fakeProvider = (level = 3000) => {
  const calls: string[] = [];
  return {
    calls,
    async synthesize(t: string) {
      calls.push(t);
      const n = Math.round(t.split(' ').length * 0.5 * config.voice.sampleRate);
      const b = Buffer.alloc(n * 2);
      for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(level * Math.sin((2 * Math.PI * 220 * i) / config.voice.sampleRate)), i * 2);
      return b;
    },
  };
};

describe('segments and transcript', () => {
  it('splits speech from gaps and skips headings', () => {
    expect(segments(short)).toEqual([
      { type: 'speech', text: 'Hello there.' }, { type: 'gap', seconds: 2 },
      { type: 'speech', text: 'Second line.' }, { type: 'gap', seconds: 3 },
      { type: 'speech', text: 'End.' },
    ]);
  });
  it('removes tokens and front matter from the transcript', () => {
    const t = transcript(short);
    expect(t).not.toMatch(/\[|speech_minutes/);
    expect(t).toBe('# Title\n\nHello there.\n\nSecond line.\n\nEnd.\n');
  });
});

describe('assemble', () => {
  it('turns gaps into exact lengths of silence', () => {
    const pcm = assemble([{ type: 'speech', pcm: Buffer.alloc(200) }, { type: 'gap', seconds: 2 }], 1000);
    expect(pcm.length).toBe(200 + 2 * 1000 * 2);
    expect(pcm.subarray(200).every((x) => x === 0)).toBe(true);
  });
});

describe('voiceScript', () => {
  it('voices with the fixed config, masters to target and writes the transcript', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'voice-'));
    const p = fakeProvider();
    const r = await voiceScript({ text: short, provider: p, config, outDir });
    expect(p.calls).toEqual(['Hello there.', 'Second line.', 'End.']);
    expect(existsSync(r.audioFile)).toBe(true);
    expect(readFileSync(r.transcriptFile, 'utf8')).toBe(transcript(short));
    const m = measure(r.audioFile);
    expect(Math.abs(m.lufs + 16)).toBeLessThanOrEqual(1);
    expect(m.truePeak).toBeLessThanOrEqual(-1);
  }, 60000);
  it('fails the run when the audio cannot be brought to target (silence only)', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'voice-'));
    await expect(voiceScript({ text: '[SILENCE 2 s]\n', provider: fakeProvider(), config, outDir })).rejects.toThrow();
  }, 60000);
});

describe('checkLoudness', () => {
  it('rejects off-target loudness and hot peaks, accepts in-range', () => {
    expect(() => checkLoudness({ lufs: -16.4, truePeak: -1.2 }, config.audio)).not.toThrow();
    expect(() => checkLoudness({ lufs: -20, truePeak: -3 }, config.audio)).toThrow(LoudnessError);
    expect(() => checkLoudness({ lufs: -16, truePeak: -0.2 }, config.audio)).toThrow(LoudnessError);
    expect(() => checkLoudness({ lufs: -Infinity, truePeak: -Infinity }, config.audio)).toThrow(LoudnessError);
  });
});

describe('httpProvider', () => {
  it('sends the configured model, voice, seed and settings every time, and needs a voice id', async () => {
    const bodies: Record<string, unknown>[] = [];
    const f = (async (_u: string, init: { body: string }) => { bodies.push(JSON.parse(init.body)); return new Response(new Uint8Array(4)); }) as unknown as typeof fetch;
    const voice = { ...config.voice, voiceId: 'abc' };
    const p = httpProvider(voice, 'k', f);
    await p.synthesize('a'); await p.synthesize('b');
    expect(bodies[0]).toMatchObject({ model_id: voice.model, seed: voice.seed, voice_settings: voice.settings });
    expect({ ...bodies[0], text: '' }).toEqual({ ...bodies[1], text: '' });
    await expect(httpProvider(config.voice, 'k', f).synthesize('a')).rejects.toThrow(/voiceId/);
  });
});
