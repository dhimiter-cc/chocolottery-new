<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  let { state, code }: { state: GameStateResponse; code: string } = $props();

  let suggestText = $state('');
  let suggestError = $state('');
  let suggestLoading = $state(false);

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

  // Check if a cupboard item text matches a suggestion
  function isSuggested(itemName: string) {
    return state.suggestions.find(
      (s) => s.text.toLowerCase().trim() === itemName.toLowerCase().trim(),
    );
  }

  async function handleChipClick(itemName: string) {
    const existing = isSuggested(itemName);
    if (existing) {
      if (!existing.voted) {
        await vote(existing.id);
      }
      return;
    }
    await suggest(itemName);
  }

  async function suggest(text: string) {
    suggestLoading = true;
    suggestError = '';
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, text }),
      });
      if (res.status === 409) {
        suggestError = 'Already suggested';
      }
    } catch {
      suggestError = 'Failed to suggest';
    } finally {
      suggestLoading = false;
    }
  }

  async function vote(id: string) {
    await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, id }),
    });
  }

  async function handleSuggestSubmit(e: SubmitEvent) {
    e.preventDefault();
    const text = suggestText.trim();
    if (!text) return;
    await suggest(text);
    suggestText = '';
  }

  // Players who haven't voted on any suggestion
  let nonVoters = $derived.by(() => {
    if (state.suggestions.length === 0) return [];
    const votedTokens = new Set(state.suggestions.flatMap((s) => s.voted_tokens));
    return state.players.filter((p) => !votedTokens.has(p.token));
  });

  let availableCupboard = $derived(state.cupboard.filter((item) => item.stock > 0));
</script>

<div class="flex flex-col gap-6 p-4 overflow-y-auto h-full">
  <!-- Section 1: Quick-pick chips -->
  {#if availableCupboard.length > 0}
    <div>
      <h3 class="text-white/50 text-xs uppercase tracking-widest mb-3 font-semibold">Quick Pick</h3>
      <div class="flex flex-wrap gap-2">
        {#each availableCupboard as item (item.id)}
          {@const suggested = isSuggested(item.name)}
          {@const voted = suggested?.voted ?? false}
          {@const listed = !!suggested && !voted}

          <button
            onclick={() => handleChipClick(item.name)}
            class="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 hover:scale-105 active:scale-95"
            style="
              {voted
              ? 'background: var(--accent,#E89817); color: white; box-shadow: 0 2px 8px rgba(232,152,23,0.4);'
              : listed
                ? 'background: transparent; border: 1.5px solid var(--accent,#E89817); color: var(--accent,#E89817);'
                : 'background: rgba(255,255,255,0.1); border: 1.5px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.75);'}
            "
          >
            {item.name}
            {#if voted}✓{/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Section 2: Suggest form -->
  <div>
    <h3 class="text-white/50 text-xs uppercase tracking-widest mb-3 font-semibold">Suggest a Snack</h3>
    <form onsubmit={handleSuggestSubmit} class="flex gap-2">
      <input
        type="text"
        bind:value={suggestText}
        placeholder="Snack name…"
        maxlength="60"
        class="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-all"
        style="background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.15); color: white; placeholder-color: rgba(255,255,255,0.35);"
      />
      <button
        type="submit"
        disabled={suggestLoading || !suggestText.trim()}
        class="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        style="background: var(--accent,#E89817);"
      >
        Add
      </button>
    </form>
    {#if suggestError}
      <p class="text-orange-400 text-xs mt-1.5">{suggestError}</p>
    {/if}
  </div>

  <!-- Section 3: Suggestions list -->
  {#if state.suggestions.length > 0}
    <div>
      <h3 class="text-white/50 text-xs uppercase tracking-widest mb-3 font-semibold">Suggestions</h3>
      <div class="flex flex-col gap-2">
        {#each [...state.suggestions].sort((a, b) => b.votes - a.votes) as s (s.id)}
          <div
            class="flex items-center gap-3 rounded-xl px-3 py-2.5"
            style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);"
          >
            <div class="flex-1 min-w-0">
              <p class="text-white text-sm font-medium truncate">{s.text}</p>
              <p class="text-white/40 text-xs mt-0.5">{s.author_name}</p>
            </div>
            <button
              onclick={() => vote(s.id)}
              class="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95"
              style="
                {s.voted
                ? 'background: var(--accent,#E89817); color: white;'
                : 'background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.6);'}
              "
            >
              ↑ {s.votes}
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Section 4: Non-voters -->
  {#if state.suggestions.length > 0 && nonVoters.length > 0}
    <div>
      <h3 class="text-white/50 text-xs uppercase tracking-widest mb-3 font-semibold">Hasn't voted yet</h3>
      <div class="flex flex-wrap gap-2 items-center">
        {#each nonVoters as player (player.token)}
          <div class="flex items-center gap-1.5">
            <div
              class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
              style="background: {avatarColor(player.name)};"
            >
              {avatarInitial(player.name)}
            </div>
            <span class="text-white/50 text-xs">{player.name}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
