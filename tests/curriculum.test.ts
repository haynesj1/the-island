import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

type Phase = { phase: number; days: [number, number]; lengthMinutes: [number, number]; maxSilenceSeconds: number };
type Session = {
  id: string; day: number; phase: number; place: string; theme: string;
  lengthMinutes: number; speechMinutes: number; wordBudget: number; maxSilenceSeconds: number;
};
const cur = JSON.parse(readFileSync('content/curriculum.json', 'utf8')) as {
  totalDays: number; wordsPerSpeechMinute: number; phases: Phase[]; sessions: Session[];
};
const places = JSON.parse(readFileSync('content/places.json', 'utf8')) as { places: { id: string; phases: number[] }[] };
const phaseOf = (n: number) => cur.phases.find((p) => p.phase === n)!;

describe('curriculum.json', () => {
  it('covers 100 days in contiguous phases', () => {
    expect(cur.totalDays).toBe(100);
    expect(cur.phases[0].days[0]).toBe(1);
    expect(cur.phases.at(-1)!.days[1]).toBe(100);
    cur.phases.slice(1).forEach((p, i) => expect(p.days[0]).toBe(cur.phases[i].days[1] + 1));
  });
  it('has about one session a week, in day order, inside its phase', () => {
    expect(cur.sessions.length).toBeGreaterThanOrEqual(13);
    expect(cur.sessions.length).toBeLessThanOrEqual(16);
    cur.sessions.slice(1).forEach((s, i) => {
      const gap = s.day - cur.sessions[i].day;
      expect(gap, s.id).toBeGreaterThanOrEqual(5);
      expect(gap, s.id).toBeLessThanOrEqual(9);
    });
    for (const s of cur.sessions) {
      const p = phaseOf(s.phase);
      expect(p, s.id).toBeDefined();
      expect(s.day).toBeGreaterThanOrEqual(p.days[0]);
      expect(s.day).toBeLessThanOrEqual(p.days[1]);
      expect(s.theme.trim().length).toBeGreaterThan(0);
    }
  });
  it('visits places that exist and suit the phase', () => {
    for (const s of cur.sessions) {
      const place = places.places.find((p) => p.id === s.place);
      expect(place, `${s.id}: unknown place ${s.place}`).toBeDefined();
      expect(place!.phases, `${s.id}: ${s.place} not for phase ${s.phase}`).toContain(s.phase);
    }
  });
  it('keeps lengths and silences within the phase limits', () => {
    for (const s of cur.sessions) {
      const p = phaseOf(s.phase);
      expect(s.lengthMinutes, s.id).toBeGreaterThanOrEqual(p.lengthMinutes[0]);
      expect(s.lengthMinutes, s.id).toBeLessThanOrEqual(p.lengthMinutes[1]);
      expect(s.maxSilenceSeconds, s.id).toBeLessThanOrEqual(p.maxSilenceSeconds);
      expect(s.speechMinutes, s.id).toBeLessThanOrEqual(s.lengthMinutes);
    }
  });
  it('holds phase 1 to 8–12 minutes (decision on #10)', () => {
    expect(phaseOf(1).lengthMinutes).toEqual([8, 12]);
  });
  it('matches word budgets to speech minutes × 105', () => {
    expect(cur.wordsPerSpeechMinute).toBe(105);
    for (const s of cur.sessions) expect(s.wordBudget, s.id).toBe(s.speechMinutes * 105);
  });
  it('never visits the same place twice in a row', () => {
    cur.sessions.slice(1).forEach((s, i) => expect(s.place, s.id).not.toBe(cur.sessions[i].place));
  });
});
