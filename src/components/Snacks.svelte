<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  let { game, code, onOpenCupboard }: { game: GameStateResponse; code: string; onOpenCupboard?: () => void } = $props();

  let suggestText = $state('');
  let snackError = $state('');
  let suggestLoading = $state(false);

  function avatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    const hue = ((h % 360) + 360) % 360;
    return `linear-gradient(160deg, hsl(${hue} 70% 60%), hsl(${(hue + 30) % 360} 60% 38%))`;
  }

  function avatarInitial(name: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  function isSuggested(itemName: string) {
    return game.suggestions.find(s => s.text.toLowerCase().trim() === itemName.toLowerCase().trim());
  }

  async function suggest(text: string) {
    suggestLoading = true;
    snackError = '';
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, text }),
      });
      const data = await res.json();
      if (data.error) snackError = data.error;
    } catch { snackError = 'Could not add'; }
    finally { suggestLoading = false; }
  }

  async function vote(id: string) {
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, id }),
      });
      const data = await res.json();
      if (data.error) snackError = data.error;
    } catch {}
  }

  async function handleChipClick(itemName: string) {
    snackError = '';
    const existing = isSuggested(itemName);
    if (existing) {
      if (!existing.voted) await vote(existing.id);
      return;
    }
    await suggest(itemName);
  }

  async function handleSuggestSubmit(e: SubmitEvent) {
    e.preventDefault();
    const text = suggestText.trim();
    if (!text) return;
    await suggest(text);
    if (!snackError) suggestText = '';
  }

  let nonVoters = $derived.by(() => {
    if (game.suggestions.length === 0) return [];
    const votedTokens = new Set(game.suggestions.flatMap(s => s.voted_tokens));
    return game.players.filter(p => !votedTokens.has(p.token));
  });

  let availableCupboard = $derived(game.cupboard.filter(item => item.stock > 0));
</script>

<div class="section-head">
  <h2>Snack votes</h2>
  <div class="section-head-right">
    <button type="button" class="cupboard-trigger-btn" onclick={onOpenCupboard}>🍫 Cupboard</button>
    <span class="count">{game.suggestions.length}</span>
  </div>
</div>
<p class="muted">Pitch ideas. Upvote favourites. Highest-voted wins. Tie or no votes? Random. (Dwight, no beets.)</p>

<!-- Quick-pick chips from cupboard -->
{#if availableCupboard.length > 0}
  <div class="snack-quick-wrap">
    <div class="snack-quick-label">In stock — click to add &amp; vote</div>
    <div class="snack-quick-picks">
      {#each availableCupboard as item (item.id)}
        {@const existing = isSuggested(item.name)}
        {@const voted = existing?.voted ?? false}
        {@const listed = !!existing && !voted}
        <button
          type="button"
          class="quick-pick-chip"
          class:voted={voted}
          class:listed={listed}
          title={existing
            ? (voted ? `Your vote is in (${existing.votes})` : `Already listed — click to vote (${existing.votes})`)
            : 'Add to suggestions & vote'}
          onclick={() => handleChipClick(item.name)}
        >
          {item.name}
        </button>
      {/each}
    </div>
  </div>
{/if}

<div class="snack-form-divider">or type your own</div>

<form class="snack-form" onsubmit={handleSuggestSubmit}>
  <input
    type="text"
    bind:value={suggestText}
    maxlength="80"
    placeholder="Tim Tams, Speculoos, that weird Schrute beet thing…"
    autocomplete="off"
  />
  <button type="submit" class="btn" disabled={suggestLoading || !suggestText.trim()}>Add</button>
</form>

<div class="snacks-list">
  {#if game.suggestions.length === 0}
    <div class="snacks-empty">No suggestions yet. Be brave. Be specific. Be Kevin.</div>
  {:else}
    {#each game.suggestions as s (s.id)}
      <div class="snack" class:voted={s.voted}>
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
        <div class="snack-vote" onclick={() => vote(s.id)}>
          <span class="arrow">▲</span>
          <span class="num">{s.votes}</span>
        </div>
        <div class="snack-text">{s.text}</div>
        <div class="snack-author">— {s.author_name}</div>
      </div>
    {/each}
  {/if}
</div>

<!-- Non-voter nudge banner -->
{#if game.suggestions.length > 0 && nonVoters.length > 0}
  <div class="snack-non-voters">
    <span class="non-voter-label">Still need votes:</span>
    {#each nonVoters as p (p.token)}
      <button
        type="button"
        class="non-voter-chip"
        class:is-me={p.is_me}
        style="background: {avatarColor(p.name)};"
        title="{p.name}{p.is_me ? ' (you)' : ''}"
      >
        {avatarInitial(p.name)}
      </button>
    {/each}
  </div>
{/if}

{#if snackError}<p class="error">{snackError}</p>{/if}
