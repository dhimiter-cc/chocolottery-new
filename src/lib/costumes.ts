// Costume avatars (Halloween). Handed out at random when someone joins; nobody
// picks theirs. Stored on the player either way, only shown while the active
// theme turns costumes on, so a game started before Halloween still has them.

export const COSTUMES = ['🎃', '👻', '🧛', '🧟', '🧙', '🦇', '🕷️', '💀', '🧚', '🐈‍⬛', '🦉', '🍬'];

/** A costume nobody in the game wears yet; once they're all taken, any. */
export function pickCostume(taken: (string | undefined)[]): string {
  const free = COSTUMES.filter((c) => !taken.includes(c));
  const pool = free.length ? free : COSTUMES;
  return pool[Math.floor(Math.random() * pool.length)];
}
