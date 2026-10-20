// Winter: a deliberately small second theme. It exists to show that an event is
// just a data file + a CSS file + (optionally) a Decor.astro, and that a theme
// with no `window` never switches on by itself: preview it with `?theme=winter`
// or THEME=winter. Give it a window when there is a real winter event to run.

import type { EventTheme, PrintItem } from './types.js';

/** Six-armed snowflake centred on (0, 0), radius 10. */
const FLAKE = [0, 60, 120]
  .map((deg) => {
    const a = (deg * Math.PI) / 180;
    const x = Math.cos(a) * 10;
    const y = Math.sin(a) * 10;
    return `M${(-x).toFixed(1)} ${(-y).toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`;
  })
  .join('');

export const WINTER: EventTheme = {
  id: 'winter',
  label: 'Winter',

  copy: {
    'landing.claim': 'One chocolate. Many victims. Whoever finds the golden ticket gets the cosy win.',
    'landing.cornerRight': 'Best drawn with gloves on',
    'landing.footer': 'Packed in the office kitchen. No HR forms were harmed. The radiator was.',
    'reveal.headline': '🎁 The golden ticket was in',
    'reveal.strawHeadline': '🎁 Longest straw belongs to',
    'snacks.itemIcon': '❄️',
    'snacks.title': 'Treat votes',
    'bar.tagline1': 'COSIER IDEAS',
    'bar.tagline2': 'WARMER TOMORROWS',
  },

  effects: {
    confettiColors: ['#F3CF6E', '#FFD24A', '#FFFFFF', '#BFE3FF', '#7AB6E8', '#E63946', '#FFFBE0'],
    emojiGlyphs: ['❄️', '🎁', '⭐', '🍫', '☃️', '✨'],
    emojiBurst: [12, 20],
    sparkleColors: ['#FFFFFF', '#BFE3FF', '#FFD24A'],
  },

  barPrint: ({ sleeve }): PrintItem[] => [
    { d: FLAKE, transform: `translate(${sleeve.x + sleeve.w - 26} ${sleeve.y + 26})`, stroke: 'gold', strokeWidth: 1.4, fill: 'none', opacity: 0.8 },
    { d: FLAKE, transform: `translate(${sleeve.x + 26} ${sleeve.y + 26}) scale(0.7)`, stroke: 'gold', strokeWidth: 1.6, fill: 'none', opacity: 0.6 },
  ],
};
