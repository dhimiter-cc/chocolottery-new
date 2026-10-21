// Trick or treat (Halloween). Kept free of node imports so both the server and
// the browser bundle can read it.

/** One winner in this many opens a trick door; the rest open a treat door. */
export const TRICK_ODDS = 3;

/** Tricks the room must have suggested before a round can start (while the
 *  active theme has trick or treat). House tricks don't count. */
export const MIN_TRICKS = 1;
