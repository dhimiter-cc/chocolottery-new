<script lang="ts">
  // Trick or treat: the room writes and votes on tricks, the same way it does for
  // snacks. One winner in a few opens a trick door at the reveal and does the
  // top-voted one (then still takes the prize). Only mounted while the active
  // theme provides `trickOrTreat` copy.
  import type { GameStateResponse } from '../lib/types.js';
  import { post } from '../lib/api.js';
  import { currentTheme } from '../themes/client.js';
  import { TRICK_ODDS } from '../lib/trickOdds.js';

  // `compact` is the version inside the lobby canvas: one hint line, scrolling list.
  let { game, code, onRefresh, compact = false }: { game: GameStateResponse; code: string; onRefresh?: () => void; compact?: boolean } = $props();

  const words = currentTheme().trickOrTreat;

  let text = $state('');
  let error = $state('');
  let loading = $state(false);

  async function suggest(e: SubmitEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    loading = true;
    error = '';
    try {
      const { data } = await post('/api/suggest', { code, text: value, kind: 'trick' });
      if (data.error) error = data.error;
      else { text = ''; onRefresh?.(); }
    } catch { error = 'Could not add'; }
    finally { loading = false; }
  }

  async function vote(id: string) {
    try {
      const { data } = await post('/api/vote', { code, id, kind: 'trick' });
      if (data.error) error = data.error;
      else onRefresh?.();
    } catch {}
  }
</script>

{#if words}
  <div class="votes tricks" class:votes-compact={compact}>
    <div class="section-head">
      <h2>{words.title}</h2>
      <div class="section-head-right"><span class="count">{game.tricks.length}</span></div>
    </div>
    <p class="muted">{(compact ? words.hint : words.intro).replace('{odds}', String(TRICK_ODDS))}</p>

    <form class="snack-form" onsubmit={suggest}>
      <input type="text" bind:value={text} maxlength="100" placeholder={words.placeholder} autocomplete="off" />
      <button type="submit" class="btn" disabled={loading || !text.trim()}>Add</button>
    </form>

    <div class="snacks-list">
      {#if game.tricks.length === 0}
        <div class="snacks-empty">{words.empty}</div>
      {:else}
        {#each game.tricks as t (t.id)}
          <div class="snack" class:voted={t.voted}>
            <button
              type="button"
              class="snack-vote"
              aria-pressed={t.voted}
              aria-label={t.voted ? `Voted for ${t.text} (${t.votes} votes) — click to remove your vote` : `Vote for ${t.text} (${t.votes} votes)`}
              onclick={() => vote(t.id)}
            >
              <span class="arrow">▲</span>
              <span class="num">{t.votes}</span>
            </button>
            <div class="snack-text"><span class="snack-icon" aria-hidden="true">🕷️</span>{t.text}</div>
            <div class="snack-author">— {t.author_name}</div>
          </div>
        {/each}
      {/if}
    </div>
    {#if error}<p class="error">{error}</p>{/if}
  </div>
{/if}
