<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  let { state, onPick }: { state: GameStateResponse; onPick: (index: number) => void } = $props();

  const QUIPS = [
    "Choose wisely. Or don't. It's basically a coin flip.",
    'Your fate is in your hands. Literally.',
    'Pick the one that speaks to your soul.',
    "There's no strategy here. We checked.",
    'Any straw could be the one. Even that one.',
    "Think carefully. Just kidding, it's random.",
    'The straws have been judged. One is superior.',
  ];

  let quip = $derived.by(() => {
    if (!state.my_token) return QUIPS[0];
    const seed = state.my_token.charCodeAt(0) % QUIPS.length;
    return QUIPS[seed];
  });

  // Track just-picked animations per straw index
  let justPicked: Set<number> = $state(new Set());

  function getStrawPlayer(i: number) {
    return state.players.find((p) => p.straw_index === i) ?? null;
  }

  function isTaken(i: number) {
    return state.players.some((p) => p.straw_index === i);
  }

  function isMine(i: number) {
    return state.my_straw === i;
  }

  function handlePick(i: number) {
    if (isTaken(i)) return;
    if (state.my_straw !== null) return;

    justPicked = new Set([...justPicked, i]);
    setTimeout(() => {
      justPicked = new Set([...justPicked].filter((x) => x !== i));
    }, 700);

    onPick(i);
  }

  let strawCount = $derived(state.straws ? state.straws.length : state.players.length || 4);
</script>

{#if state.in_game === false}
  <!-- Excluded banner -->
  <div
    class="excluded-banner absolute inset-0 flex flex-col items-center justify-center z-10"
    style="background: rgba(0,0,0,0.75);"
  >
    <div class="text-5xl mb-4">😬</div>
    <h2 class="text-2xl font-bold mb-3" style="color: var(--accent, #E89817);">
      You missed this round
    </h2>
    <p class="text-white/60 text-sm text-center max-w-xs leading-relaxed">
      You weren't online when the game started. Sit tight — you can join the next one!
    </p>
  </div>
{:else}
  <div class="flex flex-col items-center justify-center min-h-full w-full px-4 py-10 select-none">
    <p class="text-white/50 text-sm italic mb-8 text-center max-w-xs">{quip}</p>

    <!-- Straws row -->
    <div class="flex flex-row items-end justify-center gap-3 overflow-x-auto pb-4 px-2 w-full max-w-2xl">
      {#each Array.from({ length: strawCount }, (_, i) => i) as i}
        {@const taken = isTaken(i)}
        {@const mine = isMine(i)}
        {@const disabled = state.my_straw !== null || taken}
        {@const picking = justPicked.has(i)}
        {@const player = getStrawPlayer(i)}

        <div class="flex flex-col items-center gap-1.5" style="animation-delay: {i * 60}ms;">
          <!-- Name tag above straw -->
          <div class="h-6 flex items-center">
            {#if player}
              <span
                class="text-[10px] font-semibold px-2 py-0.5 rounded-full max-w-[72px] truncate"
                style="background: rgba(255,255,255,0.12); color: {mine ? 'var(--accent, #E89817)' : 'rgba(255,255,255,0.75)'};"
              >
                {player.name}
              </span>
            {/if}
          </div>

          <!-- Straw body -->
          <button
            class="straw relative flex items-end justify-center rounded-t-full rounded-b-sm cursor-pointer transition-all duration-200
                   {taken ? 'taken' : ''}
                   {mine ? 'mine' : ''}
                   {disabled && !taken ? 'disabled' : ''}
                   {picking ? 'just-picked' : ''}"
            onclick={() => handlePick(i)}
            disabled={disabled}
            style="
              width: 28px;
              height: {50 + Math.random() * 60}px;
              min-height: 50px;
              background: {taken
              ? mine
                ? 'linear-gradient(180deg, var(--accent,#E89817) 0%, #c57a10 100%)'
                : 'rgba(255,255,255,0.18)'
              : 'linear-gradient(180deg, #e0c97a 0%, #b8860b 100%)'};
              border: 2px solid {taken ? (mine ? 'var(--accent,#E89817)' : 'rgba(255,255,255,0.2)') : '#d4a017'};
              opacity: {disabled && !mine ? '0.55' : '1'};
              animation-delay: {i * 60}ms;
            "
          >
            <!-- Straw number label -->
            <span
              class="absolute bottom-1 text-[9px] font-bold"
              style="color: {taken ? (mine ? 'white' : 'rgba(255,255,255,0.5)') : '#7a5500'};"
            >
              {i + 1}
            </span>
          </button>
        </div>
      {/each}
    </div>

    {#if state.my_straw !== null}
      <p class="text-white/50 text-sm mt-6">
        You picked straw #{state.my_straw + 1}. Waiting for others…
      </p>
    {:else}
      <p class="text-white/60 text-sm mt-6">Pick a straw!</p>
    {/if}
  </div>
{/if}

<style>
  .straw {
    transform-origin: bottom center;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .straw:not(.taken):not(.disabled):hover {
    transform: scaleY(1.06) translateY(-3px);
    box-shadow: 0 6px 18px rgba(232, 152, 23, 0.45);
  }

  .straw.just-picked {
    animation: strawPop 0.35s ease forwards;
  }

  .straw.mine {
    box-shadow: 0 0 0 3px rgba(232, 152, 23, 0.5), 0 4px 16px rgba(232, 152, 23, 0.3);
  }

  @keyframes strawPop {
    0% { transform: scale(1); }
    40% { transform: scale(1.18) translateY(-6px); }
    100% { transform: scale(1); }
  }
</style>
