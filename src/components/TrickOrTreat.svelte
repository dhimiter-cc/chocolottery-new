<script lang="ts">
  // The door, after the winner is known. Everyone sees it knock, then open on a
  // treat (the usual prize) or a trick (the room's top-voted dare, then the prize
  // anyway). The outcome is decided by the server from the sealed draw, so every
  // screen shows the same one and the winner never gets to pick. Only mounted
  // while the active theme provides `trickOrTreat` copy.
  import type { GameStateResponse } from '../lib/types.js';
  import { currentTheme } from '../themes/client.js';

  let {
    game,
    sounds,
    delay = 0,
  }: {
    game: GameStateResponse;
    sounds: { playTada: () => void; playSpookyStinger?: () => void };
    /** Wait this long before the knock, to let the winner's reveal land first. */
    delay?: number;
  } = $props();

  const words = currentTheme().trickOrTreat;
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  // 0 = not yet, 1 = knocking, 2 = open
  let step = $state(0);
  let hasRun = false;
  $effect(() => {
    if (hasRun) return;
    hasRun = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => (step = 1), reducedMotion ? 0 : delay));
    timers.push(setTimeout(() => {
      step = 2;
      if (game.door === 'trick') sounds.playSpookyStinger?.();
      else sounds.playTada();
    }, reducedMotion ? 0 : delay + 1500));
    return () => timers.forEach(clearTimeout);
  });

  let winner = $derived(game.players.find((p) => p.token === game.winner_token) ?? null);
</script>

{#if words && game.door && winner && step > 0}
  <div class="tot" class:tot-trick={step === 2 && game.door === 'trick'} class:tot-treat={step === 2 && game.door === 'treat'} aria-live="polite">
    {#if step === 1}
      <p class="tot-knock"><span class="tot-door" aria-hidden="true">🚪</span> {words.knocking}</p>
    {:else if game.door === 'treat'}
      <p class="tot-lead">{words.treat}</p>
    {:else}
      <p class="tot-lead">{words.trickLead}</p>
      {#if game.trick}
        <p class="tot-trick-text">“{game.trick.text}”</p>
        <p class="tot-note">
          {winner.is_me ? 'You' : winner.name} · {words.trickNote}
          {game.trick.random ? ' (from the house, nobody suggested any)' : ` · suggested by ${game.trick.author_name}`}
        </p>
      {/if}
    {/if}
  </div>
{/if}
