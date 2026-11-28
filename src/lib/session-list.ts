import { isReleased, parseScript, type SessionInfo } from './sessions';

const scripts = import.meta.glob('/content/sessions/*/script.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Every released session (front matter `released: true`) in content/sessions/<slug>/script.md, in programme order. Drafts without it stay unpublished. */
export function listSessions(): (SessionInfo & { transcript: string[] })[] {
  return Object.entries(scripts)
    .filter(([, text]) => isReleased(parseScript(text).meta))
    .map(([path, text]) => {
      const slug = path.split('/').slice(-2, -1)[0];
      const { meta, title, transcript } = parseScript(text);
      const day = Number(meta.day ?? (/^\d+$/.test(slug) ? slug : 0));
      const minutes = Number(meta.speech_minutes);
      return { slug, day, title, audio: meta.audio ?? `/audio/${slug}.mp3`, minutes: Number.isFinite(minutes) ? Math.round(minutes) : undefined, transcript };
    })
    .sort((a, b) => a.day - b.day);
}
