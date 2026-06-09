<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  let { state, onStart }: { state: GameStateResponse; onStart: () => void } = $props();

  function avatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `linear-gradient(160deg, hsl(${hue} 70% 60%), hsl(${(hue + 30) % 360} 60% 38%))`;
  }

  function avatarInitial(name: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  let onlinePlayers = $derived(state.players.filter((p) => p.online));
  let canStart = $derived(onlinePlayers.length >= 2);
</script>

<div
  class="relative flex flex-col items-center justify-center min-h-full w-full px-6 py-10 select-none"
  style="background: var(--stage);"
>
  <h2 class="text-white/60 text-sm font-semibold uppercase tracking-widest mb-8">
    Waiting for players
  </h2>

  <!-- Player avatars grid -->
  <div class="flex flex-wrap justify-center gap-4 max-w-lg mb-10">
    {#each state.players as player (player.token)}
      <div class="relative flex flex-col items-center gap-2">
        <div
          class="relative w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg transition-all duration-300"
          style="background: {avatarColor(player.name)}; {!player.online ? 'opacity:0.6;filter:grayscale(1);' : ''}"
        >
          {avatarInitial(player.name)}
          {#if player.online}
            <span
              class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[color:var(--stage)] bg-[#0F9D6E]"
            ></span>
          {/if}
        </div>
        <span class="text-white/80 text-xs font-medium max-w-[72px] truncate text-center">
          {player.name}
        </span>
      </div>
    {/each}

    {#if state.players.length === 0}
      <p class="text-white/40 text-sm italic">No players yet...</p>
    {/if}
  </div>

  <!-- Phase detail -->
  <p class="text-white/50 text-sm mb-8 text-center max-w-xs">
    {onlinePlayers.length} player{onlinePlayers.length !== 1 ? 's' : ''} online
    {#if state.players.length > onlinePlayers.length}
      · {state.players.length - onlinePlayers.length} away
    {/if}
  </p>

  <!-- Start button (host only) -->
  {#if state.is_host}
    <button
      onclick={onStart}
      disabled={!canStart}
      class="px-8 py-3 rounded-xl font-bold text-white text-base shadow-lg transition-all duration-200
             disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100
             hover:scale-105 active:scale-95"
      style="background: linear-gradient(135deg, #E89817 0%, #F0B429 100%);
             box-shadow: 0 4px 20px rgba(232,152,23,0.4);"
    >
      Start Game
    </button>
    {#if !canStart}
      <p class="text-white/40 text-xs mt-3">Need at least 2 players online to start</p>
    {/if}
  {:else}
    <p class="text-white/40 text-sm italic">Waiting for the host to start…</p>
  {/if}
</div>
