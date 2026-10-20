<script lang="ts">
  // One vote as a single slim line, for the bottom of the lobby canvas: a label, a
  // strip of pills (tap one to vote, tap again to take it back) that scrolls
  // sideways when there are many, and a "+" that turns the strip into an input.
  // Used twice there: treat votes and trick votes.
  import type { Snippet } from 'svelte';
  import type { PublicSuggestion } from '../lib/types.js';
  import { post } from '../lib/api.js';

  let {
    kind,
    code,
    icon,
    label,
    hint = '',
    items,
    quick = [],
    placeholder,
    empty,
    attention = false,
    onRefresh,
    extra,
  }: {
    kind: 'snack' | 'trick';
    code: string;
    icon: string;
    label: string;
    /** Tooltip on the label: what this vote is for. */
    hint?: string;
    items: PublicSuggestion[];
    /** Stocked names not suggested yet, offered as one-tap "add and vote" pills. */
    quick?: string[];
    placeholder: string;
    empty: string;
    /** Draw the eye to the "+" (the round can't start until something is added). */
    attention?: boolean;
    onRefresh?: () => void;
    extra?: Snippet;
  } = $props();

  // On phones only the first word of the label shows ("Treat", not "Treat votes"),
  // which frees room for the pills.
  const [word, ...restWords] = label.split(' ');
  const rest = restWords.length ? ' ' + restWords.join(' ') : '';

  // The trick endpoints take `kind: 'trick'`; snacks are the default.
  const extraBody = () => (kind === 'trick' ? { kind: 'trick' } : {});

  let adding = $state(false);
  let text = $state('');
  let error = $state('');
  let busy = $state(false);
  let input: HTMLInputElement | undefined = $state();

  $effect(() => { if (adding) input?.focus(); });

  let unlisted = $derived(
    quick.filter((n) => !items.some((s) => s.text.toLowerCase().trim() === n.toLowerCase().trim())),
  );

  async function add(value: string) {
    const v = value.trim();
    if (!v) return;
    busy = true;
    error = '';
    try {
      const { data } = await post('/api/suggest', { code, text: v, ...extraBody() });
      if (data.error) error = data.error;
      else { text = ''; adding = false; onRefresh?.(); }
    } catch { error = 'Could not add'; }
    finally { busy = false; }
  }

  async function vote(id: string) {
    error = '';
    try {
      const { data } = await post('/api/vote', { code, id, ...extraBody() });
      if (data.error) error = data.error;
      else onRefresh?.();
    } catch { /* the next poll shows the truth */ }
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    void add(text);
  }
</script>

<div class="vline" class:vline-adding={adding}>
  <span class="vline-label" title={hint}>
    <span aria-hidden="true">{icon}</span> <span>{word}<span class="vline-rest">{rest}</span></span>
    <span class="vline-count">{items.length}</span>
  </span>

  {#if adding}
    <form class="vline-form" onsubmit={submit}>
      <input bind:this={input} type="text" bind:value={text} maxlength="100" {placeholder} autocomplete="off" aria-label={placeholder} />
      <button type="submit" class="vline-go" disabled={busy || !text.trim()}>Add</button>
      <button type="button" class="vline-x" aria-label="Cancel" onclick={() => { adding = false; error = ''; }}>✕</button>
    </form>
  {:else}
    <div class="vline-strip">
      {#each items as s (s.id)}
        <button
          type="button"
          class="vline-pill"
          class:voted={s.voted}
          aria-pressed={s.voted}
          title={s.voted ? `Your vote is in (${s.votes}). Tap to take it back` : `Vote (${s.votes}) · ${s.author_name}`}
          onclick={() => vote(s.id)}
        >
          <span class="vline-n">▲ {s.votes}</span>{s.text}
        </button>
      {/each}
      {#each unlisted as name (name)}
        <button type="button" class="vline-pill vline-quick" title="In stock: tap to add and vote" disabled={busy} onclick={() => add(name)}>
          + {name}
        </button>
      {/each}
      {#if items.length === 0 && unlisted.length === 0}
        <span class="vline-empty">{empty}</span>
      {/if}
    </div>
    <button
      type="button"
      class="vline-plus"
      class:attention
      aria-label={`Add: ${placeholder}`}
      title="Add your own"
      onclick={() => (adding = true)}
    >+</button>
  {/if}

  {#if extra}{@render extra()}{/if}
</div>
{#if error}<p class="error vline-error" role="alert">{error}</p>{/if}
