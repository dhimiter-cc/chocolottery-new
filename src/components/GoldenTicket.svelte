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
  // The figure holds the bar across its chest, so the bar is centred on the
  // figure's own centre line and the measurement is called out to the side —
  // a dimension line under a held bar would cross the torso.
  const PERSON_X = 46;   // centre line of the silhouette
  const BAR_Y = 62;      // top of the bar: chest height, level with the hands
  const barX = PERSON_X - PRIZE.lengthCm / 2;
  const barMidY = BAR_Y + PRIZE.thicknessCm / 2;
  const labelX = barX + PRIZE.lengthCm + 36;
  const viewW = labelX + 30;

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
        We're celebrating the MOVION rebrand, and Wonka is not handing out a
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
            aria-label="A person {PRIZE.personCm} centimetres tall holding the {PRIZE.lengthCm} centimetre bar across their chest"
          >
            <line x1="8" y1="182" x2={viewW - 8} y2="182" class="gt-ground" />
            <!-- Figure at real human proportions on the 1 unit = 1 cm grid:
                 head 8-30, shoulders 38, hips 94, feet 182 — so the legs are
                 90 of the 174, which is what stops it reading as a blob. -->
            <g class="gt-person">
              <circle cx={PERSON_X} cy="19" r="11" />
              <path d="M42 27 L50 27 L50 40 L42 40 Z" />
              <path d="M33 38 Q46 34 59 38 L57 94 L35 94 Z" />
              <path d="M34 92 L44 92 L43 182 L35 182 Z" />
              <path d="M48 92 L58 92 L57 182 L49 182 Z" />
              <path d="M27 40 L33 40 L31 70 L25 70 Z" />
              <path d="M59 40 L65 40 L67 70 L61 70 Z" />
            </g>
            <!-- The bar at its real length and depth, held across the chest.
                 No wordmark on this one: at 11 units tall it renders as an
                 illegible smudge, and the 3D bar above already carries it. -->
            <g class="gt-scale-bar">
              <rect x={barX} y={BAR_Y} width={PRIZE.lengthCm} height={PRIZE.thicknessCm} rx="2" />
            </g>
            <!-- Hands over the bar, so it reads as gripped rather than floating -->
            <g class="gt-person">
              <circle cx="28" cy={barMidY} r="5" />
              <circle cx="64" cy={barMidY} r="5" />
            </g>
            <line x1={barX + PRIZE.lengthCm + 4} y1={barMidY} x2={labelX - 20} y2={barMidY} class="gt-dim" />
            <text x={labelX} y={barMidY + 4} class="gt-scale-note">{PRIZE.lengthCm} cm</text>
            <text x={PERSON_X} y="200" class="gt-scale-note">{PRIZE.personCm} cm</text>
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
