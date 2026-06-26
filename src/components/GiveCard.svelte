<script lang="ts">
  // Post-reveal host control: record which cupboard snack was handed to the
  // winner. Extracted from Game.svelte — owns its own selection + error state.
  import type { GameStateResponse } from '../lib/types.js';
  import { post } from '../lib/api.js';

  let { game, code, isHost, onRefresh }: { game: GameStateResponse; code: string; isHost: boolean; onRefresh?: () => void } = $props();

  let giveSelectId = $state('');
  let giveError = $state('');

  let stockedItems = $derived((game.cupboard ?? []).filter(i => i.stock > 0));

  async function handleGive() {
    if (!giveSelectId) return;
    giveError = '';
    try {
      const { data } = await post('/api/cupboard', { action: 'give', code, id: giveSelectId });
      if (data.error) giveError = data.error;
      else onRefresh?.();
    } catch { giveError = 'Could not save'; }
  }

  async function handleUngive() {
    giveError = '';
    try {
      const { data } = await post('/api/cupboard', { action: 'ungive', code });
      if (data.error) giveError = data.error;
      else onRefresh?.();
    } catch { giveError = 'Could not undo'; }
  }
</script>

<div class="give-card">
  <div class="give-label">From the cupboard</div>
  {#if game.prize_given_id}
    <div class="give-status given">✓ {game.prize_given_name} was handed to the winner.</div>
  {:else}
    <div class="give-status">Host: which cupboard snack did the winner get?</div>
  {/if}
  {#if isHost}
    <div class="give-controls">
      {#if !game.prize_given_id}
        {#if stockedItems.length > 0}
          <select bind:value={giveSelectId}>
            {#each stockedItems as item (item.id)}
              <option value={item.id}>{item.name} (×{item.stock})</option>
            {/each}
          </select>
          <button type="button" class="btn btn-primary" onclick={handleGive}>Mark given (−1)</button>
        {:else}
          <span class="muted" style="font-size:0.88rem;">Nothing in stock</span>
        {/if}
      {:else}
        <button type="button" class="btn btn-ghost" onclick={handleUngive}>Undo</button>
      {/if}
    </div>
    {#if giveError}<p class="error" style="margin: 8px 0 0;">{giveError}</p>{/if}
  {/if}
</div>
