import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assemble, checkLoudness, httpProvider, LoudnessError, main, measure, segments, transcript, voiceScript } from '../scripts/voice-script.mjs';

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

describe('main (command line)', () => {
  afterEach(() => vi.restoreAllMocks());
  const quiet = () => vi.spyOn(console, 'error').mockImplementation(() => {});
  // A temporary project root holding the config and a day-007 script.
  const project = (voiceId: string) => {
    const root = mkdtempSync(join(tmpdir(), 'voice-main-'));
    mkdirSync(join(root, 'scripts'), { recursive: true });
    mkdirSync(join(root, 'content/sessions/007'), { recursive: true });
    writeFileSync(join(root, 'scripts/pipeline.config.json'), JSON.stringify({ ...config, voice: { ...config.voice, voiceId } }));
    writeFileSync(join(root, 'content/sessions/007/script.md'), short);
    return root;
  };

  it('rejects a missing or non-numeric day with exit code 2', async () => {
    quiet();
    expect(await main([], { VOICE_API_KEY: 'k' })).toBe(2);
    expect(await main(['--day', 'abc'], { VOICE_API_KEY: 'k' })).toBe(2);
  });

  it('exits 1 when VOICE_API_KEY is not set', async () => {
    quiet();
    expect(await main(['--day', '7'], {}, project('v'))).toBe(1);
  });

  it('exits 1 when the narrator voice is not configured', async () => {
    quiet();
    const root = project('');
    expect(await main(['--day', '7', '--out', join(root, 'out')], { VOICE_API_KEY: 'k' }, root)).toBe(1);
  });

  it('exits 1 when the script for the day does not exist', async () => {
    quiet();
    const root = project('v');
    expect(await main(['--day', '8'], { VOICE_API_KEY: 'k' }, root)).toBe(1);
  });

  it('pads the day, voices the script and writes audio and transcript to --out', async () => {
    quiet();
    const provider = fakeProvider();
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      urls.push(url);
      const pcm = await provider.synthesize(JSON.parse(init.body).text);
      return { ok: true, arrayBuffer: async () => pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength) };
    });
    const root = project('narrator');
    const out = join(root, 'out');
    const code = await main(['--day', '7', '--out', out], { VOICE_API_KEY: 'k' }, root);
    vi.unstubAllGlobals();
    expect(code).toBe(0);
    expect(urls.length).toBe(3);
    expect(urls[0]).toContain('/narrator?');
    expect(existsSync(join(out, 'session.mp3'))).toBe(true);
    expect(readFileSync(join(out, 'transcript.txt'), 'utf8')).toBe('# Title\n\nHello there.\n\nSecond line.\n\nEnd.\n');
  });
});
