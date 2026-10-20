// Halloween: a bat on the wordmark, fog and bats in the background, a cursed
// reveal. Plum and gold stay; violet is mist only and gold stays the winner's
// colour. Look: styles/themes/halloween.css. Ambient layer: halloween/Decor.astro.

import type { EventTheme, PrintItem } from './types.js';

/** A jack-o'-lantern, 24 x 24, face cut out with the even-odd rule. */
const PUMPKIN =
  'M11 6L11.6 2.4L14 2.4L13.4 6C16.5 6.6 21 8.6 21 13.5C21 19 17 22 12 22C7 22 3 19 3 13.5C3 8.6 7.5 6.6 11 6ZM7 13.6L10 13.6L8.5 10.4ZM14 13.6L17 13.6L15.5 10.4ZM7.4 16.2L10 18.4L12 16.8L14 18.4L16.6 16.2L16.2 19.6Q12 21.2 7.8 19.6Z';

const BAT =
  'M29 11L30 4L32 8L34 4L35 11C42 8 52 8 62 12Q57 17 52 18Q50 22 46 20Q43 26 38 22L35 28L32 31L29 28L26 22Q21 26 18 20Q14 22 12 18Q7 17 2 12C12 8 22 8 29 11Z';

/** A cobweb strung from (cx, cy), spokes fanning down-left, with sagging rings. */
function web(cx: number, cy: number, reach: number): string {
  const angles = [90, 112, 135, 157, 180].map((a) => (a * Math.PI) / 180);
  const at = (a: number, r: number): [number, number] => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const pt = ([x, y]: [number, number]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  const spokes = angles.map((a) => `M${pt([cx, cy])}L${pt(at(a, reach))}`).join('');
  const rings = [0.3, 0.55, 0.8, 1]
    .map((f) =>
      angles
        .slice(0, -1)
        .map((a, i) => `M${pt(at(a, reach * f))}Q${pt(at((a + angles[i + 1]) / 2, reach * f * 0.84))} ${pt(at(angles[i + 1], reach * f))}`)
        .join(''),
    )
    .join('');
  return spokes + rings;
}

export const HALLOWEEN: EventTheme = {
  id: 'halloween',
  label: 'Halloween',
  window: { from: '2026-10-20', to: '2026-11-01' },

  copy: {
    'landing.claim': 'One chocolate. Many victims. Whoever the curse picks takes the golden ticket home.',
    'landing.cornerRight': 'Best drawn after dark',
    'landing.footer': 'Packed in the office kitchen. No HR forms were harmed. Some pumpkins were.',

    'reveal.beatOpen': 'Knock, knock…',
    'reveal.beatTicket': 'Trick or treat?',
    'reveal.headline': '🎃 The spirits chose',
    'reveal.winnerMsg': "It was in yours. The spirits chose you. Walk slowly. Don't look behind you.",
    'reveal.hostMsg': 'Time to hand over the loot.',
    'reveal.guestMsg': 'Smile for them. The curse can hear you.',
    'reveal.strawHeadline': '🎃 The curse fell on',
    'reveal.strawWinnerMsg': "Take it. The spirits chose you. Don't look behind you.",
    'reveal.strawGuestMsg': 'Smile for them. The curse can hear you.',

    'unwrap.suspense': [
      'Something stirs inside one of these bars.',
      "Is it yours? Don't look. It's watching.",
      'The candles just flickered. Nobody blinked.',
      'Hold the chocolate. Hold your breath.',
      'Every bar looks innocent. One is cursed with gold.',
      'Did you hear that? Neither did anyone else.',
    ],
    'unwrap.allOpen': 'Every bar is open. It rises…',
    'unwrap.allHaveBar': 'Everyone has a bar. One of them is haunted by the golden ticket.',

    'snacks.title': 'Treat votes',
    'snacks.cupboardBtn': '🎃 Cauldron',
    'snacks.itemIcon': '🎃',
    'cupboard.title': '🎃 The cauldron',

    'bar.tagline1': 'SPOOKIER IDEAS',
    'bar.tagline2': 'DARKER TOMORROWS',
  },

  effects: {
    // Gold leads; violet and a pinch of pumpkin orange join it.
    confettiColors: ['#F3CF6E', '#FFD24A', '#FFD24A', '#8B5CF6', '#B794F6', '#F28C28', '#FFFBE0'],
    emojiGlyphs: ['🎃', '🦇', '👻', '🕸️', '🍬', '🍫', '✨'],
    emojiBurst: [14, 26],
    fireworkPalettes: [
      ['#FFD24A', '#E89817', '#FFFBE0'],
      ['#8B5CF6', '#C4B5FD', '#FFFFFF'],
      ['#F28C28', '#FFD24A', '#FFFFFF'],
      ['#B794F6', '#F3CF6E', '#FFFBE0'],
    ],
    sparkleColors: ['#FFD24A', '#C4B5FD', '#FFFBE0', '#8B5CF6'],
    tearColors: ['#B794F6', '#C4B5FD', '#8B5CF6', '#DDD0FF'],
    // Losers get ghosts drifting up out of the floor.
    tearGlyphs: ['👻', '👻', '👻', '👻', '💀'],
    tearGlyphCount: 14,
  },

  // Someone knocks, the door creaks, then the bar lights up.
  sounds: { revealStart: 'playKnock', barLit: 'playSpookyStinger' },

  // Trick or treat: the room votes on tricks; one winner in three opens a trick
  // door (the most-voted trick, then the prize anyway), the rest a treat door.
  trickOrTreat: {
    title: 'Trick votes',
    intro:
      'One winner in {odds} opens a trick door: they do the most-voted trick, then take the prize anyway. You write the tricks, so nothing here is a surprise you did not vote for.',
    placeholder: 'Do a ghost impression, hum the Jaws theme…',
    empty: 'No tricks yet. The house keeps a few mild ones in reserve.',
    knocking: 'Knock, knock…',
    treat: '🍬 Treat! Take the prize.',
    trickLead: '🕷️ Trick!',
    trickNote: 'Do it, then take the prize.',
  },

  // Everyone arrives in a random costume.
  costumes: true,

  barPrint: ({ sleeve }): PrintItem[] => [
    { d: web(sleeve.x + sleeve.w - 10, sleeve.y + 10, 44), fill: 'none', stroke: 'gold', strokeWidth: 0.7, opacity: 0.55 },
    { d: BAT, transform: 'translate(84 56) scale(0.5)', fill: 'gold' },
    // A pumpkin either side of the bar number.
    { d: PUMPKIN, transform: 'translate(23 176) scale(0.75)', fill: 'gold', fillRule: 'evenodd', opacity: 0.9 },
    { d: PUMPKIN, transform: 'translate(159 176) scale(0.75)', fill: 'gold', fillRule: 'evenodd', opacity: 0.9 },
  ],
};
