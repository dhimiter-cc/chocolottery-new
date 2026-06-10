import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import {
  loadGame,
  sanitiseState,
  cleanupOldGames,
  getPlayerToken,
} from '../../lib/game.js';

let requestCounter = 0;

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, url }) => {
  requestCounter++;
  if (requestCounter % 10 === 0) {
    void cleanupOldGames(); // fire-and-forget; self-contained try/catch inside
  }

  const code = (url.searchParams.get('code') ?? '').trim();
  if (!code) return json({ error: 'Missing code' }, 400);

  const game = await loadGame(code);
  if (!game) return json({ error: 'Game not found' }, 404);

  const myToken = getPlayerToken(request);

  // last_seen is now refreshed solely by POST /api/heartbeat (every 5s, well
  // within the 30s online threshold). Keeping this GET read-only lets it be
  // cached: we hash the exact response and answer 304 when nothing changed.
  const body = JSON.stringify(sanitiseState(game, myToken));
  const etag = '"' + createHash('sha1').update(body).digest('base64') + '"';

  if (request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ETag: etag,
      'Cache-Control': 'no-cache',
    },
  });
};
