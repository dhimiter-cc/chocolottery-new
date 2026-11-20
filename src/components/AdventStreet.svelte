<script lang="ts">
  // The advent calendar as a street of canal houses (data from lib/adventStreet.ts).
  // Drawn by the /advent page (server only) and by the reveal's calendar moment
  // (AdventMorph). With `highlight`, that door's house is the winner's: the rest of
  // the street dims, it gets a warm backlight, its door swings open and the
  // winner's name sits on its roof. `lit` switches those effects on, so the
  // overlay can hold them back until it has scrolled to the house. With `soon`
  // (the teaser, before the first door) the highlighted house is still shut: it
  // glows, its door stays closed and `pill` (when it opens) sits on its roof.
  import type { Street } from '../lib/adventDoors.js';

  let {
    street,
    highlight = null,
    lit = true,
    soon = false,
    pill,
  }: { street: Street; highlight?: number | null; lit?: boolean; soon?: boolean; pill?: string } = $props();

  let winner = $derived(
    highlight ? street.houses.find((h) => h.door === highlight && (soon || h.state === 'open')) ?? null : null,
  );
</script>

<header class="advent-head">
  <h1>{street.title} <span>{street.year}</span></h1>
  <p class="advent-intro">{street.intro}</p>
  <p class="advent-status" aria-live="polite"><b>{street.openCount}</b> of 24 open · {street.status}</p>
</header>

<ol class="street" class:has-winner={!!winner && lit} aria-label={`${street.title}: 24 doors`}>
  {#each street.houses as h (h.door)}
    {@const picked = winner?.door === h.door}
    {@const isWinner = picked && !soon}
    <li
      class="house is-{h.state}"
      class:is-winner={isWinner}
      class:is-soon={picked && soon}
      class:lit={picked && lit}
      data-door={h.door}
      style="--lift:{h.lift}px;--delay:{h.delay}s"
    >
      <div class="hwrap">
        {#if picked}<span class="pill" aria-hidden={!lit}>{pill ?? `★ ${h.name}`}</span>{/if}
        <svg
          viewBox="0 0 100 160"
          role="img"
          aria-label={`Door ${h.door}, ${h.state === 'open' ? `opened by ${h.name}` : h.state === 'waiting' ? 'waiting to be opened' : `opens ${h.opensOn}`}`}
        >
          <path d={h.outline} fill={h.facade} stroke="rgba(243, 207, 110, 0.35)" stroke-width="1.2" />
          <path d={h.roof} fill="none" stroke="#F5F9FF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
          <circle class="win" cx="50" cy="44" r="5" />
          <rect class="win" x="18" y="70" width="18" height="20" rx="2" />
          <rect class="win" x="64" y="70" width="18" height="20" rx="2" />
          <rect class="win" x="18" y="98" width="18" height="18" rx="2" />
          <rect class="win" x="64" y="98" width="18" height="18" rx="2" />
          {#if isWinner}<path class="doorway" d="M38 160V132Q38 122 50 122Q62 122 62 132V160Z" />{/if}
          <path class="door" d="M38 160V132Q38 122 50 122Q62 122 62 132V160Z" />
          <text class="num" x="50" y="112" text-anchor="middle">{h.door}</text>
        </svg>
      </div>
      <div class="tag">
        {#if h.state === 'open'}
          {#if h.icon}
            <img src={`/api/advent/${h.door}`} alt="" width="40" height="40" loading="lazy" />
          {:else}
            <span class="gift" aria-hidden="true">🎁</span>
          {/if}
          <b>{h.title || street.surprise}</b>
          <span>{h.name}</span>
        {:else if h.state === 'waiting'}
          <b class="today">Today</b>
        {:else}
          <span class="when">{h.opensOn}</span>
        {/if}
      </div>
    </li>
  {/each}
</ol>

<style>
  .advent-head { text-align: center; margin: 24px auto 28px; max-width: 64ch; }
  .advent-head h1 { margin: 0; font-size: clamp(1.6rem, 2.6vw, 2.1rem); font-weight: 900; font-stretch: 118%; letter-spacing: -0.03em; color: var(--gold); }
  .advent-head h1 span { color: var(--text-mute); font-weight: 700; }
  .advent-intro { margin: 10px 0 6px; color: var(--text-mute); }
  .advent-status { margin: 0; color: var(--text); }
  .advent-status b { color: var(--gold); }

  .street {
    list-style: none; margin: 0; padding: 0;
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 34px 18px; align-items: end;
  }
  .house { display: flex; flex-direction: column; align-items: center; gap: 8px; transition: opacity 0.6s ease, filter 0.6s ease; }
  .hwrap { position: relative; width: 100%; max-width: 132px; transform: translateY(calc(var(--lift) * -1)); isolation: isolate; }
  .house svg { display: block; width: 100%; height: auto; overflow: visible; filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.45)); }
  .house .win { fill: #1A0B22; stroke: rgba(243, 207, 110, 0.25); stroke-width: 1; }
  .house .door { fill: var(--on-gold); stroke: rgba(243, 207, 110, 0.4); stroke-width: 1.2; }
  .house .num { font: 900 22px var(--font-sans); fill: var(--gold); }
  .house.is-shut .num { fill: rgba(243, 207, 110, 0.55); }

  .house.is-open .win { fill: var(--gold); stroke: none; filter: drop-shadow(0 0 4px rgba(255, 210, 74, 0.8)); }
  .house.is-open .door { fill: var(--gold-deep); }
  .house.is-open .num { fill: var(--cream); }

  .house.is-waiting .door { fill: var(--gold); animation: door-glow 1.6s ease-in-out var(--delay) infinite alternate; }
  .house.is-waiting .num { fill: var(--cream); }
  .house.is-waiting .win:nth-of-type(odd) { fill: rgba(243, 207, 110, 0.55); }
  @keyframes door-glow {
    from { filter: drop-shadow(0 0 2px rgba(255, 210, 74, 0.5)); }
    to   { filter: drop-shadow(0 0 12px rgba(255, 210, 74, 1)); }
  }

  /* The winner's house: the street dims around it, a warm light rises behind it,
     its door swings open on the light inside and the winner's name sits on top. */
  .street.has-winner .house:not(.lit) { opacity: 0.42; filter: saturate(0.6); }
  .hwrap::before {
    content: '';
    position: absolute;
    inset: -38% -62% -18%;
    z-index: -1;
    border-radius: 50%;
    background: radial-gradient(closest-side, rgba(255, 210, 74, 0.75), rgba(232, 169, 58, 0.28) 55%, transparent);
    opacity: 0;
    transform: scale(0.6);
    transition: opacity 0.8s ease, transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
    pointer-events: none;
  }
  .house.lit .hwrap::before { opacity: 1; transform: scale(1); animation: backlight 2.4s ease-in-out 0.8s infinite alternate; }
  @keyframes backlight {
    from { opacity: 0.8; transform: scale(0.94); }
    to   { opacity: 1; transform: scale(1.06); }
  }
  .house.is-winner .doorway { fill: var(--cream); filter: drop-shadow(0 0 6px rgba(255, 210, 74, 0.95)); }
  .house.is-winner .door { transform-box: view-box; transform-origin: 38px 141px; transition: transform 0.9s cubic-bezier(0.5, 0, 0.2, 1) 0.3s; }
  .house.is-winner.lit .door { transform: skewY(-12deg) scaleX(0.28); }
  .house.is-winner.lit .win { animation: windows-on 0.5s steps(3, end) both; }
  /* The teaser's house: a softer light, and a door that glows but stays shut. */
  .house.is-soon .hwrap::before { inset: -26% -46% -12%; }
  .house.is-soon.lit .door { fill: var(--gold); animation: door-glow 1.6s ease-in-out infinite alternate; }
  .house.is-soon.lit .num { fill: var(--cream); }
  @keyframes windows-on { from { fill: #1A0B22; } }

  .pill {
    position: absolute;
    left: 50%;
    bottom: calc(100% - 4px);
    z-index: 2;
    padding: 5px 12px;
    border-radius: 999px;
    background: linear-gradient(160deg, var(--gold), var(--gold-deep));
    color: var(--on-gold);
    font: 900 0.95rem var(--font-sans);
    white-space: nowrap;
    box-shadow: var(--shadow-1), 0 0 18px rgba(255, 210, 74, 0.45);
    opacity: 0;
    transform: translate(-50%, 10px) scale(0.7);
    transition: opacity 0.4s ease 0.5s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.5s;
  }
  .pill::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 100%;
    margin-left: -6px;
    border: 6px solid transparent;
    border-top-color: var(--gold-deep);
  }
  .house.lit .pill { opacity: 1; transform: translate(-50%, 0) scale(1); }
  .house.lit .tag b { color: var(--gold); }

  .tag { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 64px; text-align: center; font-size: 0.75rem; color: var(--text-mute); }
  .tag img { width: 40px; height: 40px; object-fit: contain; }
  .tag .gift { font-size: 1.6rem; line-height: 1; }
  .tag b { color: var(--text); font-weight: 700; }
  .tag .today { color: var(--gold); text-transform: uppercase; letter-spacing: 0.16em; }
  .tag .when { letter-spacing: 0.04em; }

  @media (max-width: 900px) { .street { grid-template-columns: repeat(4, 1fr); } }
  @media (max-width: 560px) {
    .street { grid-template-columns: repeat(3, 1fr); gap: 30px 10px; }
    .pill { font-size: 0.75rem; padding: 4px 9px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .house.is-waiting .door, .house.lit .hwrap::before, .house.lit .win, .house.is-soon.lit .door { animation: none; }
    .house, .hwrap::before, .pill, .house.is-winner .door { transition: none; }
  }
</style>
