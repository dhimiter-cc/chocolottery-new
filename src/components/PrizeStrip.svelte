<script lang="ts">
  // Host screen only: the prize, floating above the stage for the whole round,
  // so the room never forgets what's at stake. It's the same 3D Toblerone as the
  // golden-ticket reveal, scaled down. Phones don't get it — their screens are
  // for their own bar.
  import PrizeBar from './PrizeBar.svelte';
  import { PRIZE } from '../lib/specialPrize.js';
  import type { GameStyle } from '../lib/types.js';

  let { style }: { style: GameStyle } = $props();
</script>

<div class="prize-strip" role="img" aria-label="Today's prize: a {PRIZE.weightKg} kilogram MOVION Toblerone.">
  <span class="prize-mini" aria-hidden="true">
    <PrizeBar {style} />
  </span>
  <span class="prize-copy">
    <span class="prize-kicker">Today's prize</span>
    <span class="prize-title">{PRIZE.weightKg} kg MOVION Toblerone</span>
    <span class="prize-sub">for whoever {style === 'bars' ? 'finds the golden ticket' : 'draws the longest straw'}</span>
  </span>
</div>
