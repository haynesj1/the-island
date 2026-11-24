<script lang="ts">
  import { initialState, reduce, toggleLabel, type EyeMode, type PlayerEvent } from '../lib/player-state';

  let { title = 'Session player', src = undefined }: { title?: string; src?: string } = $props();

  let state = $state(initialState);
  let audio: HTMLAudioElement | undefined = $state();

  function send(event: PlayerEvent) {
    state = reduce(state, event);
  }

  function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'The Island' });
    navigator.mediaSession.setActionHandler('play', () => audio?.play());
    navigator.mediaSession.setActionHandler('pause', () => audio?.pause());
  }

  function begin(eyes: EyeMode) {
    if (!audio || !src) return;
    send({ type: 'choose-eyes', eyes });
    setupMediaSession();
    audio.play().catch(() => send({ type: 'error' }));
  }

  function toggle() {
    if (!audio) return;
    if (state.phase === 'playing') audio.pause();
    else {
      send({ type: 'resume' });
      audio.play().catch(() => send({ type: 'error' }));
    }
  }

  function again() {
    if (audio) audio.currentTime = 0;
    send({ type: 'restart' });
  }
</script>

<section class="player" aria-labelledby="player-heading">
  <h2 id="player-heading">{title}</h2>
  <audio
    bind:this={audio}
    {src}
    preload="auto"
    onplaying={() => send({ type: 'playing' })}
    onpause={() => audio && !audio.ended && send({ type: 'pause' })}
    onended={() => send({ type: 'ended' })}
    onerror={() => send({ type: 'error' })}
  ></audio>

  {#if !src}
    <p>Sessions are on their way. The player will appear here.</p>
    <button type="button" disabled>Play</button>
  {:else if state.phase === 'choose'}
    <p id="eyes-question">Before we begin: would you like to keep your eyes open or closed? You can stop at any time.</p>
    <div class="row" role="group" aria-labelledby="eyes-question">
      <button type="button" onclick={() => begin('open')}>Eyes open</button>
      <button type="button" onclick={() => begin('closed')}>Eyes closed</button>
    </div>
  {:else if state.phase === 'error'}
    <p role="alert">Sorry, the audio could not play. Check your connection and try again.</p>
    <button type="button" onclick={again}>Try again</button>
  {:else if state.phase === 'ended'}
    <p role="status">The session has finished. Take your time.</p>
    <button type="button" onclick={again}>Listen again</button>
  {:else}
    <p role="status">{state.eyes === 'closed' ? 'Eyes closed' : 'Eyes open'} · {state.phase === 'playing' ? 'Playing' : state.phase === 'paused' ? 'Paused' : 'Starting'}</p>
    <button type="button" onclick={toggle} disabled={state.phase === 'loading'}>{toggleLabel(state.phase)}</button>
  {/if}
</section>

<style>
  .player { margin-top: 2rem; padding: 1rem 1.25rem; border: 1px solid #b9c9c4; border-radius: 0.75rem; }
  h2 { margin: 0 0 0.5rem; font-size: 1.125rem; }
  p { margin: 0 0 1rem; }
  .row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  button { font: inherit; padding: 0.6rem 1.25rem; border-radius: 999px; border: 1px solid #2f5d57; background: #fff; color: #2f5d57; min-height: 44px; cursor: pointer; }
  button:disabled { opacity: 0.6; cursor: default; }
</style>
