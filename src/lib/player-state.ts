/** Pure state for the session player. The component feeds it events; it never touches the DOM. */
export type Phase = 'choose' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
export type EyeMode = 'open' | 'closed';

export interface PlayerState {
  phase: Phase;
  eyes: EyeMode | null;
}

export type PlayerEvent =
  | { type: 'choose-eyes'; eyes: EyeMode }
  | { type: 'playing' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'ended' }
  | { type: 'error' }
  | { type: 'restart' };

export const initialState: PlayerState = { phase: 'choose', eyes: null };

export function reduce(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case 'choose-eyes':
      return state.phase === 'choose' ? { phase: 'loading', eyes: event.eyes } : state;
    case 'playing':
      return state.phase === 'loading' || state.phase === 'paused' || state.phase === 'ended'
        ? { ...state, phase: 'playing' } : state;
    case 'pause':
      return state.phase === 'playing' ? { ...state, phase: 'paused' } : state;
    case 'resume':
      return state.phase === 'paused' ? { ...state, phase: 'loading' } : state;
    case 'ended':
      return state.phase === 'playing' || state.phase === 'paused' ? { ...state, phase: 'ended' } : state;
    case 'error':
      return state.phase === 'choose' ? state : { ...state, phase: 'error' };
    case 'restart':
      return initialState;
  }
}

/** Label for the single play/pause control. */
export function toggleLabel(phase: Phase): string {
  return phase === 'playing' ? 'Pause' : phase === 'loading' ? 'Starting…' : 'Play';
}
