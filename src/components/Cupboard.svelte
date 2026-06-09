<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  let {
    state,
    code,
    open,
    onClose,
  }: {
    state: GameStateResponse;
    code: string;
    open: boolean;
    onClose: () => void;
  } = $props();

  let addName = $state('');
  let addStock = $state('1');
  let addLoading = $state(false);
  let cupboardError = $state('');

  $effect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  });

  async function addItem(e: SubmitEvent) {
    e.preventDefault();
    if (!addName.trim()) return;
    addLoading = true;
    cupboardError = '';
    try {
      const res = await fetch('/api/cupboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', code, name: addName.trim(), stock: parseInt(addStock) || 1 }),
      });
      const data = await res.json();
      if (data.error) { cupboardError = data.error; return; }
      addName = '';
      addStock = '1';
    } catch { cupboardError = 'Could not add'; }
    finally { addLoading = false; }
  }

  async function updateStock(id: string, newStock: number) {
    cupboardError = '';
    try {
      const res = await fetch('/api/cupboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', code, id, stock: newStock }),
      });
      const data = await res.json();
      if (data.error) cupboardError = data.error;
    } catch {}
  }

  async function removeItem(id: string, name: string) {
    if (!confirm(`Remove "${name}" from the cupboard?`)) return;
    cupboardError = '';
    try {
      const res = await fetch('/api/cupboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', code, id }),
      });
      const data = await res.json();
      if (data.error) cupboardError = data.error;
    } catch {}
  }

  let editable = $derived(state.is_host && state.state === 'lobby');
  let hint = $derived(
    editable
      ? "What's actually on the shelf. Stock locks when the game starts."
      : (state.is_host ? "Locked while the game is in progress." : "What's on the shelf right now.")
  );
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="modal" onclick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div class="modal-card cupboard-modal-card">
      <div class="section-head" style="margin-bottom:12px;">
        <h2>🍫 The cupboard</h2>
        <span class="count">{state.cupboard.length}</span>
      </div>
      <p class="muted">{hint}</p>

      {#if editable}
        <form class="cupboard-form" onsubmit={addItem}>
          <input type="text" class="cb-name" bind:value={addName} maxlength="60" placeholder="e.g. KitKat" autocomplete="off" />
          <input type="text" class="cb-stock" bind:value={addStock} inputmode="numeric" maxlength="3" placeholder="qty" />
          <button type="submit" class="btn" disabled={addLoading || !addName.trim()}>Add</button>
        </form>
      {/if}

      <div class="cupboard-list">
        {#if state.cupboard.length === 0}
          <div class="cupboard-empty">
            {editable ? 'Cupboard is bare. Add something.' : 'Cupboard is empty.'}
          </div>
        {:else}
          {#each state.cupboard as item (item.id)}
            <div class="cupboard-item" class:empty={item.stock <= 0}>
              <div class="ci-name">{item.name}</div>
              <div class="ci-stock">×{item.stock}</div>
              {#if editable}
                <div class="ci-controls">
                  <button
                    type="button"
                    class="ci-btn"
                    title="Decrease stock"
                    disabled={item.stock <= 0}
                    onclick={() => updateStock(item.id, Math.max(0, item.stock - 1))}
                  >−</button>
                  <button
                    type="button"
                    class="ci-btn"
                    title="Increase stock"
                    onclick={() => updateStock(item.id, item.stock + 1)}
                  >+</button>
                  <button
                    type="button"
                    class="ci-btn del"
                    title="Remove from cupboard"
                    onclick={() => removeItem(item.id, item.name)}
                  >×</button>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </div>

      {#if cupboardError}<p class="error">{cupboardError}</p>{/if}
    </div>
  </div>
{/if}
