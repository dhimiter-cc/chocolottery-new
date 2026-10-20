// The default theme: how Chocolottery looks when no event is running. It states
// every value, so event themes only list what they change.

import type { Theme } from './types.js';

export const DEFAULT_THEME: Theme = {
  id: 'default',
  label: 'Chocolottery',
  copy: {
    'landing.claim': 'One chocolate. Many victims. Whoever finds the golden ticket takes it home.',
    'landing.cornerRight': 'Best drawn before the afternoon slump',
    'landing.footer': 'Packed in the office kitchen. No HR forms were harmed.',

    'reveal.beatOpen': 'Everyone is open.',
    'reveal.beatTicket': 'The golden ticket was in…',
    'reveal.headline': '🎟️ The golden ticket was in',
    'reveal.winnerMsg': "It was in yours. Walk slowly. Don't apologise.",
    'reveal.hostMsg': 'Time to hand over the prize.',
    'reveal.guestMsg': "Pretend you're happy for them. That's professionalism.",
    'reveal.strawHeadline': '🍫 Longest straw belongs to',
    'reveal.strawWinnerMsg': "Take it. Walk slowly. Don't apologise.",
    'reveal.strawGuestMsg': "Pretend you're happy for them. That's professionalism.",

    'unwrap.suspense': [
      'Somewhere in this room, a bar is hiding gold.',
      'Is it yours? Poker face.',
      "Don't look at your neighbour.",
      'Hold the chocolate. Hold your breath.',
      'Every bar looks innocent. One is lying.',
      'Nothing to see here. Probably.',
    ],
    'unwrap.allOpen': 'Everyone is open. Here it comes…',
    'unwrap.allHaveBar': 'Everyone has a bar. One of them has the golden ticket.',

    'snacks.title': 'Snack votes',
    'snacks.cupboardBtn': '🍫 Cupboard',
    'snacks.itemIcon': '',
    'cupboard.title': '🍫 The cupboard',

    'bar.tagline1': 'SWEETER IDEAS',
    'bar.tagline2': 'BRIGHTER TOMORROWS',
  },
  effects: {
    confettiColors: ['#E89817', '#FFD24A', '#E63946', '#6366F1', '#0F9D6E', '#FFFFFF', '#FF7AD5', '#22D3EE'],
    emojiGlyphs: ['🎉', '🍫', '👏', '✨', '🎊'],
    emojiBurst: [9, 16],
    fireworkPalettes: [
      ['#FFD24A', '#E89817', '#FFFBE0'],
      ['#FF7AD5', '#E63946', '#FFFFFF'],
      ['#22D3EE', '#6366F1', '#FFFFFF'],
      ['#0F9D6E', '#A7F3D0', '#FFD24A'],
    ],
    sparkleColors: ['#FFD24A', '#E89817', '#FFFBE0'],
    tearColors: ['#7AB6E8', '#9CC8EE', '#B5D6F2', '#5C9DD8'],
  },
  sounds: {},
};
