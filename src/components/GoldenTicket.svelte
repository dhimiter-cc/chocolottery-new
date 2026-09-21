<script lang="ts">
  // The MOVION Golden Ticket reveal. Mounted only while it should be on screen
  // (parents gate it with {#if}, same as <Fairness> and <Cupboard>), so the whole
  // sequence runs once on mount and tears its timers down on destroy.
  //
  // `tease`  — landing page / lobby: a teaser card, then the reveal on click.
  // `payoff` — the day itself, after the winner overlay: straight into the reveal.
  import { PRIZE } from '../lib/specialPrize.js';
  import { sounds } from '../lib/sound.js';

  let {
    mode = 'tease',
    winnerName = '',
    onClose,
    onFireConfetti,
    onFireFireworks,
  }: {
    mode?: 'tease' | 'payoff';
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

  // The scale drawing uses a 1 unit = 1 cm viewBox, so the bar is drawn straight
  // from the real measurements and can never drift out of sync with the copy.
  // The silhouette occupies x 17-71 (fingertip to fingertip), so the bar starts
  // clear of it and the viewBox ends just past whichever is wider.
  const BAR_X = 94;
  const barMidX = BAR_X + PRIZE.lengthCm / 2;
  const viewW = BAR_X + PRIZE.lengthCm + 18;

  let showTeaser = $derived(mode === 'tease' && stage === 'tease');
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
      <h2 class="announce-title">This Friday, the straw is worth more</h2>
      <p class="announce-body">
        We're celebrating the MOVION rebrand, and Dhimiter Wonka is not handing out a
        normal bar of chocolate.
      </p>
      <p class="announce-body">
        Draw the longest straw on Friday and you don't just win the round — you walk away
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
        <div class="gt-scene">
          <div class="gt-bar">
            <!-- Equilateral triangular prism: 3 faces at 0°/120°/240° about the
                 long axis, pushed out by the apothem, plus two clipped end caps.
                 The front face is laid out like the real personalised bar — the
                 TOBLERONE wordmark, the ingredients strap with the Matterhorn
                 between its halves, then the big name. -->
            <div class="gt-face gt-face-1">
              <span class="gt-wordmark">TOBLERONE</span>
              <span class="gt-tagline">
                MILK CHOCOLATE WITH
                <i class="gt-peak" aria-hidden="true"></i>
                HONEY &amp; ALMOND NOUGAT
              </span>
              <span class="gt-name">{PRIZE.brand}</span>
              <span class="gt-strap">{PRIZE.weightKg} KG FOR WHOEVER DRAWS THE LONGEST STRAW</span>
            </div>
            <div class="gt-face gt-face-2"></div>
            <div class="gt-face gt-face-3"></div>
            <div class="gt-cap gt-cap-a"></div>
            <div class="gt-cap gt-cap-b"></div>
          </div>
        </div>
        {#if flashing}<div class="gt-flash"></div>{/if}
        {#if stage !== 'lit'}
          <button type="button" class="gt-skip" onclick={light}>skip →</button>
        {/if}
      </div>

      <div class="gt-reveal-body" class:gt-shown={stage === 'lit'}>
        {#if mode === 'payoff' && winnerName}
          <div class="gt-headline">🎟️ {winnerName} has the Golden Ticket</div>
          <p class="gt-lede">
            The longest straw, on the one day it was worth {PRIZE.weightKg} kilograms.
            A delicious surprise awaits you…
          </p>
        {:else}
          <div class="gt-headline">A {PRIZE.weightKg} kilogram Toblerone</div>
          <p class="gt-lede">
            {PRIZE.lengthCm} centimetres, with {PRIZE.barsInside} full-size bars inside.
            Whoever draws the longest straw on Friday takes it home.
          </p>
        {/if}

        <!-- A weight in kilograms means nothing to anyone. Drawn to scale
             against a person it does. -->
        <div class="gt-scale">
          <svg
            viewBox="0 0 {viewW} 206"
            role="img"
            aria-label="A {PRIZE.lengthCm} centimetre bar shown next to a {PRIZE.personCm} centimetre tall person"
          >
            <line x1="8" y1="182" x2={viewW - 8} y2="182" class="gt-ground" />
            <!-- person: feet on the ground (y=182), top of head at y=8 -->
            <g class="gt-person">
              <circle cx="44" cy="22" r="14" />
              <path d="M44 37 C27 37 22 50 21 66 L17 112 L27 112 L31 78 L31 182 L40 182 L40 126 L48 126 L48 182 L57 182 L57 78 L61 112 L71 112 L67 66 C66 50 61 37 44 37 Z" />
            </g>
            <!-- bar: real length and real depth, at chest height, same units -->
            <!-- No wordmark on this one: at 11 units tall it renders as an
                 illegible smudge, and the 3D bar above already carries it. -->
            <g class="gt-scale-bar">
              <rect x={BAR_X} y="92" width={PRIZE.lengthCm} height={PRIZE.thicknessCm} rx="2" />
            </g>
            <line x1={BAR_X} y1="114" x2={BAR_X + PRIZE.lengthCm} y2="114" class="gt-dim" />
            <text x={barMidX} y="130" class="gt-scale-note">{PRIZE.lengthCm} cm</text>
            <text x="44" y="200" class="gt-scale-note">{PRIZE.personCm} cm</text>
          </svg>
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
