import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/auth.js';

export const GET: APIRoute = async () => {
  const headers = new Headers({ Location: '/login' });
  headers.append('Set-Cookie', clearSessionCookie());
  return new Response(null, { status: 302, headers });
};
