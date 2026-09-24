// Size the bars to the stage instead of to the head count. On the desktop
// layout the stage has a fixed height (the room fills the viewport), so we can
// pick the biggest bar that still fits every row: five bars come out large,
// forty fill the screen on the wall without scrolling.
//
// Everything is measured, nothing guessed. An earlier version reserved a fixed
// number of pixels for the headline above the shelf; when that was a few px
// short, the stage grew a scrollbar, the scrollbar ate 15px of width, the bars
// refit smaller, the scrollbar went away, the bars refit bigger — a flicker
// loop on the screen on the wall. So: the stage clips instead of scrolling
// (global.css), the room above the shelf and the tile's own chrome are read
// off the DOM, and the stage only turns scrollable (`shelf-overflow`) when even
// the smallest bar can't fit.
//
// Narrow screens scroll anyway, so there the density classes from
// shelfDensity() keep deciding and this steps aside.
import type { Attachment } from 'svelte/attachments';

const GAP = 12;
const MIN_W = 44;
const MAX_W = 150;
/** The bar SVG's viewBox is 200 × 350. */
const RATIO = 350 / 200;
/** Breathing room so sub-pixel rounding can never tip the shelf over. */
const SLACK = 6;

function outerHeight(el: Element): number {
  const cs = getComputedStyle(el);
  return el.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
}

/** In-flow children only: the countdown and overlays are absolutely positioned. */
function inFlow(el: Element): boolean {
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed';
}

/**
 * Height taken by everything between the stage's padding and the shelf: the
 * headline, the "Unwrap my bar" button, the gaps of every flex container on
 * the way down. Walks from the shelf up to the stage, adding its siblings.
 */
function roomAbove(stage: HTMLElement, shelf: HTMLElement): number {
  let used = 0;
  let node: HTMLElement = shelf;
  while (node !== stage && node.parentElement) {
    const parent = node.parentElement;
    const kids = [...parent.children].filter(inFlow);
    for (const k of kids) if (k !== node) used += outerHeight(k);
    const cs = getComputedStyle(parent);
    if (cs.display.includes('flex') && cs.flexDirection.startsWith('column')) {
      used += (parseFloat(cs.rowGap) || 0) * Math.max(0, kids.length - 1);
    }
    if (parent !== stage) used += parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    node = parent;
  }
  return used;
}

/** A tile's height at bar width `w`, from a real tile: its SVG scales with the
 *  column, and everything else in it (padding, names, meter) doesn't. */
function tileModel(shelf: HTMLElement): { padX: number; chrome: number } {
  const tile = shelf.firstElementChild as HTMLElement | null;
  const svg = tile?.querySelector('svg');
  if (!tile || !svg) return { padX: 8, chrome: 46 };
  const t = tile.getBoundingClientRect();
  const s = svg.getBoundingClientRect();
  return { padX: Math.max(0, t.width - s.width), chrome: Math.max(0, t.height - s.height) };
}

/**
 * @param count bars on the shelf (the attachment re-runs when it changes)
 */
export function fitShelf(count: number): Attachment<HTMLElement> {
  return (shelf) => {
    const stage = shelf.closest<HTMLElement>('.cup-stage');
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const wide = window.matchMedia('(min-width: 1100px)');
    let applied = -1;

    const fit = () => {
      if (!wide.matches) {
        shelf.classList.remove('fitted');
        stage.classList.remove('shelf-overflow');
        applied = -1;
        return;
      }
      const cs = getComputedStyle(stage);
      const W = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const H = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
        - roomAbove(stage, shelf) - SLACK;
      const { padX, chrome } = tileModel(shelf);

      let best = 0;
      for (let w = MAX_W; w >= MIN_W; w -= 2) {
        const cols = Math.max(1, Math.floor((W + GAP) / (w + GAP)));
        const rows = Math.ceil(count / cols);
        const tileH = (w - padX) * RATIO + chrome;
        if (rows * tileH + (rows - 1) * GAP <= H) {
          best = w;
          break;
        }
      }
      // Nothing fits, even at the smallest size: let the stage scroll rather
      // than clip someone's bar off the bottom.
      stage.classList.toggle('shelf-overflow', best === 0);
      const w = best || MIN_W;
      if (w !== applied) {
        applied = w;
        shelf.style.setProperty('--bar-w', `${w}px`);
      }
      shelf.classList.add('fitted');
    };

    // Re-fit when the stage changes size, and when anything above the shelf
    // does (a headline wrapping onto two lines, a button appearing) — the
    // stage itself doesn't resize for those. The shelf is never observed:
    // it's the thing being sized.
    const ro = new ResizeObserver(() => fit());
    ro.observe(stage);
    for (let node: HTMLElement | null = shelf; node && node !== stage; node = node.parentElement) {
      const parent = node.parentElement;
      if (!parent) break;
      for (const k of parent.children) if (k !== node) ro.observe(k);
    }
    wide.addEventListener('change', fit);
    fit();

    return () => {
      ro.disconnect();
      wide.removeEventListener('change', fit);
      shelf.classList.remove('fitted');
      stage.classList.remove('shelf-overflow');
      shelf.style.removeProperty('--bar-w');
    };
  };
}
