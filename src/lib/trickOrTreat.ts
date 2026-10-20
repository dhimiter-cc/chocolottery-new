// Trick or treat, the server side. The winner doesn't choose a door (nobody
// would pick "trick"): it is decided by the sealed draw, like a real doorstep.
//
//   treat  the usual prize, nothing else
//   trick  the most-voted trick from the room, then the usual prize anyway
//
// The door comes from the draw salt, which is secret until the reveal, so it
// can't be gamed and anyone can recompute it afterwards:
//   echo -n '<salt>:door' | sha256sum   # first byte % 3 === 0 means trick

import { createHash, randomInt } from 'node:crypto';
import type { Suggestion, PrizeSnack } from './types.js';
import { TRICK_ODDS } from './trickOdds.js';

export type Door = 'trick' | 'treat';

export function doorFor(salt: string): Door {
  const first = createHash('sha256').update(salt + ':door').digest()[0];
  return first % TRICK_ODDS === 0 ? 'trick' : 'treat';
}

/** Mild ones, for a room that suggested none. */
export const HOUSE_TRICKS = [
  'Say "trick or treat" in your best spooky voice.',
  'Tell the room about your worst costume ever.',
  'Compliment the person on your left like a vampire would.',
  'Do your best witch cackle. Commit to it.',
  'Walk to the prize like a zombie.',
  'Give the room your most dramatic ghost impression.',
];

/** The room's top-voted trick (ties broken at random), or a house trick when
 *  nobody suggested any. Same shape as the prize snack. */
export function pickTrick(tricks: Suggestion[] | undefined): PrizeSnack {
  if (!tricks?.length) {
    return { text: HOUSE_TRICKS[randomInt(HOUSE_TRICKS.length)], author_name: 'The house', votes: 0, random: true };
  }
  const max = Math.max(0, ...tricks.map((t) => t.votes?.length ?? 0));
  const top = tricks.filter((t) => (t.votes?.length ?? 0) === max);
  const pick = top[randomInt(top.length)];
  return { text: pick.text, author_name: pick.author_name, votes: pick.votes?.length ?? 0, random: max === 0 };
}
