<script lang="ts">
  // Bar mode, after everyone has picked: each player tears their own bar open
  // on their own screen while the board shows everyone's progress. The first
  // person to fully open the golden bar ends the round for the whole room.
  //
  // Two views of the same moment:
  //  - `bar`   — the player's own bar, full screen (<UnwrapStage>). Default on
  //              phones and laptops of everyone except the host.
  //  - `board` — every bar, live. Default for the host, whose screen is the one
  //              on the wall. Anyone can flip between the two.
  //
  // Progress is fire-and-forget to /api/unwrap with at most one request in
  // flight: the scratch view never waits on the network except for the final
  // step, where the server says what's inside.
  import type { GameStateResponse } from '../lib/types.js';
  import { post } from '../lib/api.js';
  import { UNWRAP_STEPS, preloadTicket, shelfDensity } from '../lib/bars.js';
  import { fitShelf } from '../lib/fitShelf.js';
  import UnwrapStage from './UnwrapStage.svelte';
  import BoardBar from './BoardBar.svelte';

  let { game, code, onRefresh }:
    { game: GameStateResponse; code: string; onRefresh: () => void } = $props();

  // Covers a reload mid-unwrap, when <BarPicking> never ran on this page.
  $effect(() => { preloadTicket(); });

  let me = $derived(game.players.find(p => p.is_me) ?? null);
  let myIndex = $derived(game.my_straw);
  let hasBar = $derived(!!me && myIndex != null);

  // ── Which view ───────────────────────────────────────────────────────────
  let view = $state<'bar' | 'board'>('board');
  let viewChosen = false;
  $effect(() => {
    if (viewChosen) return;
    viewChosen = true;
    view = hasBar && !game.is_host ? 'bar' : 'board';
  });

  // ── Syncing my progress ─────────────────────────────────────────────────
  let localStep = $state(0);
  let myGolden = $state<boolean | null>(null);
  let confirmed = 0;
  let pending = 0;
  let inFlight = false;
  let alive = true;
  $effect(() => () => { alive = false; });

  // Pick up where the server says we were (reload, or switching views).
  let synced = false;
  $effect(() => {
    if (synced || !me) return;
    synced = true;
    confirmed = pending = localStep = me.unwrap;
  });

  async function flush() {
    if (inFlight || pending <= confirmed || !alive) return;
    inFlight = true;
    const target = pending;
    try {
      const { ok, data } = await post('/api/unwrap', { code, step: target });
      if (ok) {
        confirmed = Math.max(confirmed, data.step ?? target);
        if (typeof data.golden === 'boolean') {
          myGolden = data.golden;
          onRefresh();
        }
      } else {
        // The round ended under us (someone else found it) or we have no bar:
        // stop sending and let the next poll move the screen on.
        pending = confirmed;
        onRefresh();
      }
    } catch {
      // Network blip — try again shortly; progress is idempotent.
      await new Promise(r => setTimeout(r, 800));
    }
    inFlight = false;
    if (pending > confirmed) flush();
  }

  function onProgress(step: number) {
    localStep = Math.max(localStep, step);
    pending = Math.max(pending, step);
    flush();
  }

  // What's in my bar: straight from the unwrap response, or from the polled
  // state if this page was reloaded after opening it.
  let goldenMine = $derived.by(() => {
    if (myGolden !== null) return myGolden;
    if (!me || myIndex == null || me.unwrap < UNWRAP_STEPS) return null;
    const v = game.straws?.[myIndex];
    return v == null ? null : v === 100;
  });

  // Plain chocolate: give it a moment to sink in, then show the board so the
  // player can watch the hunt continue.
  let movedToBoard = false;
  $effect(() => {
    if (goldenMine !== false || movedToBoard || view !== 'bar') return;
    movedToBoard = true;
    const t = setTimeout(() => (view = 'board'), 2600);
    return () => clearTimeout(t);
  });

  // ── The board ───────────────────────────────────────────────────────────
  let bars = $derived(
    (game.straws ?? []).map((v, i) => {
      const p = game.players.find(pl => pl.straw_index === i) ?? null;
      const serverStep = p?.unwrap ?? 0;
      const opened = serverStep >= UNWRAP_STEPS && v !== null;
      // My own tile follows my finger, not the last poll. It stops one short
      // of open: only the server knows what the last frame shows.
      const live = p?.is_me ? Math.max(serverStep, localStep) : serverStep;
      const step = opened ? UNWRAP_STEPS : Math.min(live, UNWRAP_STEPS - 1);
      return { i, p, step, opened, golden: opened ? v === 100 : null };
    })
  );

  let wrapped = $derived(bars.filter(b => !b.opened));
  let lead = $derived(Math.max(0, ...wrapped.map(b => b.step)));

  let headline = $derived.by(() => {
    const left = wrapped.length;
    if (left === 0) return '';
    if (left === 1) {
      const p = wrapped[0].p;
      return p?.is_me ? 'Only your bar is left…' : `Only ${p?.name ?? 'one'}'s bar is left…`;
    }
    if (left === 2) return 'Down to two bars…';
    if (lead === 0) return 'Everyone has a bar. One of them has the golden ticket.';
    return `${left} bars still wrapped. One of them has the golden ticket.`;
  });

  let othersWrapped = $derived(wrapped.filter(b => !b.p?.is_me).length);
</script>

<div class="unwrap-board">
  <p class="bar-phase-text" aria-live="polite">{headline}</p>

  <!-- Above the board, not under it: with forty bars the bottom of the board
       is a long way down. -->
  {#if hasBar}
    <button type="button" class="btn btn-primary board-mine-btn" onclick={() => (view = 'bar')}>
      🍫 {goldenMine === null ? 'Unwrap my bar' : 'See my bar'}
    </button>
  {/if}

  <!-- reserve: headline (+ the "Unwrap my bar" button); label: meter, name, status -->
  <div class="bar-shelf board {shelfDensity(bars.length)}" {@attach fitShelf(bars.length, hasBar ? 100 : 44, 46)}>
    {#each bars as b (b.i)}
      <div
        class="board-tile"
        class:opened={b.opened}
        class:mine={b.p?.is_me}
        class:leading={!b.opened && b.step > 0 && b.step === lead}
        class:offline={!!b.p && !b.p.online}
      >
        <BoardBar step={b.step} number={b.i + 1} golden={b.golden} />
        <div class="board-meter"><span style="transform: scaleX({b.step / UNWRAP_STEPS})"></span></div>
        <div class="board-name">{b.p ? (b.p.is_me ? 'You' : b.p.name) : '—'}</div>
        <div class="board-status">{b.opened ? 'just chocolate' : b.step === 0 ? 'still sealed' : `${b.step}/${UNWRAP_STEPS}`}</div>
      </div>
    {/each}
  </div>
</div>

{#if hasBar && view === 'bar' && myIndex != null}
  <UnwrapStage
    number={myIndex + 1}
    initialStep={Math.max(me?.unwrap ?? 0, localStep)}
    golden={goldenMine}
    {onProgress}
  >
    {#snippet corner()}
      <button type="button" class="unwrap-chip" onclick={() => (view = 'board')}>👀 Watch the board</button>
    {/snippet}
    {#snippet footer()}
      {#if othersWrapped > 0}
        <span>{othersWrapped} other bar{othersWrapped === 1 ? '' : 's'} still wrapped</span>
      {:else if goldenMine === null}
        <span>Everyone else has opened theirs…</span>
      {/if}
    {/snippet}
  </UnwrapStage>
{/if}
