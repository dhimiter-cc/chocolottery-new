// The theme registry. To add an event:
//   1. src/themes/<id>.ts          what it says and throws (copy, effects, sounds, bar print)
//   2. src/styles/themes/<id>.css  how it looks, every rule under html[data-theme='<id>']
//   3. src/themes/<id>/Decor.astro optional ambient markup, registered in decor.ts
//   4. add it to EVENTS below (earlier entries win if windows overlap)
// Whether an event runs, and on which dates, is a setting (admin dashboard,
// lib/settings.ts): EVENTS is only the list of what exists. To remove one for
// good, delete it from EVENTS. The default theme is what everything falls back
// to, so nothing else needs touching.

import type { EventTheme, Theme } from './types.js';
import { DEFAULT_THEME } from './default.js';
import { HALLOWEEN } from './halloween.js';
import { WINTER } from './winter.js';

export { DEFAULT_THEME };
export type { Theme, EventTheme, Copy, CopyKey } from './types.js';

export const EVENTS: EventTheme[] = [HALLOWEEN, WINTER];

/** The default theme with an event's overrides merged on top. */
export function buildTheme(event?: EventTheme): Theme {
  if (!event) return DEFAULT_THEME;
  return {
    id: event.id,
    label: event.label,
    copy: { ...DEFAULT_THEME.copy, ...event.copy },
    trickOrTreat: event.trickOrTreat ?? DEFAULT_THEME.trickOrTreat,
    costumes: event.costumes ?? DEFAULT_THEME.costumes,
    effects: { ...DEFAULT_THEME.effects, ...event.effects },
    sounds: { ...DEFAULT_THEME.sounds, ...event.sounds },
    barPrint: event.barPrint ?? DEFAULT_THEME.barPrint,
    cameo: event.cameo ?? DEFAULT_THEME.cameo,
  };
}

/** Theme by id; unknown ids fall back to the default. */
export function getTheme(id: string | null | undefined): Theme {
  return buildTheme(EVENTS.find((e) => e.id === id));
}

/** Ids a visitor may ask for with `?theme=`. */
export const THEME_IDS: string[] = ['default', ...EVENTS.map((e) => e.id)];

/** What the admin dashboard may change about one event. */
export interface EventSchedule { enabled: boolean; from: string; to: string }

/** The dates an event runs on: the dashboard's override when it has one, else
 *  the event's own window. `null` = never starts by date. */
export function windowOf(e: EventTheme, schedule?: EventSchedule): { from: string; to: string } | null {
  if (schedule?.from && schedule?.to) return { from: schedule.from, to: schedule.to };
  return e.window ?? null;
}

/** The event running on `date` (`YYYY-MM-DD`), if any. Events switched off in
 *  `schedules` never run. */
export function eventOn(date: string, schedules: Record<string, EventSchedule> = {}): EventTheme | undefined {
  return EVENTS.find((e) => {
    const s = schedules[e.id];
    if (s && !s.enabled) return false;
    const w = windowOf(e, s);
    return !!w && date >= w.from && date <= w.to;
  });
}
