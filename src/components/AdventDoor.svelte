<script lang="ts">
  // The advent door the winner opened, at the reveal: a little door swings open on
  // the prize behind it. Only while the live theme runs a calendar (the server
  // sends `game.advent`) and this screen's theme has the words for it. A moment
  // after it opens, the card grows into the whole calendar street (AdventMorph),
  // once per door on each device. Links to the calendar with that door
  // highlighted. It never touches who wins.
  import type { GameStateResponse } from '../lib/types.js';
  import type { Street } from '../lib/adventDoors.js';
  import { currentTheme } from '../themes/client.js';
  import AdventMorph, { type Box } from './AdventMorph.svelte';

  let {
    game,
    delay = 0,
    onHush,
    onFireAt,
  }: {
    game: GameStateResponse;
    delay?: number;
    /** EffectsCanvas.hush / fireAt, so the calendar isn't buried in the reveal's confetti. */
    onHush?: (ms: number) => void;
    onFireAt?: (x: number, y: number) => void;
  } = $props();

  const words = currentTheme().advent;
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  /** The door's swing (global.css `.ad-panel`), then a beat to read the card. */
  const MORPH_AFTER_MS = 700 + 1000;

  let door = $derived(game.advent?.door ?? null);
  let open = $state(false);
  let card = $state<HTMLAnchorElement | null>(null);
  let street = $state<Street | null>(null);
  let ready = $state(false);
  let from = $state<Box | null>(null);

  $effect(() => {
    const t = setTimeout(() => (open = true), reducedMotion ? 0 : delay);
    return () => clearTimeout(t);
  });

  const seenKey = (d: number) => `advent-morph:${d}`;
  function seen(d: number): boolean {
    try { return sessionStorage.getItem(seenKey(d)) === '1'; } catch { return false; }
  }

  // Fetch the street as soon as there is a door, so it is ready when the card grows.
  $effect(() => {
    if (!words || door === null || seen(door)) return;
    let live = true;
    fetch('/api/advent')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Street | null) => { if (live) street = s; })
      .catch(() => {});
    const t = setTimeout(() => (ready = true), (reducedMotion ? 0 : delay) + MORPH_AFTER_MS);
    return () => { live = false; clearTimeout(t); };
  });

  // Grow once the card has had its moment and the street has arrived. On a phone
  // the card can sit below the fold: bring it into view first, so the growing
  // starts where people can see it.
  let starting = false;
  $effect(() => {
    if (!ready || !street || !card || door === null || from || starting || seen(door)) return;
    if (!street.houses.some((h) => h.door === door && h.state === 'open')) return;
    const el = card;
    const r = el.getBoundingClientRect();
    if (!r.width) return; // not on screen (hidden layout)
    starting = true;
    try { sessionStorage.setItem(seenKey(door), '1'); } catch { /* private mode: it may play again */ }
    const visible = r.top >= 0 && r.bottom <= innerHeight;
    if (!visible) el.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    setTimeout(() => {
      const b = el.getBoundingClientRect();
      from = { top: b.top, left: b.left, width: b.width, height: b.height };
    }, visible || reducedMotion ? 0 : 750);
  });

  function cardBox(): Box | null {
    const r = card?.getBoundingClientRect();
    return r && r.width && r.bottom > 0 && r.top < innerHeight ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
  }
</script>

{#if words && game.advent}
  {@const d = game.advent.door}
  {@const title = game.advent.title || words.surprise}
  <a class="advent-door" class:open bind:this={card} href={`/advent?door=${d}`} target="_blank" rel="noreferrer">
    <span class="ad-frame" aria-hidden="true">
      <span class="ad-prize">
        {#if game.advent.icon}<img src={`/api/advent/${d}`} alt="" width="34" height="34" />{:else}🎁{/if}
      </span>
      <span class="ad-panel">{d}</span>
    </span>
    <span class="ad-text">
      <b>{words.revealLead.replace('{door}', String(d))}</b>
      <span>{open ? title : '…'}</span>
    </span>
  </a>
  {#if from && street}
    <AdventMorph
      {street}
      door={d}
      {from}
      lead={words.revealLead.replace('{door}', String(d))}
      {title}
      icon={game.advent.icon}
      returnTo={cardBox}
      onclose={() => (from = null)}
      {onHush}
      {onFireAt}
    />
  {/if}
{/if}
