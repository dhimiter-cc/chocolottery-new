<script lang="ts">
  // The advent card at the reveal, in one of two modes:
  //   - a door: the winner opened one (the live theme runs the calendar, the
  //     server sends `game.advent`, and this screen's theme has the words). The
  //     little door swings open on the prize; links to the calendar at that door.
  //   - the teaser: before the first door, inside the teaser dates set in /admin
  //     (`game.advent_teaser`, whatever the theme). A shut door and a countdown.
  // A moment later the card grows into the whole calendar street (AdventMorph),
  // once per door (or, for the teaser, once a day) on each device. It never
  // touches who wins.
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

  /** What the card shows, if anything. A primitive `key` keeps the effects below
   *  from re-running on every poll, when `game` is a new object. */
  let card_ = $derived.by(() => {
    if (words && game.advent) {
      const a = game.advent;
      return {
        key: `advent-morph:${a.door}`,
        door: a.door,
        soon: false,
        lead: words.revealLead.replace('{door}', String(a.door)),
        title: a.title || words.surprise,
        icon: a.icon,
        pill: undefined as string | undefined,
      };
    }
    const t = game.advent_teaser;
    if (t && game.winner_token) {
      return { key: `advent-teaser:${t.today}`, door: t.door, soon: true, lead: t.lead, title: t.line, icon: false, pill: t.sign };
    }
    return null;
  });
  let key = $derived(card_?.key ?? null);

  let open = $state(false);
  let card = $state<HTMLAnchorElement | null>(null);
  let street = $state<Street | null>(null);
  let ready = $state(false);
  let from = $state<Box | null>(null);

  $effect(() => {
    const t = setTimeout(() => (open = true), reducedMotion ? 0 : delay);
    return () => clearTimeout(t);
  });

  function seen(k: string): boolean {
    try { return sessionStorage.getItem(k) === '1'; } catch { return false; }
  }

  // Fetch the street as soon as there is a card, so it is ready when the card grows.
  $effect(() => {
    if (key === null || seen(key)) return;
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
    if (!ready || !street || !card || !card_ || from || starting || seen(card_.key)) return;
    const { door, soon } = card_;
    if (!street.houses.some((h) => h.door === door && (soon || h.state === 'open'))) return;
    const el = card;
    const r = el.getBoundingClientRect();
    if (!r.width) return; // not on screen (hidden layout)
    starting = true;
    try { sessionStorage.setItem(card_.key, '1'); } catch { /* private mode: it may play again */ }
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

{#if card_}
  {@const c = card_}
  <!-- The teaser's door stays shut: nothing is behind it yet. -->
  <a
    class="advent-door"
    class:open={open && !c.soon}
    class:soon={c.soon}
    bind:this={card}
    href={c.soon ? '/advent' : `/advent?door=${c.door}`}
    target="_blank"
    rel="noreferrer"
  >
    <span class="ad-frame" aria-hidden="true">
      <span class="ad-prize">
        {#if c.icon}<img src={`/api/advent/${c.door}`} alt="" width="34" height="34" />{:else}🎁{/if}
      </span>
      <span class="ad-panel">{c.door}</span>
    </span>
    <span class="ad-text">
      <b>{c.lead}</b>
      <span>{open || c.soon ? c.title : '…'}</span>
    </span>
  </a>
  {#if from && street}
    <AdventMorph
      {street}
      door={c.door}
      {from}
      lead={c.lead}
      title={c.title}
      icon={c.icon}
      soon={c.soon}
      pill={c.pill}
      returnTo={cardBox}
      onclose={() => (from = null)}
      {onHush}
      {onFireAt}
    />
  {/if}
{/if}
