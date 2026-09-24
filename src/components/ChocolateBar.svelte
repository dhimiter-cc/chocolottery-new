<script lang="ts">
  // One MOVION chocolate bar, drawn at any unwrap step from sealed (0) to open
  // (UNWRAP_STEPS). Purely presentational: the phone's scratch view, the host's
  // board, the picking grid and the reveal all render this same SVG.
  //
  // The unwrap is stop-motion on purpose. Each step is a fixed pose — a new torn
  // edge, a new wobble — and nothing tweens between them. Both come from a seed,
  // so every device draws the exact same frame for the same bar and step.
  import { UNWRAP_STEPS, TICKET_SRC, seeded } from '../lib/bars.js';

  let {
    step = 0,
    number,
    golden = null,
    name = '',
    boil = false,
    scraps = false,
  }: {
    step?: number;
    /** 1-based bar number printed on the wrapper; also seeds the randomness. */
    number: number;
    /** What's inside. Only drawn on the final step; null = not known yet. */
    golden?: boolean | null;
    /** Name ribbon on the wrapper (picking grid, host board). */
    name?: string;
    /** Idle stop-motion "boil": the sealed bar is never perfectly still. */
    boil?: boolean;
    /** Throw a torn-off scrap each time the step advances. */
    scraps?: boolean;
  } = $props();

  const uid = $props.id();

  // ── Geometry (viewBox 0 0 200 350) ────────────────────────────────────────
  const W = 200;
  const SLAB = { x: 16, y: 16, w: 168, h: 308 };
  const FOIL = { x: 10, y: 8, w: 180, h: 324 };
  const SLEEVE = { x: 6, y: 46, w: 188, h: 248 };

  // Tear lines per step as [y at left edge, y at right edge]; everything below
  // the line survives. null = untouched, 'gone' = fully removed.
  type Tear = [number, number] | null | 'gone';
  const SLEEVE_TEARS: Tear[] = [null, [-20, 118], [96, 150], [168, 206], [252, 276], 'gone', 'gone', 'gone', 'gone'];
  const FOIL_TEARS: Tear[] = [null, null, null, null, null, [-10, 64], [104, 142], [206, 238], [298, 372]];

  let s = $derived(Math.max(0, Math.min(UNWRAP_STEPS, Math.round(step))));
  let sleeveTear = $derived(SLEEVE_TEARS[s]);
  let foilTear = $derived(FOIL_TEARS[s]);

  // A torn edge: a straight line from left to right, roughed up. The seed
  // includes the step, so the edge re-tears differently on every frame.
  function jag(tear: [number, number], salt: number, amp: number): [number, number][] {
    const r = seeded(number * 7919 + salt * 131 + s * 17);
    const pts: [number, number][] = [];
    for (let x = -6, i = 0; x <= W + 6; x += 9, i++) {
      const base = tear[0] + ((tear[1] - tear[0]) * (x + 6)) / (W + 12);
      const spike = i % 4 === 2 ? (r() - 0.5) * amp * 2.2 : 0;
      pts.push([x, base + (r() - 0.5) * amp * 2 + spike]);
    }
    return pts;
  }

  const toPts = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // Region kept below a torn edge, as a clip polygon.
  function below(pts: [number, number][]) {
    return toPts([...pts, [W + 6, 400], [-6, 400]]);
  }

  // A corner of the torn piece curling up over the right-hand end of the tear,
  // showing the paper's back. Lens-shaped: the edge points, then the same run
  // lifted by a sine so it bulges in the middle.
  function flap(pts: [number, number][], lift: number) {
    const run = pts.filter(([x]) => x >= 118 && x <= 192);
    if (run.length < 3) return '';
    const n = run.length - 1;
    const up = run.map(([x, y], i) => [x - 2, y - lift * Math.sin((Math.PI * i) / n)] as [number, number]).reverse();
    return toPts([...run, ...up]);
  }

  let sleevePts = $derived(Array.isArray(sleeveTear) ? jag(sleeveTear, 1, 5) : null);
  let foilPts = $derived(Array.isArray(foilTear) ? jag(foilTear, 2, 3.5) : null);

  // Stop-motion wobble: the whole bar shifts a hair on every new frame, the way
  // a hand-posed object never lands in quite the same place twice.
  let wobble = $derived.by(() => {
    const r = seeded(number * 104729 + s * 7);
    const dx = (r() - 0.5) * 3.2;
    const dy = (r() - 0.5) * 3.2;
    const rot = s === 0 ? 0 : (r() - 0.5) * 2.6;
    return `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} 100 170)`;
  });

  // Crumpled foil as low-poly facets: a jittered grid split into triangles, each
  // shaded a slightly different silver. Fixed per bar, it's the same sheet of foil.
  let facets = $derived.by(() => {
    const r = seeded(number * 3571 + 5);
    const cols = 6, rows = 11;
    const cw = FOIL.w / cols, rh = FOIL.h / rows;
    const v: [number, number][][] = [];
    for (let j = 0; j <= rows; j++) {
      v.push([]);
      for (let i = 0; i <= cols; i++) {
        const edge = i === 0 || j === 0 || i === cols || j === rows;
        v[j].push([
          FOIL.x + i * cw + (edge ? 0 : (r() - 0.5) * cw * 0.7),
          FOIL.y + j * rh + (edge ? 0 : (r() - 0.5) * rh * 0.7),
        ]);
      }
    }
    const out: { pts: string; l: number }[] = [];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const a = v[j][i], b = v[j][i + 1], c = v[j + 1][i + 1], d = v[j + 1][i];
        out.push({ pts: toPts([a, b, c]), l: 64 + r() * 30 });
        out.push({ pts: toPts([a, c, d]), l: 60 + r() * 32 });
      }
    }
    return out;
  });

  // 3 × 6 chocolate squares with a bevelled edge.
  const squares = (() => {
    const pad = 7, gap = 5, cols = 3, rows = 6;
    const w = (SLAB.w - pad * 2 - gap * (cols - 1)) / cols;
    const h = (SLAB.h - pad * 2 - gap * (rows - 1)) / rows;
    const out: { x: number; y: number; w: number; h: number }[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++)
        out.push({ x: SLAB.x + pad + i * (w + gap), y: SLAB.y + pad + j * (h + gap), w, h });
    return out;
  })();
  const BEVEL = 5;

  // Scrap thrown off on each new step: purple paper while the sleeve tears,
  // silver once it's the foil's turn.
  let scrap = $derived.by(() => {
    if (!scraps || s === 0) return null;
    const r = seeded(number * 211 + s * 53);
    const tear = s <= 4 ? SLEEVE_TEARS[s] : FOIL_TEARS[s];
    const y = Array.isArray(tear) ? Math.max(30, Math.min(300, (tear[0] + tear[1]) / 2 - 18)) : 60;
    const x = 60 + r() * 80;
    const pts: [number, number][] = [];
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2;
      const rad = 10 + r() * 12;
      pts.push([x + Math.cos(ang) * rad * 1.4, y + Math.sin(ang) * rad]);
    }
    return {
      pts: toPts(pts),
      paper: s <= 4,
      dir: r() > 0.5 ? 1 : -1,
    };
  });
</script>

<svg
  class="cb"
  class:cb-boil={boil}
  viewBox="0 0 200 350"
  role="img"
  aria-label={`Chocolate bar ${number}${s >= UNWRAP_STEPS ? (golden ? ', golden ticket inside' : golden === false ? ', just chocolate' : '') : s > 0 ? `, ${s} of ${UNWRAP_STEPS} unwrapped` : ''}`}
>
  <defs>
    <linearGradient id="{uid}-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FDE7A4" />
      <stop offset="0.35" stop-color="#E0B04A" />
      <stop offset="0.6" stop-color="#F8D983" />
      <stop offset="1" stop-color="#A8781F" />
    </linearGradient>
    <linearGradient id="{uid}-sleeve" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1E0726" />
      <stop offset="0.18" stop-color="#3B1549" />
      <stop offset="0.55" stop-color="#2E0F3A" />
      <stop offset="1" stop-color="#170420" />
    </linearGradient>
    <linearGradient id="{uid}-sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.55" />
      <stop offset="0.3" stop-color="#fff" stop-opacity="0" />
      <stop offset="0.62" stop-color="#fff" stop-opacity="0.35" />
      <stop offset="0.75" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
    <linearGradient id="{uid}-paperback" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F6EBD6" />
      <stop offset="1" stop-color="#CDB894" />
    </linearGradient>
    <!-- Torn edges and curled flaps stay inside their own layer's outline, so
         a tear that runs off the end of the bar doesn't draw on the table. -->
    <clipPath id="{uid}-foil-box"><rect x={FOIL.x} y={FOIL.y - 4} width={FOIL.w} height={FOIL.h + 4} rx="5" /></clipPath>
    <clipPath id="{uid}-sleeve-box"><rect x={SLEEVE.x} y={SLEEVE.y - 16} width={SLEEVE.w} height={SLEEVE.h + 16} /></clipPath>
    {#if sleevePts}
      <clipPath id="{uid}-sleeve-clip"><polygon points={below(sleevePts)} /></clipPath>
    {/if}
    {#if foilPts}
      <clipPath id="{uid}-foil-clip"><polygon points={below(foilPts)} /></clipPath>
    {/if}
  </defs>

  <ellipse class="cb-shadow" cx="100" cy="338" rx="86" ry="8" />

  <g transform={wobble}>
    <!-- Chocolate -->
    <rect x={SLAB.x} y={SLAB.y} width={SLAB.w} height={SLAB.h} rx="6" fill="#2B1409" />
    {#each squares as q, i (i)}
      <rect x={q.x} y={q.y} width={q.w} height={q.h} rx="2" fill="#5A321B" />
      <polygon
        points={toPts([[q.x, q.y], [q.x + q.w, q.y], [q.x + q.w - BEVEL, q.y + BEVEL], [q.x + BEVEL, q.y + BEVEL], [q.x + BEVEL, q.y + q.h - BEVEL], [q.x, q.y + q.h]])}
        fill="#83522F"
      />
      <polygon
        points={toPts([[q.x + q.w, q.y], [q.x + q.w, q.y + q.h], [q.x, q.y + q.h], [q.x + BEVEL, q.y + q.h - BEVEL], [q.x + q.w - BEVEL, q.y + q.h - BEVEL], [q.x + q.w - BEVEL, q.y + BEVEL]])}
        fill="#341A0B"
      />
      <rect x={q.x + BEVEL} y={q.y + BEVEL} width={q.w - BEVEL * 2} height={q.h - BEVEL * 2} fill="#62381F" />
    {/each}

    <!-- What's inside: only ever drawn once fully open -->
    {#if s >= UNWRAP_STEPS && golden}
      <g class="cb-ticket">
        <image
          href={TICKET_SRC}
          width="290"
          height="121"
          transform="translate(100 170) rotate(-86) translate(-145 -60.5)"
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    {/if}

    <!-- Foil -->
    {#if foilTear !== 'gone'}
      <g clip-path={foilPts ? `url(#${uid}-foil-clip)` : undefined}>
        {#each facets as f, i (i)}
          <polygon points={f.pts} fill="hsl(210 8% {f.l}%)" />
        {/each}
        <rect x={FOIL.x} y={FOIL.y} width={FOIL.w} height={FOIL.h} fill="url(#{uid}-sheen)" />
      </g>
      {#if foilPts}
        <g clip-path="url(#{uid}-foil-box)">
          <polyline points={toPts(foilPts)} fill="none" stroke="#F4F6F8" stroke-width="1.6" stroke-linejoin="bevel" />
          {#if s < UNWRAP_STEPS}
            <polygon points={flap(foilPts, 16)} fill="#DDE2E7" stroke="#9AA3AC" stroke-width="0.8" />
          {/if}
        </g>
      {/if}
    {/if}

    <!-- Paper sleeve -->
    {#if sleeveTear !== 'gone'}
      <g clip-path={sleevePts ? `url(#${uid}-sleeve-clip)` : undefined}>
        <rect x={SLEEVE.x} y={SLEEVE.y} width={SLEEVE.w} height={SLEEVE.h} fill="url(#{uid}-sleeve)" />
        <rect x={SLEEVE.x + 8} y={SLEEVE.y + 8} width={SLEEVE.w - 16} height={SLEEVE.h - 16} rx="3"
              fill="none" stroke="url(#{uid}-gold)" stroke-width="1.6" />
        <rect x={SLEEVE.x + 12} y={SLEEVE.y + 12} width={SLEEVE.w - 24} height={SLEEVE.h - 24} rx="2"
              fill="none" stroke="url(#{uid}-gold)" stroke-width="0.6" opacity="0.7" />

        <text x="100" y="98" class="cb-wordmark" fill="url(#{uid}-gold)">MOVION</text>
        <text x="100" y="116" class="cb-small" fill="url(#{uid}-gold)">PRESENTS THE</text>
        <text x="100" y="134" class="cb-small cb-strong" fill="url(#{uid}-gold)">CHOCO LOTTERY</text>

        <line x1="46" y1="148" x2="154" y2="148" stroke="url(#{uid}-gold)" stroke-width="0.8" />
        <text x="100" y="206" class="cb-number" fill="url(#{uid}-gold)">
          <tspan class="cb-no">Nº</tspan>{String(number).padStart(2, '0')}
        </text>
        <line x1="46" y1="222" x2="154" y2="222" stroke="url(#{uid}-gold)" stroke-width="0.8" />

        {#if name}
          <rect x="30" y="236" width="140" height="24" rx="2" fill="url(#{uid}-gold)" />
          <text x="100" y="252.5" class="cb-name">{name.length > 14 ? name.slice(0, 13) + '…' : name}</text>
        {:else}
          <text x="100" y="246" class="cb-tiny" fill="url(#{uid}-gold)">SWEETER IDEAS</text>
          <text x="100" y="258" class="cb-tiny" fill="url(#{uid}-gold)">BRIGHTER TOMORROWS</text>
        {/if}
        <text x="100" y="278" class="cb-tiny" fill="url(#{uid}-gold)" opacity="0.75">MILK CHOCOLATE · 100 G</text>
      </g>
      {#if sleevePts}
        <g clip-path="url(#{uid}-sleeve-box)">
          <polyline points={toPts(sleevePts)} fill="none" stroke="#EFE2C8" stroke-width="2.4" stroke-linejoin="bevel" />
          <polygon points={flap(sleevePts, 22)} fill="url(#{uid}-paperback)" stroke="#B59C74" stroke-width="0.8" />
        </g>
      {/if}
    {/if}
  </g>

  {#if scrap}
    {#key s}
      <polygon
        class="cb-scrap"
        style="--dir:{scrap.dir}"
        points={scrap.pts}
        fill={scrap.paper ? '#3B1549' : '#D5DAE0'}
        stroke={scrap.paper ? '#EFE2C8' : '#F4F6F8'}
        stroke-width="1.2"
      />
    {/key}
  {/if}
</svg>
