// Size the bars to the stage instead of to the head count. On the desktop
// layout the stage has a fixed height (the room fills the viewport), so we can
// pick the biggest bar that still fits every row: five bars come out large,
// forty fill the screen on the wall without scrolling.
//
// Narrow screens scroll anyway, so there the density classes from
// shelfDensity() keep deciding and this steps aside.
import type { Attachment } from 'svelte/attachments';

const GAP = 12;
const MIN_W = 44;
const MAX_W = 150;
/** The bar SVG's viewBox is 200 × 350. */
const RATIO = 350 / 200;

/**
 * @param count   bars on the shelf
 * @param reserve px of stage height taken by whatever sits above the shelf
 * @param label   px each tile needs below its bar (names, meters)
 */
export function fitShelf(count: number, reserve: number, label: number): Attachment<HTMLElement> {
  return (shelf) => {
    const stage = shelf.closest<HTMLElement>('.cup-stage');
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const wide = window.matchMedia('(min-width: 1100px)');

    const fit = () => {
      if (!wide.matches) {
        shelf.classList.remove('fitted');
        return;
      }
      const cs = getComputedStyle(stage);
      const W = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const H = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - reserve;
      let best = MIN_W;
      for (let w = MAX_W; w >= MIN_W; w -= 2) {
        const cols = Math.max(1, Math.floor((W + GAP) / (w + GAP)));
        const rows = Math.ceil(count / cols);
        if (rows * (w * RATIO + label) + (rows - 1) * GAP <= H) {
          best = w;
          break;
        }
      }
      shelf.style.setProperty('--bar-w', `${best}px`);
      shelf.classList.add('fitted');
    };

    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    wide.addEventListener('change', fit);
    fit();

    return () => {
      ro.disconnect();
      wide.removeEventListener('change', fit);
      shelf.classList.remove('fitted');
      shelf.style.removeProperty('--bar-w');
    };
  };
}
