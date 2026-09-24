<script lang="ts">
  // The MOVION Toblerone as a CSS 3D triangular prism: three faces at
  // 0°/120°/240° about the long axis, pushed out by the apothem, plus two
  // clipped end caps. The front face is laid out like the real personalised
  // bar — the TOBLERONE wordmark, the ingredients strap with the Matterhorn
  // between its halves, then the big name.
  //
  // Geometry comes from the parent's --gt-side / --gt-len (see .gt-stage and
  // .prize-mini in global.css); lighting and motion from the parent's state.
  import { PRIZE } from '../lib/specialPrize.js';
  import type { GameStyle } from '../lib/types.js';

  let { style }: { style: GameStyle } = $props();
</script>

<div class="gt-scene">
  <div class="gt-bar">
    <div class="gt-face gt-face-1">
      <span class="gt-wordmark">TOBLERONE</span>
      <span class="gt-tagline">
        MILK CHOCOLATE WITH
        <i class="gt-peak" aria-hidden="true"></i>
        HONEY &amp; ALMOND NOUGAT
      </span>
      <span class="gt-name">{PRIZE.brand}</span>
      <span class="gt-strap">{PRIZE.weightKg} KG FOR WHOEVER {style === 'bars' ? 'FINDS THE GOLDEN TICKET' : 'DRAWS THE LONGEST STRAW'}</span>
    </div>
    <div class="gt-face gt-face-2"></div>
    <div class="gt-face gt-face-3"></div>
    <div class="gt-cap gt-cap-a"></div>
    <div class="gt-cap gt-cap-b"></div>
  </div>
</div>
