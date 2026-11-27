/** Pure helpers for session pages and "today's session". No DOM, no storage: callers pass values in. */

export interface SessionInfo {
  slug: string;
  /** Programme day the session belongs to; 0 marks the placeholder, used only when nothing else is available. */
  day: number;
  title: string;
  audio: string;
  minutes?: number;
}

export interface ParsedScript {
  meta: Record<string, string>;
  title: string;
  /** Spoken paragraphs with pause directives removed. */
  transcript: string[];
}

const TOKEN = /\[(?:PAUSE|SILENCE) \d+ s\]/g;

export function parseScript(text: string): ParsedScript {
  const lines = text.split(/\r?\n/);
  const meta: Record<string, string> = {};
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
  const body = lines.slice(start);
  const heading = body.find((l) => /^#\s+/.test(l));
  const title = meta.title || heading?.replace(/^#\s+/, '').trim() || 'Session';
  const transcript = body
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.split('\n').filter((l) => !/^#/.test(l)).join(' ').replace(TOKEN, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return { meta, title, transcript };
}

const DAY_MS = 86_400_000;

/** Local calendar date as YYYY-MM-DD (not UTC, so the day changes at the listener's midnight). */
export function localDateString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Programme day (1-based) for a device start date; invalid or future starts count as day 1. Capped at totalDays. */
export function programmeDay(startDate: string, today: string, totalDays = 100): number {
  const parse = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  };
  const diff = Math.round((parse(today) - parse(startDate)) / DAY_MS);
  if (!Number.isFinite(diff) || diff < 0) return 1;
  return Math.min(diff + 1, totalDays);
}

/**
 * Today's session: the latest published session whose day has arrived. Sessions come about weekly,
 * so between them the listener is offered the most recent one. If none has arrived (or only the
 * placeholder exists) fall back to the earliest available session.
 */
export function todaysSession(sessions: SessionInfo[], day: number): SessionInfo | undefined {
  const sorted = [...sessions].sort((a, b) => a.day - b.day);
  const arrived = sorted.filter((s) => s.day <= day);
  return arrived[arrived.length - 1] ?? sorted[0];
}
