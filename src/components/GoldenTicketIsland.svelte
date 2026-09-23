<script lang="ts">
  // Landing-page wrapper for the golden ticket. The landing page is otherwise
  // island-free plain JS, so this one component owns everything the feature needs
  // there: the header button, its own effects canvas, and the modal.
  //
  // It sits inside .head-actions; .modal is position:fixed, so the modal escapes
  // the header's stacking context on its own.
  import EffectsCanvas from './EffectsCanvas.svelte';
  import GoldenTicket from './GoldenTicket.svelte';
  import { hasSeenTeaserToday, markTeaserSeenToday, isTeaseActive } from '../lib/specialPrize.js';

  const active = isTeaseActive();

  // client:load, so this only ever evaluates in the browser — the first visit of
  // each day opens the teaser, and after that it lives behind the header button.
  // Marked seen the moment it auto-opens, not on close: someone who watches the
  // reveal and then navigates away has seen it, and shouldn't be shown it again
  // today.
  const autoOpen = active && !hasSeenTeaserToday();
  if (autoOpen) markTeaserSeenToday();

  let open = $state(autoOpen);
  let effectsCanvas: ReturnType<typeof EffectsCanvas> | null = $state(null);

  function close() {
    open = false;
    markTeaserSeenToday();
  }
</script>

{#if active}
  <button type="button" class="btn btn-ghost gt-trigger" onclick={() => (open = true)}>
    🎟️ Golden Ticket
  </button>

  <EffectsCanvas bind:this={effectsCanvas} />

  {#if open}
    <GoldenTicket
      mode="tease"
      onClose={close}
      onFireConfetti={(big) => effectsCanvas?.fireConfetti(big)}
      onFireFireworks={(bursts) => effectsCanvas?.fireFireworks(bursts)}
    />
  {/if}
{/if}
