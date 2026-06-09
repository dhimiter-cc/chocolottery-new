<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  let {
    state,
    code,
    mobile = false,
  }: {
    state: GameStateResponse;
    code: string;
    mobile?: boolean;
  } = $props();

  let inputText = $state('');
  let messagesEl: HTMLDivElement;
  let pinnedToBottom = $state(true);
  let rateLimitToast = $state(false);
  let rateLimitTimer: ReturnType<typeof setTimeout> | null = null;

  // Auto-scroll when new messages arrive
  $effect(() => {
    // Depend on message count
    const _msgs = state.chat.length;
    if (pinnedToBottom && messagesEl) {
      // Use microtask to scroll after DOM update
      Promise.resolve().then(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      });
    }
  });

  function handleScroll() {
    if (!messagesEl) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesEl;
    pinnedToBottom = scrollHeight - scrollTop - clientHeight < 40;
  }

  async function sendMessage() {
    const text = inputText.trim();
    if (!text) return;
    inputText = '';

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, text }),
    });

    if (res.status === 429) {
      if (rateLimitTimer) clearTimeout(rateLimitTimer);
      rateLimitToast = true;
      rateLimitTimer = setTimeout(() => (rateLimitToast = false), 2000);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function formatTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

{#if mobile}
  <!-- Mobile: bottom sheet -->
  <div
    class="fixed bottom-0 left-0 right-0 z-40 flex flex-col rounded-t-2xl overflow-hidden"
    style="height: 65vh; background: white; box-shadow: 0 -4px 24px rgba(0,0,0,0.15);"
  >
    <!-- Handle -->
    <div class="flex justify-center pt-3 pb-2 flex-shrink-0">
      <div class="w-10 h-1 rounded-full bg-gray-300"></div>
    </div>

    <div class="px-4 pb-2 flex-shrink-0 border-b border-gray-100">
      <h3 class="text-sm font-semibold text-gray-700">Chat</h3>
    </div>

    <!-- Messages -->
    <div
      bind:this={messagesEl}
      onscroll={handleScroll}
      class="flex-1 overflow-y-auto flex flex-col gap-1 p-3 min-h-0"
    >
      {#each state.chat as msg (msg.id)}
        <div class="flex {msg.mine ? 'justify-end' : 'justify-start'}">
          <div class="max-w-[75%] {msg.mine ? '' : 'flex flex-col'}">
            {#if !msg.mine}
              <span class="text-[10px] text-gray-400 ml-2 mb-0.5">{msg.name}</span>
            {/if}
            <div
              class="px-3 py-2 rounded-2xl text-sm"
              style="
                {msg.mine
                ? 'background: var(--accent,#E89817); color: white; border-radius: 18px 18px 4px 18px;'
                : 'background: #f1f3f4; color: #333; border-radius: 18px 18px 18px 4px;'}
              "
            >
              {msg.text}
            </div>
            <span class="text-[9px] text-gray-300 mt-0.5 {msg.mine ? 'text-right' : 'ml-2'}">
              {formatTime(msg.ts)}
            </span>
          </div>
        </div>
      {/each}

      {#if state.chat.length === 0}
        <p class="text-gray-400 text-xs text-center mt-4">No messages yet. Say hi!</p>
      {/if}
    </div>

    <!-- Input -->
    <div class="p-3 border-t border-gray-100 flex-shrink-0">
      {#if rateLimitToast}
        <p class="text-orange-500 text-xs text-center mb-1 font-medium">Too fast!</p>
      {/if}
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={inputText}
          onkeydown={handleKeydown}
          placeholder="Message…"
          maxlength="200"
          class="flex-1 rounded-full px-4 py-2 text-sm outline-none"
          style="background: #f1f3f4; border: none; color: #333;"
        />
        <button
          onclick={sendMessage}
          disabled={!inputText.trim()}
          class="w-9 h-9 rounded-full flex items-center justify-center text-white text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
          style="background: var(--accent,#E89817);"
        >
          ↑
        </button>
      </div>
    </div>
  </div>
{:else}
  <!-- Desktop: inline panel -->
  <div
    class="flex flex-col h-full rounded-xl overflow-hidden"
    style="background: var(--panel, rgba(255,255,255,0.06)); border: 1px solid rgba(255,255,255,0.1);"
  >
    <div class="px-4 py-3 flex-shrink-0 border-b" style="border-color: rgba(255,255,255,0.08);">
      <h3 class="text-white/60 text-xs font-semibold uppercase tracking-widest">Chat</h3>
    </div>

    <!-- Messages -->
    <div
      bind:this={messagesEl}
      onscroll={handleScroll}
      class="flex-1 overflow-y-auto flex flex-col gap-1 p-3 min-h-0"
    >
      {#each state.chat as msg (msg.id)}
        <div class="flex {msg.mine ? 'justify-end' : 'justify-start'}">
          <div class="max-w-[80%] flex flex-col">
            {#if !msg.mine}
              <span class="text-[10px] text-white/30 ml-2 mb-0.5">{msg.name}</span>
            {/if}
            <div
              class="px-3 py-2 rounded-2xl text-sm text-white"
              style="
                {msg.mine
                ? 'background: var(--accent,#E89817); border-radius: 18px 18px 4px 18px;'
                : 'background: rgba(255,255,255,0.1); border-radius: 18px 18px 18px 4px;'}
              "
            >
              {msg.text}
            </div>
            <span class="text-[9px] text-white/20 mt-0.5 {msg.mine ? 'text-right mr-1' : 'ml-2'}">
              {formatTime(msg.ts)}
            </span>
          </div>
        </div>
      {/each}

      {#if state.chat.length === 0}
        <p class="text-white/25 text-xs text-center mt-4">No messages yet</p>
      {/if}
    </div>

    <!-- Input -->
    <div
      class="p-3 flex-shrink-0 border-t"
      style="border-color: rgba(255,255,255,0.08);"
    >
      {#if rateLimitToast}
        <p class="text-orange-400 text-xs text-center mb-1 font-medium">Too fast!</p>
      {/if}
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={inputText}
          onkeydown={handleKeydown}
          placeholder="Message…"
          maxlength="200"
          class="flex-1 rounded-full px-3 py-2 text-sm outline-none transition-all"
          style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: white;"
        />
        <button
          onclick={sendMessage}
          disabled={!inputText.trim()}
          class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm transition-all hover:scale-105 active:scale-95 disabled:opacity-40 flex-shrink-0"
          style="background: var(--accent,#E89817);"
        >
          ↑
        </button>
      </div>
    </div>
  </div>
{/if}
