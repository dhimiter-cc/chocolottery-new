<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  interface Sounds {
    playDrumroll: (ms: number) => void;
    playWinFanfare: () => void;
    playLoseTrombone: () => void;
    playRisingRumble: () => void;
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
    onFireTears,
    onFireSparkles,
    onFireFireworks,
  }: {
    game: GameStateResponse;
    sounds: Sounds;
    onFireConfetti: (big: boolean) => void;
    onFireTears: () => void;
    onFireSparkles: () => void;
    onFireFireworks: (bursts?: number) => void;
  } = $props();

  let revealDone = $state(false);
  let charging = $state(false);
  let flashing = $state(false);
  let revealed = $state(false);
  let showWinner = $state(false);

  const MIN_PX = 110;
  const MAX_PX = 280;

  let strawHeights = $derived.by(() => {
    if (!game.straws || game.straws.length === 0) return [];
    const vals = game.straws.filter(v => v !== null) as number[];
    const maxVal = Math.max(...vals, 1);
    return game.straws.map(v => v === null ? MIN_PX : Math.round(MIN_PX + (v / maxVal) * (MAX_PX - MIN_PX)));
  });

  function isWinnerIndex(i: number) {
    if (!game.winner_token) return false;
    const winner = game.players.find(p => p.token === game.winner_token);
    return winner?.straw_index === i;
  }

  function getStrawPlayer(i: number) {
    return game.players.find(p => p.straw_index === i) ?? null;
  }

  let iWon = $derived(game.winner_token !== null && game.my_token === game.winner_token);
  let winnerPlayer = $derived(game.players.find(p => p.token === game.winner_token) ?? null);

  let winnerMessage = $derived.by(() => {
    if (!winnerPlayer) return '';
    if (iWon) return "Take it. Walk slowly. Don't apologise.";
    const me = game.players.find(p => p.is_me);
    return me
      ? "Pretend you're happy for them. That's professionalism."
      : `${winnerPlayer.name} drew the longest straw.`;
  });

  // Run reveal sequence once
  let hasRun = false;
  $effect(() => {
    if (hasRun) return;
    hasRun = true;

    sounds.playDrumroll(3000);
    sounds.playRisingRumble();
    sounds.playSparkleChime();
    onFireSparkles();
    charging = true;

    const t1 = setTimeout(() => {
      charging = false;
      flashing = true;
      revealed = true;
      setTimeout(() => { flashing = false; }, 600);

      // Trigger CSS height transition by updating reactive state
      setTimeout(() => {
        showWinner = true;
        revealDone = true;
        if (iWon) {
          // Big celebratory stack: horn + fanfare, a roaring crowd, fireworks
          // and confetti — then a final round of applause + a second pop.
          sounds.playPartyHorn();
          sounds.playWinFanfare();
          sounds.playCheer(2400);
          sounds.playApplause(3000);
          onFireConfetti(true);
          onFireFireworks(7);
          setTimeout(() => { onFireConfetti(true); sounds.playTada(); }, 1100);
          setTimeout(() => onFireFireworks(4), 1600);
        } else {
          setTimeout(() => sounds.playLoseTrombone(), 500);
          onFireTears();
        }
      }, 1100);
    }, 3000);

    return () => { clearTimeout(t1); };
  });
</script>

<!-- Straws -->
<div class="straws reveal-stage" class:drumroll={!revealed}>
  {#each (game.straws ?? []) as _straw, i}
    {@const winner = isWinnerIndex(i)}
    {@const player = getStrawPlayer(i)}
    {@const h = revealed ? (strawHeights[i] ?? MIN_PX) : 240}
    {@const isLean = !winner && i % 2 === 0}

    <div
      class="straw"
      class:winner={winner && revealed}
      class:loser={!winner && revealed}
      class:lean-right={isLean && revealed}
      class:taken={!!player}
      class:mine={player?.is_me ?? false}
      style="height: {h}px;"
    >
      <div class="straw-number">{i + 1}</div>
      {#if player}
        <div class="straw-tag">{player.is_me ? 'you' : player.name}</div>
      {/if}
    </div>
  {/each}
</div>
<div class="cup"></div>

<!-- Stage charge glow overlay -->
{#if charging}
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 60%, rgba(255,210,74,0.28), transparent 65%);pointer-events:none;z-index:1;animation:charging-pulse 0.45s ease-in-out infinite alternate;"></div>
{/if}

<!-- Flash overlay -->
{#if flashing}
  <div class="cup-stage flash" style="position:absolute;inset:0;pointer-events:none;z-index:2;"></div>
{/if}

<!-- Winner overlay -->
{#if showWinner && winnerPlayer}
  <div class="stage-overlay" style="pointer-events:none;">
    <div class="overlay-headline">🍫 Longest straw belongs to</div>
    <div class="winner-name">{winnerPlayer.name}</div>
    <div class="overlay-sub">{winnerMessage}</div>
  </div>
{/if}
