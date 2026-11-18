// Server-side: which theme does this request get? Resolved once per page and
// written to <html data-theme>, so the first paint is already themed and the
// server render and the hydrated client never disagree.
//
// Order, first match wins:
//   1. ?theme=<id>       preview, kept in a session cookie for the tab's navigation
//      (only for themes that are switched on; `&embed` previews any theme without
//      the cookie, which is what the admin dashboard's thumbnails use)
//      ?theme=auto       drop that preview and go back to the schedule
//   2. the preview cookie
//   3. the admin setting `theme`, when it is not 'auto' (lib/settings.ts)
//   4. THEME env var     the ops override: `THEME=halloween` or `THEME=default`
//   5. an event's date window (Europe/Amsterdam, where the office is), unless the
//      dashboard switched that event off or moved its dates
//   6. the default theme

import type { AstroCookies } from 'astro';
import { THEME_IDS, eventOn, getTheme, type Theme } from './index.js';
import { getSettings } from '../lib/settings.js';

const COOKIE = 'theme_preview';
const TZ = 'Europe/Amsterdam';

/** `YYYY-MM-DD` in the office's timezone, whatever zone the server runs in. */
export function officeDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Is this theme one visitors may preview with `?theme=`? */
function previewable(id: string): boolean {
  return id === 'default' || (THEME_IDS.includes(id) && getSettings().events[id]?.enabled !== false);
}

/** The theme everyone gets when nobody asked for a preview: the admin setting,
 *  then the env override, then the calendar. */
export function baseThemeId(now: Date = new Date()): string {
  const set = getSettings();
  if (set.theme !== 'auto' && THEME_IDS.includes(set.theme)) return set.theme;

  const forced = process.env.THEME?.trim();
  if (forced && THEME_IDS.includes(forced)) return forced;

  return eventOn(officeDate(now), set.events)?.id ?? 'default';
}

export function resolveThemeId(url: URL, cookies: AstroCookies, now: Date = new Date()): string {
  const asked = url.searchParams.get('theme');
  if (asked === 'auto') {
    cookies.delete(COOKIE, { path: '/' });
  } else if (asked && THEME_IDS.includes(asked)) {
    if (url.searchParams.has('embed')) return asked;
    if (previewable(asked)) {
      cookies.set(COOKIE, asked, { path: '/', sameSite: 'lax' });
      return asked;
    }
  }

  const saved = cookies.get(COOKIE)?.value;
  if (asked !== 'auto' && saved && previewable(saved)) return saved;

  return baseThemeId(now);
}

/** What every page calls in its frontmatter: `const theme = themeFor(Astro);`
 *  then `<html data-theme={theme.id}>` and `<ThemeDecor id={theme.id} />`. */
export function themeFor(astro: { url: URL; cookies: AstroCookies }): Theme {
  return getTheme(resolveThemeId(astro.url, astro.cookies));
}
