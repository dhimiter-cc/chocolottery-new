<script lang="ts">
  // Bar-mode twin of <RevealPhase>. The last bar has just been opened (or the
  // host unlocked the rest), and until now nobody has seen the ticket. A short
  // drumroll in words first, then the golden bar takes centre stage, the ticket
  // lifts out of it (stop-motion, like the unwrap), and the name lands with
  // confetti on every screen.
  import type { Snippet } from 'svelte';
  import type { GameStateResponse } from '../lib/types.js';
  import { UNWRAP_STEPS, TICKET_SRC, DRUMROLL_MS } from '../lib/bars.js';
  import ChocolateBar from './ChocolateBar.svelte';

  interface Sounds {
    playWinFanfare: () => void;
    playApplause: (ms?: number) => void;
    playCheer: (ms?: number) => void;
    playPartyHorn: () => void;
    playTada: () => void;
    playSparkleChime: () => void;
  }

  let {
    game,
    sounds,
    onFireConfetti,
    onFireSparkles,
    onFireFireworks,
    prize,
  }: {
    game: GameStateResponse;
    /** The cupboard prize and the host's "mark given" control. Lives inside the
     *  canvas, next to the winner, so the reveal never needs a scrollbar. */
    prize?: Snippet;
    sounds: Sounds;
    onFireConfetti: (big: boolean) => void;
    onFireSparkles: () => void;
    onFireFireworks: (bursts?: number) => void;
  } = $props();

  let winner = $derived(game.players.find(p => p.token === game.winner_token) ?? null);
  let iWon = $derived(!!winner && winner.is_me);
  let others = $derived(
    game.players
      .filter(p => p.token !== game.winner_token && p.straw_index != null)
      .sort((a, b) => a.straw_index! - b.straw_index!)
  );

  // 0 = "Everyone is open.", 1 = "The golden ticket was in…", then the bar.
  let beat = $state(0);
  let started = $state(false);
  let lifted = $state(false);
  let showName = $state(false);

  let me = $derived(game.players.find(p => p.is_me) ?? null);
  let message = $derived.by(() => {
    if (!winner) return '';
    if (iWon) return "It was in yours. Walk slowly. Don't apologise.";
    if (game.host?.is_me && !game.host_plays) return 'Time to hand over the prize.';
    return me ? "Pretend you're happy for them. That's professionalism." : '';
  });

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  // Run once on mount, same guard as <RevealPhase>.
  let hasRun = false;
  $effect(() => {
    if (hasRun) return;
    hasRun = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(fn, reducedMotion ? 0 : ms));

    // The drumroll. `later` collapses to 0ms under reduced motion, so these
    // run back to back there and the bar simply appears.
    later(() => { beat = 1; }, DRUMROLL_MS / 2 - 50);
    later(() => {
      started = true;
      sounds.playSparkleChime();
      onFireSparkles();
    }, DRUMROLL_MS);

    later(() => { lifted = true; }, DRUMROLL_MS + 350);
    later(() => {
      showName = true;
      sounds.playPartyHorn();
      // Confetti for the whole room — the win is the event, not just for the winner.
      onFireConfetti(true);
      if (iWon) {
        sounds.playWinFanfare();
        sounds.playCheer(2400);
        sounds.playApplause(3000);
        onFireFireworks(7);
        later(() => { onFireConfetti(true); sounds.playTada(); }, 1100);
        later(() => onFireFireworks(4), 1600);
      } else {
        sounds.playApplause(2600);
        later(() => sounds.playTada(), 500);
        onFireFireworks(3);
      }
    }, DRUMROLL_MS + 1250);

    return () => timers.forEach(clearTimeout);
  });
</script>

<div class="bar-reveal">
  {#if winner && winner.straw_index != null && !started}
    <!-- Keyed so each line re-runs its entrance. -->
    {#key beat}
      <div class="bar-reveal-beat" aria-live="polite">
        <p class="bar-reveal-beat-line">{beat === 0 ? 'Everyone is open.' : 'The golden ticket was in…'}</p>
        <span class="bar-reveal-beat-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      </div>
    {/key}
  {:else if winner && winner.straw_index != null}
    <div class="bar-reveal-hero" class:lifted>
      <!-- Once lifted, the bar underneath is just chocolate: the ticket is the
           separate image climbing out of it. -->
      <ChocolateBar step={UNWRAP_STEPS} number={winner.straw_index + 1} golden={!lifted} />
      {#if lifted}
        <img
          class="bar-reveal-ticket"
          src={TICKET_SRC}
          alt="The MOVION Golden Ticket"
          width="1942"
          height="809"
        />
      {/if}
    </div>

    <div class="bar-reveal-side">
      <div class="bar-reveal-text" class:shown={showName}>
        {#if showName}
          <div class="overlay-headline">🎟️ The golden ticket was in bar Nº {String(winner.straw_index + 1).padStart(2, '0')}</div>
          <div class="winner-name">{winner.name}</div>
          {#if message}<div class="overlay-sub">{message}</div>{/if}
        {/if}
      </div>
      {#if showName && prize}<div class="bar-reveal-prize">{@render prize()}</div>{/if}
    </div>
  {:else}
    <p class="bar-phase-text">Round over.</p>
  {/if}

  {#if others.length && started}
    <div class="bar-reveal-rest">
      {#each others as p (p.token)}
        <figure>
          <ChocolateBar step={UNWRAP_STEPS} number={p.straw_index! + 1} golden={false} />
          <figcaption>{p.is_me ? 'You' : p.name}</figcaption>
        </figure>
      {/each}
    </div>
  {/if}
</div>
