// Chocolate-bar mode: the straws' twin. Shared by the server (how many unwrap
// steps count as "open") and the client (what each step looks like).
//
// The draw itself is unchanged — `game.straws` still holds one `100` among
// random values. In bar mode the `100` is simply the bar with the golden ticket
// inside, so picking, the leaderboard and the fairness check never know which
// skin the round was played in.

import type { GameStyle } from './types.js';

/** New games start in this style. The host can flip it from the lobby. */
export const DEFAULT_STYLE: GameStyle = 'bars';

/** Steps from sealed (0) to open (UNWRAP_STEPS). Paper tears on 1–4, the foil
 *  on 5–7, and the last step shows what's inside. The server only reveals a
 *  bar's contents once its holder reaches this number. */
export const UNWRAP_STEPS = 8;

/** Swipe distance per step, as a fraction of the shorter screen side — so a
 *  phone and a laptop both take roughly one full swipe per step. */
export const STEP_SWIPE = 0.55;

/** Shelf density for a round of `n` bars. The whole office has to fit on the
 *  host's screen, so past a dozen bars they shrink rather than scroll off. */
export function shelfDensity(n: number): '' | 'dense' | 'denser' {
  return n > 24 ? 'denser' : n > 12 ? 'dense' : '';
}

/** Deterministic PRNG (mulberry32). Each bar and frame gets its own seed so the
 *  torn edges and the stop-motion wobble are random-looking but identical on
 *  every render and every device. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The ticket art is ~490 KB. Left to load on demand, the winner's last frame
 *  shows bare chocolate for a beat before the ticket pops in — so every bar-mode
 *  screen starts fetching and decoding it as soon as the bars appear. */
export const TICKET_SRC = '/golden-ticket.webp';
let ticketWarm: Promise<void> | null = null;
export function preloadTicket(): Promise<void> {
  if (!ticketWarm && typeof Image !== 'undefined') {
    const img = new Image();
    img.src = TICKET_SRC;
    ticketWarm = img.decode().catch(() => {});
  }
  return ticketWarm ?? Promise.resolve();
}
