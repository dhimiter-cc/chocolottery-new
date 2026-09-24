// One-off: the MOVION Golden Ticket, a 2kg Toblerone handed to whoever draws the
// longest straw on the day of the team outing.
//
// Everything about this feature keys off the two dates below. Outside the window
// nothing renders — no button, no banner, no auto-opening modal — so the app goes
// back to normal on its own and nobody has to remember to deploy a removal.

/** Day of the outing. The golden ticket only pays off on this date. */
export const EVENT_DATE = '2026-09-25';

/** First day the teaser is shown. Before this, the feature is invisible. */
export const TEASE_FROM = '2026-09-21';

/** localStorage key: the teaser auto-opens once per browser per day. */
export const STORAGE_KEY = 'chocolottery_golden_ticket_v1';

// Measurements are the manufacturer's for the XXL personalised bar
// (42.6 x 11.4 x 10 cm, 1800 g, 18 x 100 g inside) — not estimates. The reveal
// prints them as copy AND draws the scale silhouette from them, so a wrong
// number here shows up twice.
export const PRIZE = {
  brand: 'MOVION',
  weightKg: 1.8,
  /** Real length of the box — drives the to-scale silhouette in the reveal. */
  lengthCm: 42.6,
  /** Depth of the box, for the silhouette's bar thickness. */
  thicknessCm: 11,
  /** How many 100 g bars are inside — the detail that sells the size. */
  barsInside: 18,
  /** Reference height the silhouette is drawn at, same units. */
  personCm: 175,
} as const;

/** `YYYY-MM-DD` in the viewer's own timezone — ISO dates compare correctly as strings. */
function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Teaser window: from the first office day through the end of the outing. */
export function isTeaseActive(now: Date = new Date()): boolean {
  const today = localDate(now);
  return today >= TEASE_FROM && today <= EVENT_DATE;
}

/** The day itself — gates the post-reveal payoff. */
export function isEventDay(now: Date = new Date()): boolean {
  return localDate(now) === EVENT_DATE;
}

/** `?event` on a game link previews the event-day layout on any other day.
 *  Browser-only — call it after mount, never while server-rendering. */
export function hasEventPreviewParam(): boolean {
  try { return new URLSearchParams(window.location.search).has('event'); } catch { return false; }
}

/** Has this browser already auto-opened the teaser today? Stores the date rather
 *  than a plain flag, so the reminder comes back each new day instead of only once
 *  for the whole tease window. */
export function hasSeenTeaserToday(now: Date = new Date()): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === localDate(now); } catch { return false; }
}

/** Marks today as seen — call the moment the teaser auto-opens, not on close. */
export function markTeaserSeenToday(now: Date = new Date()): void {
  try { localStorage.setItem(STORAGE_KEY, localDate(now)); } catch { /* no storage, no problem */ }
}
