import type { APIRoute } from 'astro';
import { adventStreet } from '../../../lib/adventStreet.js';

// The calendar street (lib/adventStreet.ts), for the reveal's calendar moment
// (AdventMorph.svelte). Public, like the /advent page it mirrors.
export const GET: APIRoute = () => {
  const street = adventStreet();
  if (!street) return Response.json({ error: 'No advent calendar', code: 'no_advent' }, { status: 404 });
  return Response.json(street, { headers: { 'Cache-Control': 'no-store' } });
};
