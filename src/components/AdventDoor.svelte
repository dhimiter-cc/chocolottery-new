<script lang="ts">
  // The advent door the winner opened, at the reveal: a little door swings open on
  // the prize behind it. Only while the live theme runs a calendar (the server
  // sends `game.advent`) and this screen's theme has the words for it. Links to
  // the whole calendar. It never touches who wins.
  import type { GameStateResponse } from '../lib/types.js';
  import { currentTheme } from '../themes/client.js';

  let { game, delay = 0 }: { game: GameStateResponse; delay?: number } = $props();

  const words = currentTheme().advent;
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  let open = $state(false);
  $effect(() => {
    const t = setTimeout(() => (open = true), reducedMotion ? 0 : delay);
    return () => clearTimeout(t);
  });
</script>

{#if words && game.advent}
  {@const door = game.advent.door}
  <a class="advent-door" class:open href="/advent" target="_blank" rel="noreferrer">
    <span class="ad-frame" aria-hidden="true">
      <span class="ad-prize">
        {#if game.advent.icon}<img src={`/api/advent/${door}`} alt="" width="34" height="34" />{:else}🎁{/if}
      </span>
      <span class="ad-panel">{door}</span>
    </span>
    <span class="ad-text">
      <b>{words.revealLead.replace('{door}', String(door))}</b>
      <span>{open ? game.advent.title || words.surprise : '…'}</span>
    </span>
  </a>
{/if}
