<script lang="ts">
  import { onMount } from 'svelte';
  import { SESSION_CACHE } from '../lib/shell';

  let { urls }: { urls: string[] } = $props();

  let status = $state<'idle' | 'saving' | 'saved' | 'error' | 'unsupported'>('idle');

  onMount(async () => {
    if (!('serviceWorker' in navigator) || !('caches' in window)) { status = 'unsupported'; return; }
    try {
      const cache = await caches.open(SESSION_CACHE);
      if ((await Promise.all(urls.map((u) => cache.match(u)))).every(Boolean)) status = 'saved';
    } catch { /* leave as idle */ }
  });

  async function save() {
    status = 'saving';
    try {
      const reg = await navigator.serviceWorker.ready;
      const worker = reg.active;
      if (!worker) throw new Error('no worker');
      const ok = await new Promise<boolean>((resolve) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => resolve(!!e.data?.ok);
        worker.postMessage({ type: 'save-session', urls: [...urls] }, [ch.port2]);
        setTimeout(() => resolve(false), 60_000);
      });
      status = ok ? 'saved' : 'error';
    } catch {
      status = 'error';
    }
  }
</script>

<div class="offline">
  {#if status === 'unsupported'}
    <p>Saving for offline isn't available in this browser.</p>
  {:else}
    <button type="button" onclick={save} disabled={status === 'saving' || status === 'saved'}>
      {status === 'saved' ? 'Saved for offline' : 'Save for offline'}
    </button>
    <p role="status">
      {#if status === 'saving'}Saving…{:else if status === 'saved'}This session will play without a connection.{:else if status === 'error'}Sorry, it could not be saved. Check your connection and try again.{/if}
    </p>
  {/if}
</div>

<style>
  .offline { margin-top: 1rem; }
  p { margin: 0.5rem 0 0; }
  button { font: inherit; padding: 0.6rem 1.25rem; border-radius: 999px; border: 1px solid #2f5d57; background: #fff; color: #2f5d57; min-height: 44px; cursor: pointer; }
  button:disabled { opacity: 0.7; cursor: default; }
</style>
