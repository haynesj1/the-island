<script lang="ts">
  let { title = 'Session player' }: { title?: string } = $props();
</script>

<section class="player" aria-labelledby="player-heading">
  <h2 id="player-heading">{title}</h2>
  <p>Sessions are on their way. The player will appear here.</p>
  <button type="button" disabled>Play</button>
</section>

<style>
  .player { margin-top: 2rem; padding: 1rem 1.25rem; border: 1px solid #b9c9c4; border-radius: 0.75rem; }
  h2 { margin: 0 0 0.5rem; font-size: 1.125rem; }
  p { margin: 0 0 1rem; }
  button { font: inherit; padding: 0.6rem 1.25rem; border-radius: 999px; border: 1px solid #2f5d57; background: #fff; color: #2f5d57; min-height: 44px; }
</style>
