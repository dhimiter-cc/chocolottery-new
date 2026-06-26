import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/auth.js';

// Paths reachable without a session: the login page and the auth round-trip.
const PUBLIC_PATHS = new Set<string>(['/login']);
const PUBLIC_PREFIXES = ['/api/auth/'];

// Static asset extensions served without gating (harmless CSS/JS/fonts/images).
const ASSET_RE = /\.(css|js|mjs|map|svg|ico|png|jpe?g|gif|webp|woff2?|ttf|txt|json)$/i;

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/_astro/') ||
    pathname.startsWith('/_image') ||
    ASSET_RE.test(pathname);

  if (isPublic) return next();

  const session = getSession(context.request);
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const returnTo = pathname + context.url.search;
    return context.redirect('/login?return_to=' + encodeURIComponent(returnTo));
  }

  context.locals.session = session;
  return next();
});
