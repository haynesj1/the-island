import { describe, expect, it } from 'vitest';
import { isReleased, localDateString, parseScript, programmeDay, todaysSession, type SessionInfo } from '../src/lib/sessions';

const s = (slug: string, day: number): SessionInfo => ({ slug, day, title: slug, audio: `/audio/${slug}.mp3` });

describe('programmeDay', () => {
  it('is day 1 on the start date', () => expect(programmeDay('2026-11-16', '2026-11-16')).toBe(1));
  it('counts days since the start', () => expect(programmeDay('2026-11-16', '2026-11-23')).toBe(8));
  it('treats a future or invalid start as day 1', () => {
    expect(programmeDay('2026-12-01', '2026-11-16')).toBe(1);
    expect(programmeDay('nonsense', '2026-11-16')).toBe(1);
  });
  it('caps at the programme length', () => expect(programmeDay('2026-01-01', '2027-06-01')).toBe(100));
  it('is not thrown by a clock change', () => expect(programmeDay('2026-03-28', '2026-03-30')).toBe(3));
});

describe('localDateString', () => {
  it('uses the local calendar date, zero-padded', () => expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05'));
});

describe("todaysSession", () => {
  const list = [s('002', 8), s('placeholder', 0), s('001', 1), s('003', 15)];
  it('picks the latest session whose day has arrived', () => {
    expect(todaysSession(list, 1)?.slug).toBe('001');
    expect(todaysSession(list, 7)?.slug).toBe('001');
    expect(todaysSession(list, 8)?.slug).toBe('002');
    expect(todaysSession(list, 100)?.slug).toBe('003');
  });
  it('falls back to the placeholder while nothing real is published', () => {
    expect(todaysSession([s('placeholder', 0)], 5)?.slug).toBe('placeholder');
  });
  it('falls back to the earliest session if none has arrived', () => expect(todaysSession([s('002', 8)], 1)?.slug).toBe('002'));
  it('returns undefined with no sessions', () => expect(todaysSession([], 3)).toBeUndefined());
});

describe('parseScript', () => {
  const text = '---\nday: 0\ntitle: A title: with colon\naudio: /a.wav\n---\n# Heading\n\nFirst line. [PAUSE 3 s]\n\nSecond\npara. [SILENCE 10 s]\n';
  it('reads front matter and title', () => {
    const p = parseScript(text);
    expect(p.meta.audio).toBe('/a.wav');
    expect(p.title).toBe('A title: with colon');
  });
  it('drops directives, headings and front matter from the transcript', () => {
    expect(parseScript(text).transcript).toEqual(['First line.', 'Second para.']);
  });
  it('falls back to the heading for a title', () => expect(parseScript('# Only heading\n\nHi.').title).toBe('Only heading'));
});

describe('isReleased', () => {
  it('is true only with released: true', () => {
    expect(isReleased(parseScript('---\nreleased: true\n---\n# T\n\nHi.').meta)).toBe(true);
    expect(isReleased(parseScript('---\nday: 1\n---\n# T\n\nHi.').meta)).toBe(false);
    expect(isReleased({})).toBe(false);
  });
});
