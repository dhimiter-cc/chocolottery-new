// Shared by lib/settings.ts (cleans on save) and the icon endpoint.

/** An uploaded prize icon, cleaned for display. Shown only through <img> or the
 *  icon endpoint (which forbids scripts), but scrubbed anyway: no scripts, no event
 *  handlers, no foreign content, no links out. Not an <svg>, or too big: none. */
export const MAX_ICON = 12_000;
export function cleanSvg(input: unknown): string {
  if (typeof input !== 'string') return '';
  let s = input.trim().replace(/^<\?xml[^>]*>\s*/i, '').replace(/<!DOCTYPE[^>]*>\s*/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  if (!/^<svg[\s>]/i.test(s) || s.length > MAX_ICON) return '';
  s = s
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*("(?!#)[^"]*"|'(?!#)[^']*')/gi, '');
  return s;
}
