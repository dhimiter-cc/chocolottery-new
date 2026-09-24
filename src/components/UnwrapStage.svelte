<script lang="ts">
  // A player's own bar, full screen on a dark stage. Swiping (finger) or
  // dragging (mouse) anywhere on the screen tears it open one step at a time.
  //
  // The frames are stop-motion — the bar only ever shows whole steps — but the
  // input is continuous: the meter fills with every pixel of movement and the
  // bar leans into the drag, so it never feels like nothing is happening
  // between two frames.
  //
  // Doesn't talk to the server. It reports each new step through `onProgress`
  // and is told what's inside through `golden` once the parent finds out.
  import type { Snippet } from 'svelte';
  import ChocolateBar from './ChocolateBar.svelte';
  import { UNWRAP_STEPS, STEP_SWIPE } from '../lib/bars.js';
  import { playPaperRip, playFoilCrinkle } from '../lib/sound.js';

  let {
    number,
    initialStep = 0,
    golden = null,
    onProgress,
    footer,
    corner,
  }: {
    number: number;
    /** Where the server says this bar already is — survives a reload. */
    initialStep?: number;
    /** null until the server has answered the final step. */
    golden?: boolean | null;
    onProgress: (step: number) => void;
    footer?: Snippet;
    corner?: Snippet;
  } = $props();

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const coarse =
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

  // Continuous progress, in steps (e.g. 3.4 = three frames in, 40% towards the
  // fourth). Seeded from the server once, then owned locally.
  let progress = $state(0);
  let seeded = false;
  $effect(() => {
    if (seeded) return;
    seeded = true;
    progress = Math.min(UNWRAP_STEPS, initialStep);
  });

  let step = $derived(Math.min(UNWRAP_STEPS, Math.floor(progress)));
  let opened = $derived(step >= UNWRAP_STEPS);
  // The last frame waits on the server: until it says what's inside, hold the
  // bar on its final foil pose and shiver it.
  let waiting = $derived(opened && golden === null);
  let shownStep = $derived(waiting ? UNWRAP_STEPS - 1 : step);

  let lastReported = -1;
  $effect(() => {
    const s = step;
    if (s <= lastReported) return;
    const first = lastReported === -1;
    lastReported = s;
    // The seed from initialStep isn't a new tear — no sound, no report.
    if (first && s === Math.min(UNWRAP_STEPS, initialStep)) return;
    if (s <= 4) playPaperRip(); else playFoilCrinkle();
    try { navigator.vibrate?.(14); } catch {}
    onProgress(s);
  });

  // The page underneath must not scroll while a finger is dragging over this.
  $effect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = prev; };
  });

  // ── Input ───────────────────────────────────────────────────────────────
  let stepPx = 300;
  let active: number | null = null;
  let last: { x: number; y: number; t: number } | null = null;
  let lean = $state(0);
  let tug = $state(0);

  function measure() {
    stepPx = Math.max(160, Math.min(window.innerWidth, window.innerHeight) * STEP_SWIPE);
  }

  function onDown(e: PointerEvent) {
    if (opened) return;
    if ((e.target as HTMLElement).closest('button, a')) return;
    measure();
    active = e.pointerId;
    last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onMove(e: PointerEvent) {
    if (active !== e.pointerId || !last || opened) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    const dt = Math.max(1, e.timeStamp - last.t);
    last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    // Cap a single event's contribution so a flung pointer can't skip frames.
    const d = Math.min(Math.hypot(dx, dy), stepPx * 0.5);
    progress = Math.min(UNWRAP_STEPS, progress + d / stepPx);
    if (!reducedMotion) {
      const vx = dx / dt;
      lean = Math.max(-6, Math.min(6, vx * 3));
      tug = Math.max(-14, Math.min(14, vx * 7));
    }
  }

  function onUp(e: PointerEvent) {
    if (active !== e.pointerId) return;
    active = null;
    last = null;
    lean = 0;
    tug = 0;
  }

  // Keyboard / one-tap route: one whole step per press.
  function tearStrip() {
    if (opened) return;
    progress = Math.min(UNWRAP_STEPS, Math.floor(progress) + 1);
  }

  let fraction = $derived(Math.min(1, progress / UNWRAP_STEPS));

  let guide = $derived.by(() => {
    if (golden === true) return 'You found the Golden Ticket!';
    if (golden === false) return 'Just chocolate. Still chocolate, though.';
    if (waiting) return 'Something in there…';
    if (step === 0) return coarse ? 'Swipe across the screen to unwrap your bar' : 'Drag across the screen to unwrap your bar';
    if (step <= 2) return 'Keep going. Rip that paper.';
    if (step <= 4) return 'Nearly through the wrapper…';
    if (step <= 6) return 'Now the foil…';
    return 'One more…';
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="unwrap-screen"
  class:is-open={golden !== null}
  class:is-golden={golden === true}
  onpointerdown={onDown}
  onpointermove={onMove}
  onpointerup={onUp}
  onpointercancel={onUp}
>
  {#if corner}<div class="unwrap-corner">{@render corner()}</div>{/if}

  <p class="unwrap-kicker">Bar Nº {String(number).padStart(2, '0')} · yours</p>
  <p class="unwrap-guide" aria-live="polite">{guide}</p>

  <div class="unwrap-bar" class:waiting style="--lean:{lean}deg; --tug:{tug}px">
    <ChocolateBar step={shownStep} {number} golden={opened ? golden : null} scraps={!reducedMotion} boil={step === 0 && !reducedMotion} />
  </div>

  <div class="unwrap-meter" role="progressbar" aria-valuemin="0" aria-valuemax={UNWRAP_STEPS} aria-valuenow={step} aria-label="Unwrapped">
    <span style="transform: scaleX({fraction})"></span>
  </div>

  {#if !opened}
    <button type="button" class="unwrap-tear" onclick={tearStrip}>or tap to tear a strip</button>
  {/if}

  {#if footer}<div class="unwrap-footer">{@render footer()}</div>{/if}
</div>
