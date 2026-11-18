<script lang="ts" module>
  // Figure art, fetched once per page whatever the number of reveals.
  const cache = new Map<string, Promise<string>>();
  function load(src: string): Promise<string> {
    if (!cache.has(src)) cache.set(src, fetch(src).then((r) => (r.ok ? r.text() : Promise.reject(r.status))));
    return cache.get(src)!;
  }

  // Only drawing attributes are copied from the file, so nothing in it can run.
  const ALLOWED = new Set(['d', 'fill', 'fill-rule', 'clip-rule', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'transform', 'style']);
  export type PathAttrs = Record<string, string>;
  function pathAttrs(tag: string): PathAttrs {
    const out: PathAttrs = {};
    for (const [, k, v] of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) if (ALLOWED.has(k)) out[k] = v;
    return out;
  }
  export function parsePaths(svg: string): PathAttrs[] {
    return (svg.match(/<path\b[^>]*?\/>/gs) ?? []).map(pathAttrs);
  }
</script>

<script lang="ts">
  // A guest at the reveal, from the active theme's `cameo` (Santa, at Winter). It
  // never touches who wins: it turns up when the name lands, in the stage's
  // bottom-left corner beside the bar, says a line, and sends something across the
  // top of the stage dropping confetti. Mounted by <BarReveal> and <RevealPhase>
  // inside .cup-stage, which is positioned and clips, so none of it can make the
  // stage scroll. The figure is an SVG of paths; the theme names the ones that wave.
  import type { RevealCameo } from '../themes/types.js';

  let {
    cameo,
    active,
    winnerName,
    iWon = false,
    onFireDrop,
  }: {
    cameo: RevealCameo;
    /** False until the winner's name lands; the cameo plays once, the first time it turns true. */
    active: boolean;
    winnerName: string;
    iWon?: boolean;
    /** Drop a little confetti at a point (fractions of the window). */
    onFireDrop?: (x: number, y: number) => void;
  } = $props();

  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  // ── The figure: fetched once, split into the body and the part that waves ──
  interface Art { viewBox: string; body: PathAttrs[]; wave: PathAttrs[]; pivot: string }
  let art = $state<Art | null>(null);
  $effect(() => {
    const f = cameo.figure;
    load(f.src)
      .then((txt) => {
        const paths = parsePaths(txt);
        const waving = new Set(f.wave ?? []);
        art = {
          viewBox: txt.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 100 100',
          body: paths.filter((_, i) => !waving.has(i)),
          wave: paths.filter((_, i) => waving.has(i)),
          pivot: `${f.pivot?.[0] ?? 0}px ${f.pivot?.[1] ?? 0}px`,
        };
      })
      .catch(() => { /* no art, no cameo: the reveal is complete without it */ });
  });

  // ── Timing: the flyer crosses as the name lands, the figure follows ─────────
  let flying = $state(false);
  let shown = $state(false);
  let speaking = $state(false);
  let flyer: HTMLElement | undefined = $state();
  let played = false;

  $effect(() => {
    if (!active || played) return;
    played = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let drops: ReturnType<typeof setInterval> | null = null;

    if (cameo.flyer && !reducedMotion) {
      flying = true;
      // Confetti off the back of the sleigh, wherever it is right now.
      drops = setInterval(() => {
        if (!flyer || !onFireDrop) return;
        const r = flyer.getBoundingClientRect();
        if (r.right < 0 || r.left > window.innerWidth) return;
        onFireDrop((r.left + r.width * 0.78) / window.innerWidth, (r.top + r.height * 0.72) / window.innerHeight);
      }, 110);
      timers.push(setTimeout(() => { flying = false; if (drops) clearInterval(drops); }, 3000));
    }
    timers.push(setTimeout(() => (shown = true), reducedMotion ? 0 : 700));
    timers.push(setTimeout(() => (speaking = true), reducedMotion ? 0 : 1300));

    return () => { timers.forEach(clearTimeout); if (drops) clearInterval(drops); };
  });

  let line = $derived((iWon && cameo.lineForWinner ? cameo.lineForWinner : cameo.line).replace('{name}', winnerName));
</script>

<!-- Always there while the cameo is mounted, so the reveal can make room for the
     figure from the first frame (see .bar-reveal:has(.cameo-slot) in global.css)
     instead of shifting when it appears. -->
<span class="cameo-slot" aria-hidden="true"></span>

{#if flying && cameo.flyer}
  <div
    class="cameo-flyer"
    bind:this={flyer}
    style={`--src:url("${cameo.flyer.src}")`}
    role="img"
    aria-label={cameo.flyer.label}
  ></div>
{/if}

{#if shown && art}
  <div class="cameo-figure" class:still={reducedMotion}>
    {#if speaking}
      <p class="cameo-bubble" aria-live="polite">{line}</p>
    {/if}
    <svg viewBox={art.viewBox} role="img" aria-label={cameo.figure.label} focusable="false">
      <g>{#each art.body as p, i (i)}<path {...p} />{/each}</g>
      <g class="cameo-wave" style={`transform-origin:${art.pivot}`}>{#each art.wave as p, i (i)}<path {...p} />{/each}</g>
    </svg>
  </div>
{/if}

<style>
  /* The flyer: the theme's silhouette, painted gold through a mask, crossing the
     top of the stage right to left. */
  .cameo-flyer {
    position: absolute;
    top: 14%;
    left: 100%;
    z-index: 4;
    width: clamp(150px, 24%, 260px);
    aspect-ratio: 1.29;
    background: linear-gradient(160deg, var(--gold), var(--gold-deep));
    -webkit-mask: var(--src) center / contain no-repeat;
    mask: var(--src) center / contain no-repeat;
    filter: drop-shadow(0 0 10px rgba(255, 210, 74, 0.6));
    pointer-events: none;
    animation: cameo-fly 2.9s linear forwards;
  }
  @keyframes cameo-fly {
    0%   { left: 100%; transform: translateY(0); }
    30%  { transform: translateY(-14px); }
    60%  { transform: translateY(10px); }
    100% { left: -30%; transform: translateY(-6px); }
  }

  /* The figure: comes up from the bottom-left corner beside the bar in six
     stop-motion frames, like the rest of the bar's animation, then keeps waving. */
  .cameo-figure {
    position: absolute;
    left: 14px;
    bottom: 0;
    z-index: 3;
    height: min(46%, 230px);
    aspect-ratio: 267.76 / 506.378;
    pointer-events: none;
    animation: cameo-up 0.6s steps(6, end) both;
  }
  .cameo-figure svg {
    display: block;
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.5));
    animation: cameo-bob 2.4s ease-in-out 0.6s infinite alternate;
  }
  .cameo-wave {
    transform-box: view-box;
    animation: cameo-wave 0.9s ease-in-out infinite alternate;
  }
  @keyframes cameo-up {
    from { transform: translateY(105%); }
    to   { transform: translateY(0); }
  }
  @keyframes cameo-bob {
    from { transform: rotate(-2deg); }
    to   { transform: rotate(2deg) translateY(-3px); }
  }
  @keyframes cameo-wave {
    from { transform: rotate(-16deg); }
    to   { transform: rotate(7deg); }
  }

  .cameo-slot { display: none; }

  /* The speech bubble, above the head, its tail pointing down at him. */
  .cameo-bubble {
    position: absolute;
    left: 0;
    bottom: 100%;
    width: max-content;
    max-width: 170px;
    padding: 8px 12px;
    border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm);
    margin: 0 0 4px;
    background: var(--cream);
    color: var(--on-gold);
    font-weight: 800;
    font-size: 0.92rem;
    line-height: 1.25;
    box-shadow: var(--shadow-1);
    animation: cameo-pop 0.36s steps(3, end) both;
  }
  @keyframes cameo-pop {
    from { transform: scale(0.4); opacity: 0; transform-origin: 0 100%; }
    to   { transform: scale(1); opacity: 1; transform-origin: 0 100%; }
  }

  /* Phones: the reveal is a single column with the prize underneath, so the figure
     would sit on the host's controls. The sleigh still flies. */
  @media (max-width: 720px) {
    .cameo-figure { display: none; }
  }

  .cameo-figure.still,
  .cameo-figure.still svg,
  .cameo-figure.still .cameo-wave,
  .cameo-figure.still .cameo-bubble { animation: none; }
</style>
