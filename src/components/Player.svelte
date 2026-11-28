<script lang="ts">
  import { onMount } from 'svelte';
  import { initialState, reduce, toggleLabel, type EyeMode, type PlayerEvent } from '../lib/player-state';
  import { askEnabled, buildPayload, sendShare, setAskEnabled, shareUrl, shouldAsk } from '../lib/share';
  import { SCALE, clearRatings, loadRatings, ratingLabel, saveRating, type Rating } from '../lib/calm-rating';

  let { title = 'Session player', src = undefined, day = undefined }: { title?: string; src?: string; day?: number } = $props();

  const endpoint = shareUrl();

  let state = $state(initialState);
  let audio: HTMLAudioElement | undefined = $state();
  let before: Rating | null = $state(null);
  let after: Rating | null = $state(null);
  let closed = $state(false); // the after-question has been answered or skipped
  let saved = $state(0);
  let askToShare = $state(true);
  let sharePrompt = $state(false); // the share line is showing for this session

  function store() {
    try {
      return globalThis.localStorage;
    } catch {
      return undefined;
    }
  }

  onMount(() => {
    saved = loadRatings(store()).length;
    askToShare = askEnabled(store());
  });

  function finishRating(value: Rating | null) {
    after = value;
    closed = true;
    saveRating(store(), { at: new Date().toISOString(), session: title, before, after });
    saved = loadRatings(store()).length;
    sharePrompt = shouldAsk(endpoint, store(), buildPayload(day, before, after));
  }

  async function share(choice: boolean) {
    sharePrompt = false;
    const payload = buildPayload(day, before, after);
    if (choice && payload) await sendShare(endpoint, payload); // a failure is silent by design
  }

  function toggleAsk(on: boolean) {
    askToShare = on;
    setAskEnabled(store(), on);
  }

  function clearAll() {
    clearRatings(store());
    saved = 0;
  }

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
    if (audio) {
      audio.currentTime = 0;
      audio.load(); // clears a failed source so the next play re-requests it
    }
    send({ type: 'restart' });
    before = null;
    after = null;
    closed = false;
    sharePrompt = false;
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
    <p id="before-question">How calm do you feel right now? This is optional, and you can skip it.</p>
    <div class="row" role="group" aria-labelledby="before-question">
      {#each SCALE as n (n)}
        <button type="button" class="scale" aria-pressed={before === n} aria-label={ratingLabel(n)} onclick={() => (before = before === n ? null : n)}>{n}</button>
      {/each}
    </div>
    <p id="eyes-question" class="gap">Before we begin: would you like to keep your eyes open or closed? You can stop at any time.</p>
    <div class="row" role="group" aria-labelledby="eyes-question">
      <button type="button" onclick={() => begin('open')}>Eyes open</button>
      <button type="button" onclick={() => begin('closed')}>Eyes closed</button>
    </div>
  {:else if state.phase === 'error'}
    <p role="alert">Sorry, the audio could not play. Check your connection and try again.</p>
    <button type="button" onclick={again}>Try again</button>
  {:else if state.phase === 'ended'}
    {#if !closed}
      <p id="after-question" role="status">The session has finished. How calm do you feel now? This is optional.</p>
      <div class="row" role="group" aria-labelledby="after-question">
        {#each SCALE as n (n)}
          <button type="button" class="scale" aria-label={ratingLabel(n)} onclick={() => finishRating(n)}>{n}</button>
        {/each}
        <button type="button" onclick={() => finishRating(null)}>Skip</button>
      </div>
    {:else}
      <p role="status">Thank you for taking this time. Come back whenever you like.</p>
      {#if sharePrompt}
        <div class="share" role="group" aria-labelledby="share-question">
          <p id="share-question">Share these two numbers anonymously? They help show whether sessions like this one feel calming. Nothing else is sent.</p>
          <div class="row">
            <button type="button" onclick={() => share(true)}>Share</button>
            <button type="button" onclick={() => share(false)}>Not now</button>
          </div>
        </div>
      {/if}
      <button type="button" onclick={again}>Listen again</button>
    {/if}
  {:else}
    <p role="status">{state.eyes === 'closed' ? 'Eyes closed' : 'Eyes open'} · {state.phase === 'playing' ? 'Playing' : state.phase === 'paused' ? 'Paused' : 'Starting'}</p>
    <button type="button" onclick={toggle} disabled={state.phase === 'loading'}>{toggleLabel(state.phase)}</button>
  {/if}
  {#if saved > 0}
    <p class="note">
      {saved} {saved === 1 ? 'rating' : 'ratings'} saved on this device only.
      <button type="button" class="link" onclick={clearAll}>Clear my ratings</button>
    </p>
  {/if}
  {#if endpoint}
    <label class="note setting">
      <input type="checkbox" checked={askToShare} onchange={(e) => toggleAsk(e.currentTarget.checked)} />
      Ask to share my calm numbers
    </label>
  {/if}
</section>

<style>
  .player { margin-top: 2rem; padding: 1rem 1.25rem; border: 1px solid #b9c9c4; border-radius: 0.75rem; }
  h2 { margin: 0 0 0.5rem; font-size: 1.125rem; }
  p { margin: 0 0 1rem; }
  .row { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  button { font: inherit; padding: 0.6rem 1.25rem; border-radius: 999px; border: 1px solid #2f5d57; background: #fff; color: #2f5d57; min-height: 44px; cursor: pointer; }
  .scale { min-width: 44px; padding: 0.6rem 0; }
  .scale[aria-pressed='true'] { background: #2f5d57; color: #fff; }
  .gap { margin-top: 1.25rem; }
  .share { margin: 0 0 1rem; }
  .setting { display: flex; align-items: center; gap: 0.5rem; min-height: 44px; }
  .setting input { width: 1.25rem; height: 1.25rem; }
  .note { margin: 1rem 0 0; font-size: 0.875rem; }
  .link { border: 0; background: none; text-decoration: underline; padding: 0.6rem 0.25rem; }
  button:disabled { opacity: 0.6; cursor: default; }
</style>
