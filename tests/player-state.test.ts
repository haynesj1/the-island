import { describe, expect, it } from 'vitest';
import { initialState, reduce, toggleLabel, type PlayerEvent } from '../src/lib/player-state';

const run = (events: PlayerEvent[]) => events.reduce(reduce, initialState);

describe('player state', () => {
  it('asks about eyes first and ignores play events before an answer', () => {
    expect(initialState.phase).toBe('choose');
    expect(reduce(initialState, { type: 'playing' })).toEqual(initialState);
    expect(reduce(initialState, { type: 'resume' })).toEqual(initialState);
  });
  it('remembers the eye choice and loads', () => {
    expect(run([{ type: 'choose-eyes', eyes: 'closed' }])).toEqual({ phase: 'loading', eyes: 'closed' });
  });
  it('plays, pauses and resumes', () => {
    const s = run([{ type: 'choose-eyes', eyes: 'open' }, { type: 'playing' }, { type: 'pause' }]);
    expect(s.phase).toBe('paused');
    expect(reduce(s, { type: 'resume' }).phase).toBe('loading');
    expect(reduce(reduce(s, { type: 'resume' }), { type: 'playing' }).phase).toBe('playing');
  });
  it('does not pause when not playing', () => {
    expect(reduce(initialState, { type: 'pause' })).toEqual(initialState);
  });
  it('ends, and can restart at the eyes question', () => {
    const s = run([{ type: 'choose-eyes', eyes: 'open' }, { type: 'playing' }, { type: 'ended' }]);
    expect(s.phase).toBe('ended');
    expect(reduce(s, { type: 'restart' })).toEqual(initialState);
  });
  it('returns to playing when audio restarts after ending (e.g. Media Session play)', () => {
    const s = run([{ type: 'choose-eyes', eyes: 'open' }, { type: 'playing' }, { type: 'ended' }, { type: 'playing' }]);
    expect(s).toEqual({ phase: 'playing', eyes: 'open' });
  });
  it('shows an error after a failure but not before anything started', () => {
    expect(reduce(initialState, { type: 'error' })).toEqual(initialState);
    expect(run([{ type: 'choose-eyes', eyes: 'open' }, { type: 'error' }]).phase).toBe('error');
  });
  it('labels the control', () => {
    expect(toggleLabel('playing')).toBe('Pause');
    expect(toggleLabel('paused')).toBe('Play');
    expect(toggleLabel('loading')).toBe('Starting…');
  });
});
