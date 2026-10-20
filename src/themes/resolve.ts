// Server-side: which theme does this request get? Resolved once per page and
// written to <html data-theme>, so the first paint is already themed and the
// server render and the hydrated client never disagree.
//
// Order, first match wins:
//   1. ?theme=<id>       preview, kept in a session cookie for the tab's navigation
//      ?theme=auto       drop that preview and go back to the schedule
//   2. the preview cookie
//   3. THEME env var     the ops override: `THEME=halloween` or `THEME=default`
//   4. an event's date window (Europe/Amsterdam, where the office is)
//   5. the default theme

import type { AstroCookies } from 'astro';
import { THEME_IDS, eventOn, getTheme, type Theme } from './index.js';

const COOKIE = 'theme_preview';
const TZ = 'Europe/Amsterdam';

/** `YYYY-MM-DD` in the office's timezone, whatever zone the server runs in. */
export function officeDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function resolveThemeId(url: URL, cookies: AstroCookies, now: Date = new Date()): string {
  const asked = url.searchParams.get('theme');
  if (asked === 'auto') {
    cookies.delete(COOKIE, { path: '/' });
  } else if (asked && THEME_IDS.includes(asked)) {
    cookies.set(COOKIE, asked, { path: '/', sameSite: 'lax' });
    return asked;
  }

  const saved = cookies.get(COOKIE)?.value;
  if (asked !== 'auto' && saved && THEME_IDS.includes(saved)) return saved;

  const forced = process.env.THEME?.trim();
  if (forced && THEME_IDS.includes(forced)) return forced;

  return eventOn(officeDate(now))?.id ?? 'default';
}

/** What every page calls in its frontmatter: `const theme = themeFor(Astro);`
 *  then `<html data-theme={theme.id}>` and `<ThemeDecor id={theme.id} />`. */
export function themeFor(astro: { url: URL; cookies: AstroCookies }): Theme {
  return getTheme(resolveThemeId(astro.url, astro.cookies));
}
