<script lang="ts">
  // Bar-mode twin of <PickingPhase>: the same pick rules, but a shelf of sealed
  // MOVION bars instead of straws in a cup. Once the last bar is taken the round
  // moves on to unwrapping (see afterAllPicked in lib/game.ts).
  import type { GameStateResponse } from '../lib/types.js';
  import { showToast } from '../lib/toast.svelte.js';
  import ChocolateBar from './ChocolateBar.svelte';
  import { preloadTicket, shelfDensity } from '../lib/bars.js';
  import { fitShelf } from '../lib/fitShelf.js';

  let { game, onPick, locked = false }:
    { game: GameStateResponse; onPick: (index: number) => void; locked?: boolean } = $props();

  const QUIPS = [
    "Pick a bar. One of them has a golden ticket in it.",
    "They all look the same. They are not the same.",
    "Trust your gut. It's been right about chocolate before.",
    "A few grams of foil stand between you and destiny.",
    "Choose wisely. Or wildly. The wrapper won't tell you.",
  ];

  let quip = $derived.by(() => {
    const seed = (game.my_token || '').charCodeAt(0) || 0;
    return QUIPS[seed % QUIPS.length];
  });

  $effect(() => { preloadTicket(); });

  let pickInFlight = $state(false);
  let remaining = $derived(game.players.filter(p => !p.picked).length);

  let phaseText = $derived.by(() => {
    if (remaining === 0) return 'Handing out the bars…';
    if (game.my_straw == null) return quip;
    return `Got yours. Waiting for ${remaining} more.`;
  });

  let barCount = $derived(game.straws ? game.straws.length : game.players.length || 4);

  function holder(i: number) {
    return game.players.find(p => p.straw_index === i) ?? null;
  }

  async function pick(i: number) {
    if (locked || pickInFlight || game.my_straw != null) return;
    if (holder(i)) {
      showToast('Someone beat you to that one');
      return;
    }
    pickInFlight = true;
    await onPick(i);
    pickInFlight = false;
  }
</script>

<p class="bar-phase-text">{phaseText}</p>

<!-- reserve: the quip line above; label: the button's own padding -->
<div class="bar-shelf {shelfDensity(barCount)}" {@attach fitShelf(barCount, 40, 8)}>
  {#each Array.from({ length: barCount }, (_, i) => i) as i (i)}
    {@const p = holder(i)}
    {@const mine = game.my_straw === i}
    <button
      type="button"
      class="bar-slot"
      class:taken={!!p}
      class:mine
      disabled={locked || (!!p && !mine) || (game.my_straw != null && !mine)}
      aria-pressed={mine}
      aria-label={p ? `Bar ${i + 1}, taken by ${p.is_me ? 'you' : p.name}` : `Bar ${i + 1}`}
      onclick={() => pick(i)}
    >
      <ChocolateBar number={i + 1} name={p ? (p.is_me ? 'You' : p.name) : ''} boil={!p && !locked} />
    </button>
  {/each}
</div>
