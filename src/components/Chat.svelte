<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';

  let {
    state,
    code,
    onClose,
  }: {
    state: GameStateResponse;
    code: string;
    onClose?: () => void;
  } = $props();

  let inputText = $state('');
  let chatError = $state('');
  let chatLogEl: HTMLDivElement | undefined = $state();
  let pinnedToBottom = $state(true);

  $effect(() => {
    const _len = state.chat.length;
    if (pinnedToBottom && chatLogEl) {
      Promise.resolve().then(() => {
        if (chatLogEl) chatLogEl.scrollTop = chatLogEl.scrollHeight;
      });
    }
  });

  function handleScroll() {
    if (!chatLogEl) return;
    const { scrollTop, scrollHeight, clientHeight } = chatLogEl;
    pinnedToBottom = scrollHeight - scrollTop - clientHeight < 40;
  }

  async function sendMessage(e: SubmitEvent) {
    e.preventDefault();
    const text = inputText.trim();
    chatError = '';
    if (!text) return;
    inputText = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, text }),
      });
      const data = await res.json();
      if (data.error) { chatError = data.error; return; }
      pinnedToBottom = true;
    } catch { chatError = 'Could not send'; }
  }
</script>

<div class="section-head">
  <h2>💬 Chat</h2>
  <div class="section-head-right">
    <span class="count">{state.chat.length}</span>
    <button type="button" class="chat-drawer-close" onclick={onClose}>✕</button>
  </div>
</div>

<div
  bind:this={chatLogEl}
  class="chat-log"
  onscroll={handleScroll}
>
  {#if state.chat.length === 0}
    <div class="chat-empty">No messages yet. Break the ice.</div>
  {:else}
    {#each state.chat as msg (msg.id)}
      <div class="chat-msg" class:mine={msg.mine}>
        <div class="who">{msg.mine ? 'you' : msg.name}</div>
        <div class="text">{msg.text}</div>
      </div>
    {/each}
  {/if}
</div>

<form class="chat-form" onsubmit={sendMessage}>
  <input
    type="text"
    bind:value={inputText}
    maxlength="240"
    placeholder="say something…"
    autocomplete="off"
  />
  <button type="submit" class="btn">Send</button>
</form>
{#if chatError}<p class="error">{chatError}</p>{/if}
