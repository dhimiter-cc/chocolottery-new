<script lang="ts">
  // Bar mode, after everyone has picked: each player tears their own bar open
  // on their own screen while the board shows everyone's progress. Nobody
  // learns what's in any bar, their own included: an opened bar is bare
  // chocolate and the golden ticket stays sealed. The round ends when the last
  // bar is open (or the host unlocks the rest), and the whole room sees the
  // reveal together. Until then the screen's job is suspense: a roll-call of
  // who has opened, and lines that keep the held breath going.
  //
  // Two views of the same moment:
  //  - `bar`   — the player's own bar, full screen (<UnwrapStage>). Default on
  //              phones and laptops of everyone except the host.
  //  - `board` — every bar, live. Default for the host, whose screen is the one
  //              on the wall. Anyone can flip between the two.
  //
  // Progress is fire-and-forget to /api/unwrap with at most one request in
  // flight: the scratch view never waits on the network.
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
        // The last bar in the room just opened: don't wait for the next poll.
        if (target >= UNWRAP_STEPS) onRefresh();
      } else {
        // The round ended under us (the host unlocked the rest) or we have no
        // bar: stop sending and let the next poll move the screen on.
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

  let mineOpen = $derived(Math.max(me?.unwrap ?? 0, localStep) >= UNWRAP_STEPS);

  // Done with my bar: don't leave me alone with it. After a beat for the last
  // tear to land, drop into the board, where the rest of the room is still
  // opening theirs. "See my bar" brings the held screen back.
  let hopped = false;
  $effect(() => {
    if (!mineOpen || hopped || view !== 'bar') return;
    hopped = true;
    const t = setTimeout(() => (view = 'board'), 700);
    return () => clearTimeout(t);
  });

  // ── Suspense ────────────────────────────────────────────────────────────
  // One line at a time under my opened bar, swapped every few seconds. They
  // never say whether the ticket is mine: nobody knows, and that's the point.
  const SUSPENSE = [
    'Somewhere in this room, a bar is hiding gold.',
    'Is it yours? Poker face.',
    "Don't look at your neighbour.",
    'Hold the chocolate. Hold your breath.',
    'Every bar looks innocent. One is lying.',
    'Nothing to see here. Probably.',
  ];
  let tick = $state(0);
  $effect(() => {
    const id = setInterval(() => (tick += 1), 3600);
    return () => clearInterval(id);
  });
  // Start each player on a different line so a roomful of phones doesn't chant in unison.
  const offset = Math.floor(Math.random() * SUSPENSE.length);
  let suspenseLine = $derived(SUSPENSE[(tick + offset) % SUSPENSE.length]);

  // ── The board ───────────────────────────────────────────────────────────
  // An opened bar is bare chocolate for everyone, so drawing it as such gives
  // nothing away. Mine follows my finger, not the last poll; the rest follow
  // the server.
  let bars = $derived(
    (game.straws ?? []).map((_, i) => {
      const p = game.players.find(pl => pl.straw_index === i) ?? null;
      const serverStep = p?.unwrap ?? 0;
      const live = p?.is_me ? Math.max(serverStep, localStep) : serverStep;
      const opened = live >= UNWRAP_STEPS;
      return { i, p, step: Math.min(live, UNWRAP_STEPS), opened };
    })
  );

  // A plain number for the {@attach} below. Passing `bars.length` directly
  // would make the attachment depend on `bars` — a new array every poll — so
  // it would tear down and refit twice a second, and the board would flicker.
  let barCount = $derived(bars.length);

  let wrapped = $derived(bars.filter(b => !b.opened));
  let openCount = $derived(barCount - wrapped.length);
  let lead = $derived(Math.max(0, ...wrapped.map(b => b.step)));

  let headline = $derived.by(() => {
    const left = wrapped.length;
    if (left === 0) return 'Everyone is open. Here it comes…';
    if (left === 1) {
      const p = wrapped[0].p;
      return p?.is_me ? 'Only your bar is left…' : `Only ${p?.name ?? 'one'}'s bar is left…`;
    }
    if (left === 2) return 'Down to two bars…';
    if (lead === 0 && openCount === 0) return 'Everyone has a bar. One of them has the golden ticket.';
    // I'm done and waiting: the board is my waiting room now, so it carries the
    // suspense lines (the count beside it already says how many are left).
    if (mineOpen) return suspenseLine;
    return `${left} bars still wrapped. The ticket stays sealed until the last one opens.`;
  });

  let othersWrapped = $derived(wrapped.filter(b => !b.p?.is_me).length);
</script>

<div class="unwrap-board">
  <div class="unwrap-hero">
    <span class="unwrap-count" aria-hidden="true"><b>{openCount}</b><i>/</i>{barCount}</span>
    <p class="bar-phase-text" class:suspense={mineOpen && wrapped.length > 2} aria-live={mineOpen && wrapped.length > 2 ? 'off' : 'polite'}>{headline}</p>
  </div>

  <!-- Above the board, not under it: with forty bars the bottom of the board
       is a long way down. -->
  {#if hasBar}
    <button type="button" class="btn btn-primary board-mine-btn" onclick={() => (view = 'bar')}>
      🍫 {mineOpen ? 'See my bar' : 'Unwrap my bar'}
    </button>
  {/if}

  <div class="bar-shelf board {shelfDensity(barCount)}" {@attach fitShelf(barCount)}>
    {#each bars as b (b.i)}
      <div
        class="board-tile"
        class:opened={b.opened}
        class:mine={b.p?.is_me}
        class:leading={!b.opened && b.step > 0 && b.step === lead}
        class:offline={!!b.p && !b.p.online}
      >
        <BoardBar step={b.step} number={b.i + 1} />
        <div class="board-meter"><span style="transform: scaleX({b.step / UNWRAP_STEPS})"></span></div>
        <div class="board-name">{b.p ? (b.p.is_me ? 'You' : b.p.name) : '—'}</div>
        <div class="board-status">{b.opened ? 'opened' : b.step === 0 ? 'sealed' : `${b.step}/${UNWRAP_STEPS}`}</div>
      </div>
    {/each}
  </div>
</div>

{#if hasBar && view === 'bar' && myIndex != null}
  <UnwrapStage
    number={myIndex + 1}
    initialStep={Math.max(me?.unwrap ?? 0, localStep)}
    suspense={suspenseLine}
    waitingOnYou={!mineOpen && othersWrapped === 0}
    {onProgress}
  >
    {#snippet corner()}
      <button type="button" class="unwrap-chip" onclick={() => (view = 'board')}>👀 Watch the board</button>
    {/snippet}
    {#snippet footer()}
      {#if mineOpen}
        <!-- The roll-call: one dot per bar, gold once it's open, a ring on mine. -->
        <ul class="rollcall" aria-label="{openCount} of {barCount} bars open">
          {#each bars as b (b.i)}
            <li class:on={b.opened} class:mine={b.p?.is_me}></li>
          {/each}
        </ul>
        <span class="rollcall-label">
          {#if othersWrapped > 0}
            {openCount} of {barCount} open · waiting on {othersWrapped}
          {:else}
            Everyone is open. Here it comes…
          {/if}
        </span>
      {:else if othersWrapped > 0}
        <span>{othersWrapped} other bar{othersWrapped === 1 ? '' : 's'} still wrapped</span>
      {:else}
        <span>Every other bar is open. The ticket stays sealed until yours is.</span>
      {/if}
    {/snippet}
  </UnwrapStage>
{/if}
