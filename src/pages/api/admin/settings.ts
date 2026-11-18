import type { APIRoute } from 'astro';
import { isAdmin, adminAvailable } from '../../../lib/adminAuth.js';
import { getSettings, saveSettings, syncStatus, hydrateSettings } from '../../../lib/settings.js';
import { baseThemeId } from '../../../themes/resolve.js';

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

/** What the dashboard shows: the settings, how they are mirrored, and which
 *  theme visitors get right now. */
async function view() {
  await hydrateSettings();
  return { settings: getSettings(), sync: syncStatus(), activeTheme: baseThemeId() };
}

export const GET: APIRoute = async ({ request }) => {
  if (!adminAvailable()) return new Response(null, { status: 404 });
  if (!isAdmin(request)) return json({ error: 'Not signed in' }, 401);
  return json(await view());
};

export const POST: APIRoute = async ({ request }) => {
  if (!adminAvailable()) return new Response(null, { status: 404 });
  if (!isAdmin(request)) return json({ error: 'Not signed in' }, 401);

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ error: 'Bad settings' }, 400);

  const result = await saveSettings(body, 'admin');
  return json({ ...(await view()), changed: result.changed, remote: result.remote });
};
