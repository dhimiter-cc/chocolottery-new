import type { APIRoute } from 'astro';
import { getSettings } from '../../../lib/settings.js';
import { cleanSvg } from '../../../lib/svgClean.js';

// A door's prize icon, uploaded in /admin. Cleaned again on the way out, and sent
// with a policy that forbids scripts and loading anything, so even opened on its
// own in a tab it can only draw.
export const GET: APIRoute = ({ params }) => {
  const door = Number(params.door);
  const svg = Number.isInteger(door) ? cleanSvg(getSettings().advent.prizes[String(door)]?.svg) : '';
  if (!svg) return new Response(null, { status: 404 });
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  });
};
