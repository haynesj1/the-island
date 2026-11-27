<script lang="ts">
  import { onMount } from 'svelte';
  import { localDateString, programmeDay, todaysSession, type SessionInfo } from '../lib/sessions';

  let { sessions }: { sessions: SessionInfo[] } = $props();

  const KEY = 'island-start-date';
  // Server-rendered default is day 1; replaced on the device once the stored start date is read.
  let day = $state(1);
  const session = $derived(todaysSession(sessions, day));

  onMount(() => {
    const today = localDateString(new Date());
    let start = today;
    try {
      start = localStorage.getItem(KEY) ?? today;
      if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, today);
    } catch {
      // Storage blocked: every visit counts as day 1, which still shows a session.
    }
    day = programmeDay(start, today);
  });
</script>

<section class="today" aria-labelledby="today-heading">
  <h2 id="today-heading">Today's session</h2>
  {#if session}
    <p class="name">{session.title}{session.minutes ? ` · about ${session.minutes} minutes` : ''}</p>
    <a class="go" href={`/sessions/${session.slug}/`}>Open today's session</a>
  {:else}
    <p>Sessions are on their way.</p>
  {/if}
</section>

<style>
  .today { margin-top: 2rem; padding: 1rem 1.25rem; border: 1px solid #b9c9c4; border-radius: 0.75rem; }
  h2 { margin: 0 0 0.5rem; font-size: 1.125rem; }
  .name { margin: 0 0 1rem; }
  .go { display: inline-flex; align-items: center; min-height: 44px; padding: 0 1.25rem; border-radius: 999px; border: 1px solid #2f5d57; background: #2f5d57; color: #fff; text-decoration: none; }
</style>
