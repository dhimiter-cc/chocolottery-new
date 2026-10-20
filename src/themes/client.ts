// Browser-side access to the active theme. The server already wrote its id to
// <html data-theme> (resolve.ts), so this just looks it up. Server-rendering
// and unknown ids both give the default theme, which is also what the
// components' first server render assumes.

import { getTheme, type Theme } from './index.js';

const cache = new Map<string, Theme>();

export function currentTheme(): Theme {
  const id = typeof document !== 'undefined' ? (document.documentElement.dataset.theme ?? 'default') : 'default';
  let theme = cache.get(id);
  if (!theme) {
    theme = getTheme(id);
    cache.set(id, theme);
  }
  return theme;
}
