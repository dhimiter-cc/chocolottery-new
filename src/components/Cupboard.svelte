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
  let addStock = $state(1);
  let addLoading = $state(false);
  let confirmGiveId = $state<string | null>(null);

  $effect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  async function addItem() {
    if (!addName.trim()) return;
    addLoading = true;
    try {
      await fetch('/api/cupboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', code, name: addName.trim(), stock: addStock }),
      });
      addName = '';
      addStock = 1;
    } finally {
      addLoading = false;
    }
  }

  async function updateStock(id: string, delta: number) {
    const item = state.cupboard.find((i) => i.id === id);
    if (!item) return;
    const newStock = Math.max(0, item.stock + delta);
    await fetch('/api/cupboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', code, id, stock: newStock }),
    });
  }

  async function removeItem(id: string) {
    await fetch('/api/cupboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', code, id }),
    });
  }

  async function giveItem(id: string) {
    await fetch('/api/cupboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'give', code, id }),
    });
    confirmGiveId = null;
  }

  async function ungiveItem(id: string) {
    await fetch('/api/cupboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ungive', code, id }),
    });
  }

  let isLobby = $derived(state.state === 'lobby');
  let isRevealOrDone = $derived(state.state === 'reveal' || state.state === 'done');
</script>

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    style="background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
  >
    <!-- Card -->
    <div
      class="relative w-full max-w-lg bg-white rounded-xl shadow-2xl p-6 max-h-[85vh] flex flex-col"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-5 flex-shrink-0">
        <h2 class="text-lg font-bold text-gray-800">Snack Cupboard</h2>
        <button
          onclick={onClose}
          class="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
        >
          ✕
        </button>
      </div>

      <div class="flex-1 overflow-y-auto min-h-0">
        <!-- LOBBY: host management -->
        {#if isLobby && state.is_host}
          <!-- Add form -->
          <div class="flex gap-2 mb-5">
            <input
              type="text"
              bind:value={addName}
              placeholder="Snack name…"
              maxlength="60"
              class="flex-1 rounded-lg px-3 py-2 text-sm border border-gray-200 outline-none focus:border-orange-400 transition-colors"
            />
            <input
              type="number"
              bind:value={addStock}
              min="1"
              max="99"
              class="w-16 rounded-lg px-2 py-2 text-sm border border-gray-200 outline-none focus:border-orange-400 transition-colors text-center"
            />
            <button
              onclick={addItem}
              disabled={addLoading || !addName.trim()}
              class="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
              style="background: var(--accent,#E89817);"
            >
              Add
            </button>
          </div>

          <!-- Items list -->
          <div class="flex flex-col gap-2">
            {#each state.cupboard as item (item.id)}
              <div
                class="flex items-center gap-3 rounded-lg px-3 py-2 border transition-opacity"
                style="border-color: #e5e7eb; opacity: {item.stock === 0 ? '0.5' : '1'};"
              >
                <span class="flex-1 text-sm font-medium text-gray-700 truncate">{item.name}</span>

                <span
                  class="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style="background: var(--accent,#E89817); min-width: 28px; text-align: center;"
                >
                  {item.stock}
                </span>

                <div class="flex items-center gap-1">
                  <button
                    onclick={() => updateStock(item.id, -1)}
                    disabled={item.stock === 0}
                    class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-30 flex items-center justify-center"
                  >
                    −
                  </button>
                  <button
                    onclick={() => updateStock(item.id, 1)}
                    class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                  >
                    +
                  </button>
                  <button
                    onclick={() => removeItem(item.id)}
                    class="w-7 h-7 rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 text-xs transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                  >
                    ✕
                  </button>
                </div>
              </div>
            {/each}

            {#if state.cupboard.length === 0}
              <p class="text-gray-400 text-sm text-center py-4 italic">No snacks yet. Add some!</p>
            {/if}
          </div>

        <!-- REVEAL/DONE: give to winner -->
        {:else if isRevealOrDone && state.is_host}
          <h3 class="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">Give to winner</h3>

          {#if state.prize_given_id}
            <div
              class="flex items-center gap-3 rounded-lg px-4 py-3 mb-4"
              style="background: #f0fdf4; border: 1.5px solid #bbf7d0;"
            >
              <span class="text-green-600 text-lg">✓</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-green-700">Given: {state.prize_given_name}</p>
              </div>
              <button
                onclick={() => state.prize_given_id && ungiveItem(state.prize_given_id)}
                class="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
              >
                Undo
              </button>
            </div>
          {/if}

          <div class="flex flex-col gap-2">
            {#each state.cupboard.filter((i) => i.stock > 0) as item (item.id)}
              <div class="flex items-center gap-3 rounded-lg px-3 py-2 border border-gray-100">
                <span class="flex-1 text-sm font-medium text-gray-700">{item.name}</span>
                <span
                  class="px-2 py-0.5 rounded-full text-xs font-bold text-white mr-1"
                  style="background: var(--accent,#E89817);"
                >
                  {item.stock}
                </span>

                {#if confirmGiveId === item.id}
                  <div class="flex items-center gap-1.5">
                    <button
                      onclick={() => giveItem(item.id)}
                      class="px-3 py-1 rounded-lg text-xs font-semibold text-white transition-all hover:scale-105"
                      style="background: #0F9D6E;"
                    >
                      Mark given (−1)
                    </button>
                    <button
                      onclick={() => (confirmGiveId = null)}
                      class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                {:else}
                  <button
                    onclick={() => (confirmGiveId = item.id)}
                    class="px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:scale-105 active:scale-95"
                    style="background: rgba(232,152,23,0.1); color: var(--accent,#E89817); border: 1px solid rgba(232,152,23,0.3);"
                  >
                    Give
                  </button>
                {/if}
              </div>
            {/each}

            {#if state.cupboard.filter((i) => i.stock > 0).length === 0}
              <p class="text-gray-400 text-sm text-center py-4 italic">No items in stock</p>
            {/if}
          </div>

        {:else}
          <!-- Read-only view for non-hosts -->
          <div class="flex flex-col gap-2">
            {#each state.cupboard as item (item.id)}
              <div
                class="flex items-center gap-3 rounded-lg px-3 py-2 border border-gray-100"
                style="opacity: {item.stock === 0 ? '0.45' : '1'};"
              >
                <span class="flex-1 text-sm text-gray-700">{item.name}</span>
                <span
                  class="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style="background: {item.stock > 0 ? 'var(--accent,#E89817)' : '#aaa'};"
                >
                  {item.stock}
                </span>
              </div>
            {/each}
            {#if state.cupboard.length === 0}
              <p class="text-gray-400 text-sm text-center py-4 italic">No snacks in the cupboard</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
