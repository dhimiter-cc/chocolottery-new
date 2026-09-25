<script lang="ts">
  // The MOVION Golden Ticket reveal. Mounted only while it should be on screen
  // (parents gate it with {#if}, same as <Fairness> and <Cupboard>), so the whole
  // sequence runs once on mount and tears its timers down on destroy.
  //
  // `tease`  — landing page / lobby: a teaser card, then the reveal on click.
  // `payoff` — the day itself, after the winner overlay: straight into the reveal.
  import { PRIZE } from '../lib/specialPrize.js';
  import { DEFAULT_STYLE } from '../lib/bars.js';
  import type { GameStyle } from '../lib/types.js';
  import { sounds } from '../lib/sound.js';
  import PrizeBar from './PrizeBar.svelte';

  let {
    mode = 'tease',
    style = DEFAULT_STYLE,
    winnerName = '',
    onClose,
    onFireConfetti,
    onFireFireworks,
  }: {
    mode?: 'tease' | 'payoff';
    /** How the round is won — the copy promises whichever one is being played. */
    style?: GameStyle;
    winnerName?: string;
    onClose: () => void;
    onFireConfetti?: (big: boolean) => void;
    onFireFireworks?: (bursts?: number) => void;
  } = $props();

  // tease → the card with the button; emerging → spinning silhouette;
  // lit → branded, at rest, with the caption and ticket.
  //
  // Always starts at 'tease' rather than branching on `mode` here: reading a prop
  // in a $state initialiser only ever captures its first value, and the markup
  // already skips the teaser branch outright in payoff mode.
  let stage = $state<'tease' | 'emerging' | 'lit'>('tease');
  let flashing = $state(false);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  let timers: ReturnType<typeof setTimeout>[] = [];
  function later(fn: () => void, ms: number) {
    timers.push(setTimeout(fn, ms));
  }
  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  // The bar arrives lit and at rest, then everything else lands on top of it.
  function light() {
    if (stage === 'lit') return;
    stage = 'lit';

    if (!reducedMotion) {
      flashing = true;
      later(() => (flashing = false), 650);
    }

    sounds.playSparkleChime();
    sounds.playPartyHorn();
    later(() => sounds.playTada(), 420);

    if (mode === 'payoff') {
      // <RevealPhase> already emptied the confetti cannon five seconds ago.
      // Piling more on top just buries the ticket — fireworks stay legible
      // against the dark card, so the payoff gets its own quieter beat.
      sounds.playApplause(3000);
      onFireFireworks?.(4);
      later(() => onFireFireworks?.(3), 1200);
    } else {
      onFireConfetti?.(true);
      onFireFireworks?.(5);
    }
  }

  function startReveal() {
    clearTimers();
    stage = 'emerging';
    // Reduced motion: no spin, no flash — the bar is simply already there.
    if (reducedMotion) {
      light();
      return;
    }
    sounds.playRisingRumble();
    later(light, 1600);
  }

  // Run-once on mount, the same guard <RevealPhase> uses for its sequence.
  let hasRun = false;
  $effect(() => {
    if (!hasRun) {
      hasRun = true;
      if (mode === 'payoff') startReveal();
    }
    return clearTimers;
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  // The scale drawing uses a 1 unit = 1 cm viewBox, so the bar and the banana
  // are drawn straight from the real measurements and can never drift out of
  // sync with the copy. Both lie on the same ground line, a dimension line
  // over each.
  const GROUND = 23;
  const BAR_X = 3;
  const BAR_TOP = GROUND - PRIZE.thicknessCm;
  const DIM_Y = BAR_TOP - 3;
  const bananaX = BAR_X + PRIZE.lengthCm + 7;
  const bananaEnd = bananaX + PRIZE.bananaCm;
  const viewW = bananaEnd + 5;
  const viewH = GROUND + 3;
  const bananas = (PRIZE.lengthCm / PRIZE.bananaCm).toFixed(1);

  // Lying on its side, curve down, tips ~6 cm up off the table. The underside's
  // control point sits below the ground so the belly just touches it; the top
  // curve is shallower, which leaves the banana ~3.3 cm thick in the middle and
  // pointed at both tips.
  const L = PRIZE.bananaCm;
  const bananaPath =
    `M ${bananaX} ${GROUND - 5.5} ` +
    `Q ${bananaX + L / 2} ${GROUND + 5.5} ${bananaEnd} ${GROUND - 6.2} ` +
    `Q ${bananaX + L / 2} ${GROUND - 1.15} ${bananaX} ${GROUND - 5.5} Z`;
  const bananaRidge =
    `M ${bananaX + 1.1} ${GROUND - 4.6} Q ${bananaX + L / 2} ${GROUND + 2.2} ${bananaEnd - 1.3} ${GROUND - 5.2}`;

  let showTeaser = $derived(mode === 'tease' && stage === 'tease');
  let bars = $derived(style === 'bars');
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- The keyboard route out of this is Escape, wired on <svelte:window> above —
     the compiler can't see across that, hence the one ignore. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="modal gt-modal"
  role="dialog"
  aria-modal="true"
  aria-label="The MOVION Golden Ticket"
  tabindex="-1"
  onclick={handleBackdrop}
>
  <div class="modal-card announce-card gt-card" class:gt-revealing={!showTeaser}>
    {#if showTeaser}
      <div class="announce-emoji">🎟️</div>
      <span class="announce-badge">Special edition</span>
      <h2 class="announce-title">
        {bars ? 'This Friday, one bar has a golden ticket' : 'This Friday, the straw is worth more'}
      </h2>
      <p class="announce-body">
        We're celebrating the MOVION rebrand, and Wonka is not handing out a
        normal bar of chocolate.
      </p>
      <p class="announce-body">
        {bars ? 'Find the golden ticket in your chocolate bar on Friday' : 'Draw the longest straw on Friday'}
        and you don't just win the round — you walk away
        with something that needs two hands.
      </p>
      <div class="announce-actions">
        <button type="button" class="btn btn-ghost" onclick={onClose}>Not now</button>
        <button type="button" class="btn btn-primary" onclick={startReveal}>
          Discover the prize →
        </button>
      </div>
    {:else}
      <button type="button" class="gt-close" aria-label="Close" onclick={onClose}>✕</button>

      <div class="gt-stage" class:gt-lit={stage === 'lit'}>
        <PrizeBar {style} />
        {#if flashing}<div class="gt-flash"></div>{/if}
        {#if stage !== 'lit'}
          <button type="button" class="gt-skip" onclick={light}>skip →</button>
        {/if}
      </div>

      <div class="gt-reveal-body" class:gt-shown={stage === 'lit'}>
        {#if mode === 'payoff' && winnerName}
          <div class="gt-headline">🎟️ {winnerName} has the Golden Ticket</div>
          <p class="gt-lede">
            {bars ? 'The one bar with a ticket inside' : 'The longest straw'}, on the one day it was worth {PRIZE.weightKg} kilograms.
            A delicious surprise awaits you…
          </p>
        {:else}
          <div class="gt-headline">A {PRIZE.weightKg} kilogram Toblerone</div>
          <p class="gt-lede">
            {PRIZE.lengthCm} centimetres, with {PRIZE.barsInside} full-size bars inside.
            Whoever {bars ? 'finds the golden ticket' : 'draws the longest straw'} on Friday takes it home.
          </p>
        {/if}

        <!-- A weight in kilograms means nothing to anyone. Drawn to scale
             next to a banana, it does. -->
        <div class="gt-scale">
          <svg
            viewBox="0 0 {viewW} {viewH}"
            role="img"
            aria-label="The {PRIZE.lengthCm} centimetre bar next to a {PRIZE.bananaCm} centimetre banana, drawn to scale"
          >
            <line x1="1" y1={GROUND} x2={viewW - 1} y2={GROUND} class="gt-ground" />
            <!-- The bar at its real length and depth. No wordmark: at this
                 size it renders as an illegible smudge, and the 3D bar above
                 already carries it. -->
            <rect class="gt-scale-bar" x={BAR_X} y={BAR_TOP} width={PRIZE.lengthCm} height={PRIZE.thicknessCm} rx="0.8" />
            <g class="gt-banana">
              <path d={bananaPath} class="gt-banana-skin" />
              <path d={bananaRidge} class="gt-banana-ridge" />
              <circle cx={bananaX + 0.2} cy={GROUND - 5.5} r="0.55" class="gt-banana-tip" />
              <path d="M {bananaEnd - 0.3} {GROUND - 6.2} l 1.2 -1.5" class="gt-banana-stem" />
            </g>
            <!-- Dimension lines, one per object, ticks at both ends -->
            <path class="gt-dim" d="M {BAR_X} {DIM_Y} H {BAR_X + PRIZE.lengthCm} M {BAR_X} {DIM_Y - 1} v 2 M {BAR_X + PRIZE.lengthCm} {DIM_Y - 1} v 2" />
            <text x={BAR_X + PRIZE.lengthCm / 2} y={DIM_Y - 1.6} class="gt-scale-note">{PRIZE.lengthCm} cm</text>
            <path class="gt-dim" d="M {bananaX} {GROUND - 10.5} H {bananaEnd} M {bananaX} {GROUND - 11.5} v 2 M {bananaEnd} {GROUND - 11.5} v 2" />
            <text x={bananaX + PRIZE.bananaCm / 2} y={GROUND - 12.1} class="gt-scale-note">{PRIZE.bananaCm} cm</text>
          </svg>
          <p class="gt-scale-caption">
            Measured in the only unit that matters: <strong>{bananas} bananas</strong> of chocolate.
            The banana is sulking.
          </p>
        </div>

        <img
          src="/golden-ticket.webp"
          alt="Golden Ticket for the Choco Lottery — a delicious surprise awaits you"
          class="gt-ticket"
          width="1942"
          height="809"
          loading="eager"
          decoding="async"
        />

        <div class="gt-actions">
          <button type="button" class="btn btn-primary" onclick={onClose}>
            {mode === 'payoff' ? 'Claim it 🍫' : 'See you Friday 🍫'}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
