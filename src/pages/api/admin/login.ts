import type { APIRoute } from 'astro';
import { adminAvailable, checkPassword, sessionCookie, loginLocked, noteMiss, clearMisses } from '../../../lib/adminAuth.js';

const json = (payload: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export const POST: APIRoute = async ({ request }) => {
  if (!adminAvailable()) return new Response(null, { status: 404 });
  if (loginLocked()) return json({ error: 'Too many tries. Wait a minute.' }, 429);

  const body = await request.json().catch(() => ({}));
  if (!checkPassword(body?.password)) {
    noteMiss();
    return json({ error: 'Wrong password.' }, 401);
  }
  clearMisses();
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(request) });
};
