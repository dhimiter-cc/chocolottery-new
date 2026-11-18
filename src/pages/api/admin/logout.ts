import type { APIRoute } from 'astro';
import { clearCookie } from '../../../lib/adminAuth.js';

export const POST: APIRoute = async ({ request }) =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearCookie(request) },
  });
