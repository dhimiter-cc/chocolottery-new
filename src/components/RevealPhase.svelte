<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  interface Sounds {
    playDrumroll: (ms: number) => void;
    playWinFanfare: () => void;
    playLoseTrombone: () => void;
    playRisingRumble: () => void;
  }

  let {
    state,
    sounds,
    onFireConfetti,
    onFireTears,
    onFireSparkles,
  }: {
    state: GameStateResponse;
    sounds: Sounds;
    onFireConfetti: (big: boolean) => void;
    onFireTears: () => void;
    onFireSparkles: () => void;
  } = $props();

  let revealDone = $state(false);
  let flashActive = $state(false);
  let showWinner = $state(false);
  let revealed = $state(false);

  const MIN_PX = 110;
  const MAX_PX = 280;

  let strawHeights = $derived.by(() => {
    if (!state.straws || state.straws.length === 0) return [];
    const vals = state.straws.filter((v) => v !== null) as number[];
    const maxVal = Math.max(...vals, 1);
    return state.straws.map((v) =>
      v === null ? MIN_PX : MIN_PX + (v / maxVal) * (MAX_PX - MIN_PX),
    );
  });

  function getStrawPlayer(i: number) {
    return state.players.find((p) => p.straw_index === i) ?? null;
  }

  function isWinnerIndex(i: number) {
    if (!state.winner_token) return false;
    const winner = state.players.find((p) => p.token === state.winner_token);
    return winner?.straw_index === i;
  }

  let iWon = $derived(state.winner_token !== null && state.my_token === state.winner_token);

  let winnerPlayer = $derived(state.players.find((p) => p.token === state.winner_token) ?? null);

  let loserIndex = 0;

  $effect(() => {
    sounds.playDrumroll(3000);
    sounds.playRisingRumble();
    onFireSparkles();

    const t1 = setTimeout(() => {
      flashActive = true;
      revealed = true;
    }, 3000);

    const t2 = setTimeout(() => {
      showWinner = true;
      revealDone = true;
      if (iWon) {
        sounds.playWinFanfare();
        onFireConfetti(true);
      } else {
        sounds.playLoseTrombone();
        onFireTears();
      }
    }, 4100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  });
</script>

<div
  class="relative flex flex-col items-end justify-end min-h-full w-full px-4 py-8 transition-all duration-700"
  class:stage-flash={flashActive}
>
  <!-- Straws display -->
  <div class="flex flex-row items-end justify-center gap-3 overflow-x-auto pb-4 px-2 w-full max-w-2xl mx-auto">
    {#each (state.straws ?? []) as _straw, i}
      {@const winner = isWinnerIndex(i)}
      {@const player = getStrawPlayer(i)}
      {@const h = revealed ? strawHeights[i] ?? MIN_PX : 60}
      {@const isLean = !winner && i % 2 === 0}

      <div class="flex flex-col items-center gap-1.5 transition-all duration-500" style="animation-delay: {i * 80}ms;">
        <!-- Name tag -->
        <div class="h-7 flex items-center">
          {#if player && revealed}
            <span
              class="text-[10px] font-semibold px-2 py-0.5 rounded-full max-w-[80px] truncate transition-opacity duration-500"
              style="background: {winner ? 'rgba(232,152,23,0.25)' : 'rgba(255,255,255,0.1)'}; color: {winner ? 'var(--accent,#E89817)' : 'rgba(255,255,255,0.7)'};"
            >
              {player.name}
            </span>
          {/if}
        </div>

        <!-- Straw body -->
        <div
          class="straw {winner ? 'winner' : 'loser'} {isLean ? 'lean-right' : ''} rounded-t-full rounded-b-sm transition-all duration-700"
          style="
            width: 28px;
            height: {h}px;
            background: {winner
            ? 'linear-gradient(180deg, #FFD24A 0%, #E89817 100%)'
            : 'linear-gradient(180deg, #aaa 0%, #666 100%)'};
            border: 2px solid {winner ? '#F0B429' : '#888'};
            box-shadow: {winner ? '0 0 20px rgba(232,152,23,0.6), 0 4px 16px rgba(232,152,23,0.3)' : 'none'};
            transform: {isLean && revealed ? 'rotate(8deg)' : 'none'};
            opacity: {!revealed && player?.straw_index === null ? '0.3' : '1'};
          "
        ></div>

        <!-- Winner crown marker -->
        {#if winner && revealed}
          <span class="text-lg mt-0.5">👑</span>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Winner overlay -->
  {#if showWinner && winnerPlayer}
    <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20 px-6">
      <div
        class="bg-black/60 rounded-2xl p-8 flex flex-col items-center gap-4 backdrop-blur-sm"
        style="animation: countdownPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;"
      >
        <div class="text-5xl">👑</div>
        <div
          class="text-3xl font-extrabold text-white text-center"
          style="text-shadow: 0 2px 12px rgba(232,152,23,0.7);"
        >
          {winnerPlayer.name}
        </div>

        {#if iWon}
          <p class="text-[color:var(--accent,#E89817)] font-semibold text-lg text-center">
            You won! 🎉
          </p>
        {:else}
          <p class="text-white/60 text-base text-center">
            Better luck next time!
          </p>
        {/if}

        <!-- Prize card -->
        {#if state.prize_snack}
          <div
            class="mt-2 rounded-xl px-6 py-4 text-center"
            style="background: rgba(232,152,23,0.15); border: 1px solid rgba(232,152,23,0.3);"
          >
            <p class="text-white/50 text-xs uppercase tracking-widest mb-1">Prize Snack</p>
            <p class="text-white font-bold text-xl">{state.prize_snack.text}</p>
            {#if state.prize_snack.random}
              <span class="text-white/40 text-xs mt-1 block">Randomly selected</span>
            {:else}
              <span class="text-white/40 text-xs mt-1 block">
                {state.prize_snack.votes} vote{state.prize_snack.votes !== 1 ? 's' : ''}
                · by {state.prize_snack.author_name}
              </span>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .stage-flash {
    animation: stageFlash 0.6s ease both;
  }

  @keyframes stageFlash {
    0% { background: var(--stage); }
    30% { background: rgba(255, 255, 200, 0.12); }
    100% { background: var(--stage); }
  }

  @keyframes countdownPop {
    from { opacity: 0; transform: scale(0.6); }
    to { opacity: 1; transform: scale(1); }
  }

  .straw {
    transition: height 0.7s cubic-bezier(0.34, 1.2, 0.64, 1), transform 0.5s ease;
  }
</style>
