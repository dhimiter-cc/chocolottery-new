<script lang="ts" module>
  export interface Box { top: number; left: number; width: number; height: number }
</script>

<script lang="ts">
  // The reveal's calendar moment: the advent card (AdventDoor) grows until it
  // becomes the whole calendar street, like the /advent page, over the game. The
  // winner's house is scrolled into view, lights up behind and swings its door
  // open with their name on the roof. "Back to the round" (or Esc) shrinks it back
  // into the card. Moved to <body> so no stage transform or overflow can clip it.
  import { onMount } from 'svelte';
  import AdventStreet from './AdventStreet.svelte';
  import { CANAL_PATH, type Street } from '../lib/adventDoors.js';

  let {
    street,
    door,
    from,
    lead,
    title,
    icon,
    returnTo,
    onclose,
    onHush,
    onFireAt,
  }: {
    street: Street;
    door: number;
    /** Where the card was when it started to grow. */
    from: Box;
    /** The card's own words, for the copy of it that grows and fades. */
    lead: string;
    title: string;
    icon: boolean;
    /** Where to shrink back to on close (the card, if it is still on screen). */
    returnTo: () => Box | null;
    onclose: () => void;
    /** Keep the reveal's confetti off the calendar (ms; 0 lets it play again). */
    onHush?: (ms: number) => void;
    /** Fireworks over a point of the screen, for the winner's house. */
    onFireAt?: (x: number, y: number) => void;
  } = $props();

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const GROW_MS = 950;
  const EASE = 'cubic-bezier(0.65, 0, 0.25, 1)';

  let root: HTMLDivElement;
  let scroller: HTMLDivElement;
  let page: HTMLDivElement;
  let tint: HTMLDivElement;
  let ghost: HTMLDivElement;
  let back: HTMLButtonElement;
  let lit = $state(false);
  let closing = false;

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  const inset = (b: Box, r: number) =>
    `inset(${b.top}px ${innerWidth - b.left - b.width}px ${innerHeight - b.top - b.height}px ${b.left}px round ${r}px)`;

  /** Scroll the winner's house to the middle of the screen, unless it is already in view. */
  function toHouse(): Promise<void> {
    const house = scroller.querySelector<HTMLElement>(`[data-door="${door}"]`);
    if (!house) return Promise.resolve();
    const r = house.getBoundingClientRect();
    if (r.top >= 80 && r.bottom <= innerHeight - 120) return Promise.resolve();
    const top = scroller.scrollTop + r.top + r.height / 2 - innerHeight / 2;
    if (reducedMotion) {
      scroller.scrollTop = top;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => { clearTimeout(t); scroller.removeEventListener('scrollend', done); resolve(); };
      const t = setTimeout(done, 1200);
      scroller.addEventListener('scrollend', done);
      scroller.scrollTo({ top, behavior: 'smooth' });
    });
  }

  onMount(() => {
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    let cancelled = false;
    onHush?.(30_000);

    (async () => {
      if (!reducedMotion) {
        const opts = { duration: GROW_MS, easing: EASE, fill: 'both' as const };
        // Grow the card's copy most of the way across the screen, not past it (phones).
        const ghostScale = Math.min(2.6, Math.max(1.25, (innerWidth * 0.9) / from.width));
        const grow = root.animate([{ clipPath: inset(from, 14) }, { clipPath: inset({ top: 0, left: 0, width: innerWidth, height: innerHeight }, 0) }], opts);
        tint.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: GROW_MS * 0.6 });
        ghost.animate(
          [{ transform: 'scale(1)', opacity: 1 }, { opacity: 1, offset: 0.25 }, { transform: `scale(${ghostScale})`, opacity: 0 }],
          { ...opts, duration: GROW_MS * 0.75 },
        );
        page.animate(
          [{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 0, offset: 0.3 }, { opacity: 1, transform: 'scale(1)' }],
          opts,
        );
        await grow.finished.catch(() => {});
      }
      if (cancelled) return;
      back.focus({ preventScroll: true });
      await toHouse();
      if (cancelled) return;
      lit = true;
      onHush?.(0);
      const house = scroller.querySelector<HTMLElement>(`[data-door="${door}"] .hwrap`)?.getBoundingClientRect();
      if (house && !reducedMotion) setTimeout(() => !closing && onFireAt?.(house.left + house.width / 2, house.top + house.height * 0.25), 450);
    })();

    return () => {
      cancelled = true;
      html.style.overflow = overflow;
      onHush?.(0);
    };
  });

  async function close() {
    if (closing) return;
    closing = true;
    if (!reducedMotion) {
      const to = returnTo() ?? { top: innerHeight / 2 - 30, left: innerWidth / 2 - 120, width: 240, height: 60 };
      const opts = { duration: 650, easing: EASE, fill: 'forwards' as const };
      page.animate([{ opacity: 1 }, { opacity: 0 }], { ...opts, duration: 350 });
      tint.animate([{ opacity: 0 }, { opacity: 1 }], opts);
      await root.animate([{ clipPath: inset({ top: 0, left: 0, width: innerWidth, height: innerHeight }, 0) }, { clipPath: inset(to, 14) }], opts)
        .finished.catch(() => {});
    }
    onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && close()} />

<div
  class="am"
  use:portal
  bind:this={root}
  style:clip-path={reducedMotion ? null : inset(from, 14)}
  role="dialog" aria-modal="true" aria-label={`${street.title}: door ${door}`}>
  <div class="am-scroll" bind:this={scroller}>
    <div class="am-page" bind:this={page}>
      <button type="button" class="am-back" bind:this={back} onclick={close}>← Back to the round</button>
      <AdventStreet {street} highlight={door} {lit} />
    </div>
  </div>
  <svg class="am-canal" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true"><path d={CANAL_PATH} /></svg>
  <div class="am-tint" bind:this={tint} aria-hidden="true"></div>
  <!-- A copy of the card where it stood, growing and fading as the street takes over. -->
  {#if !reducedMotion}
    <div
      class="advent-door open am-ghost"
      bind:this={ghost}
      aria-hidden="true"
      style="top:{from.top}px;left:{from.left}px;width:{from.width}px;height:{from.height}px"
    >
      <span class="ad-frame">
        <span class="ad-prize">{#if icon}<img src={`/api/advent/${door}`} alt="" width="34" height="34" />{:else}🎁{/if}</span>
        <span class="ad-panel">{door}</span>
      </span>
      <span class="ad-text"><b>{lead}</b><span>{title}</span></span>
    </div>
  {/if}
</div>

<style>
  .am {
    position: fixed;
    inset: 0;
    /* Under the theme's ambient layer (snow, the sleigh), as on the /advent page. */
    z-index: 39;
    background:
      radial-gradient(1100px 560px at 50% -12%, rgba(232, 169, 58, 0.1), transparent 62%),
      var(--bg);
  }
  .am-scroll { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior: contain; }
  .am-page {
    position: relative;
    z-index: 1;
    max-width: 1120px;
    margin: 0 auto;
    padding: 34px 20px 170px;
    text-align: center;
    transform-origin: 50% 30%;
  }
  .am-back {
    /* Stays in reach while the street scrolls, just under the theme's garland. */
    position: sticky;
    top: 34px;
    z-index: 3;
    display: inline-block;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--panel-2);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    color: var(--text-mute);
    font: 600 0.75rem var(--font-sans);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    cursor: pointer;
  }
  .am-back:hover { color: var(--text); border-color: var(--border-hover); }
  .am-page :global(.advent-head) { margin-top: 14px; }
  .am-canal { position: absolute; left: 0; bottom: 0; width: 100%; height: 110px; fill: var(--bg); filter: brightness(0.45); pointer-events: none; }
  .am-tint { position: absolute; inset: 0; background: var(--panel-2); opacity: 0; pointer-events: none; }
  .am-ghost { position: fixed; margin: 0; z-index: 2; pointer-events: none; transform-origin: 50% 50%; }
  @media (max-width: 560px) { .am-canal { height: 70px; } .am-page { padding-bottom: 120px; } }
</style>
