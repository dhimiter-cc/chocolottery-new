// Winter: Santa on a rope, the sleigh crossing the sky every 30 seconds, snow on
// the panels, hats on the buttons and the people. The wrapper stays aubergine and
// gold; ice blue and a little candy red join it, and gold stays the winner's
// colour. Look: styles/themes/winter.css. Ambient layer: winter/Decor.astro.
// Art: winter/art (CC0, see CREDITS.md).
//
// It runs from the first of December to Twelfth Night (the dashboard can move
// the dates), and a preview is always one `?theme=winter` away.

import type { EventTheme, PrintItem } from './types.js';
import santaUrl from './winter/art/santa.svg?url';
import sleighUrl from './winter/art/sleigh.svg?url';

/** Six-armed snowflake centred on (0, 0), radius 10. */
const FLAKE = [0, 60, 120]
  .map((deg) => {
    const a = (deg * Math.PI) / 180;
    const x = Math.cos(a) * 10;
    const y = Math.sin(a) * 10;
    return `M${(-x).toFixed(1)} ${(-y).toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`;
  })
  .join('');

/** A sprig of holly, 24 x 24: two pointed leaves and three berries (even-odd). */
const HOLLY =
  'M12 15C9.5 10 4.5 9.5 1.5 12.5C4.6 12.6 6.7 14.4 7.6 17.4C9.2 16 10.8 15.3 12 15ZM12 15C14.5 10 19.5 9.5 22.5 12.5C19.4 12.6 17.3 14.4 16.4 17.4C14.8 16 13.2 15.3 12 15ZM9.2 14.2a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0-4.2 0ZM6.4 18.4a2 2 0 1 0 4 0a2 2 0 1 0-4 0ZM13.6 18.4a2 2 0 1 0 4 0a2 2 0 1 0-4 0Z';

export const WINTER: EventTheme = {
  id: 'winter',
  label: 'Winter',
  window: { from: '2026-12-01', to: '2027-01-06' },

  copy: {
    'landing.claim': 'One chocolate. Many victims. Whoever finds the golden ticket gets the cosy win.',
    'landing.cornerRight': 'Best drawn with gloves on',
    'landing.footer': 'Packed in the office kitchen. No HR forms were harmed. The radiator was.',

    'reveal.beatOpen': 'Listen. Sleigh bells.',
    'reveal.beatTicket': 'The golden ticket was in…',
    'reveal.headline': '🎁 Santa left the golden ticket in',
    'reveal.winnerMsg': 'Ho ho ho! It was in yours. You were on the nice list all along.',
    'reveal.hostMsg': 'Time to play Santa and hand over the prize.',
    'reveal.guestMsg': "Santa's list is long. There is always next round.",
    'reveal.strawHeadline': '🎁 Longest straw belongs to',
    'reveal.strawWinnerMsg': "Ho ho ho! Take it. You've been nice.",
    'reveal.strawGuestMsg': "You're on the nice list anyway.",

    'unwrap.suspense': [
      'Somewhere in this room, a bar is wearing a bow.',
      "Is it yours? Santa is watching.",
      'Checking the list. Checking it twice.',
      'Hold the chocolate. Hold your mug.',
      'Every bar looks nice. One is on the nice list.',
      'Jingle bells, jingle bells. Hands off your neighbour.',
    ],
    'unwrap.allOpen': 'Every bar is open. Santa is on his way…',
    'unwrap.allHaveBar': 'Everyone has a bar. One of them is on the nice list.',

    'snacks.title': 'Treat votes',
    'snacks.cupboardBtn': '🎁 Stocking',
    'snacks.itemIcon': '❄️',
    'cupboard.title': '🎁 The stocking',

    'bar.tagline1': 'COSIER IDEAS',
    'bar.tagline2': 'WARMER TOMORROWS',
  },

  effects: {
    // Gold leads; snow white, ice blue and a little candy red join it.
    confettiColors: ['#F3CF6E', '#FFD24A', '#FFD24A', '#FFFFFF', '#BFE3FF', '#7AB6E8', '#E5484D', '#FFFBE0'],
    emojiGlyphs: ['❄️', '🎁', '⭐', '🍬', '🍫', '☃️', '✨'],
    emojiBurst: [12, 22],
    fireworkPalettes: [
      ['#FFD24A', '#E89817', '#FFFBE0'],
      ['#BFE3FF', '#7AB6E8', '#FFFFFF'],
      ['#E5484D', '#FFD24A', '#FFFFFF'],
      ['#6FD6AE', '#FFD24A', '#FFFBE0'],
    ],
    sparkleColors: ['#FFFFFF', '#BFE3FF', '#FFD24A', '#FFFBE0'],
    tearColors: ['#9CC8EE', '#BFE3FF', '#7AB6E8', '#E3F1FF'],
    // Losers get snowmen and frost drifting up out of the floor.
    tearGlyphs: ['☃️', '☃️', '❄️', '❄️', '🥶'],
    tearGlyphCount: 12,
  },

  // Sleigh bells as the winning bar lights up.
  sounds: { barLit: 'playSleighBells' },

  // Santa delivers: the sleigh sweeps over the stage dropping confetti as the name
  // lands, and Santa comes up in the corner, waving, with a word for the winner.
  cameo: {
    figure: {
      src: santaUrl,
      // The glove, tilting from the wrist (same paths as winter/Santa.astro).
      wave: [3, 10, 20, 21, 111, 116],
      pivot: [70, 84],
      label: 'Santa, waving',
    },
    flyer: { src: sleighUrl, label: "Santa's sleigh" },
    line: 'Ho ho ho! {name} was nice this year.',
    lineForWinner: 'Ho ho ho! You were on the nice list.',
  },

  // The advent calendar (lib/advent.ts): every win opens the next door.
  advent: {
    title: 'Advent calendar',
    intro: "One door for every day from 1 to 24 December. Every win opens the next door: Saturday's opens on Friday and Sunday's on Monday, so those days have two rounds.",
    lobbyNext: '🎄 This round opens advent door {door}',
    lobbyWaiting: '{n} doors waiting today',
    revealLead: '🎄 Advent door {door}',
    surprise: 'A surprise from the calendar',
    teaserLobby: '🎄 The advent calendar opens on {date} · one door per win',
    teaserLead: '🎄 Advent calendar',
    teaserIn: 'Opens in {n} days',
    teaserTomorrow: 'Opens tomorrow',
    teaserSign: 'Opens {date}',
  },

  barPrint: ({ sleeve }): PrintItem[] => [
    { d: FLAKE, transform: `translate(${sleeve.x + sleeve.w - 26} ${sleeve.y + 26})`, stroke: 'gold', strokeWidth: 1.4, fill: 'none', opacity: 0.8 },
    { d: FLAKE, transform: `translate(${sleeve.x + 26} ${sleeve.y + 26}) scale(0.7)`, stroke: 'gold', strokeWidth: 1.6, fill: 'none', opacity: 0.6 },
    // A sprig of holly either side of the bar number.
    { d: HOLLY, transform: 'translate(22 175) scale(0.78)', fill: 'gold', fillRule: 'evenodd', opacity: 0.9 },
    { d: HOLLY, transform: 'translate(160 175) scale(0.78)', fill: 'gold', fillRule: 'evenodd', opacity: 0.9 },
  ],
};
