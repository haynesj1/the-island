import { parseScript, type SessionInfo } from './sessions';

const scripts = import.meta.glob('/content/sessions/*/script.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Every session with a script in content/sessions/<slug>/script.md, in programme order. */
export function listSessions(): (SessionInfo & { transcript: string[] })[] {
  return Object.entries(scripts)
    .map(([path, text]) => {
      const slug = path.split('/').slice(-2, -1)[0];
      const { meta, title, transcript } = parseScript(text);
      const day = Number(meta.day ?? (/^\d+$/.test(slug) ? slug : 0));
      const minutes = Number(meta.speech_minutes);
      return { slug, day, title, audio: meta.audio ?? `/audio/${slug}.mp3`, minutes: Number.isFinite(minutes) ? Math.round(minutes) : undefined, transcript };
    })
    .sort((a, b) => a.day - b.day);
}
