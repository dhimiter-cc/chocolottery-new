import type { APIRoute } from 'astro';
import {
  loadGame,
  withGame,
  sanitiseState,
  cleanupOldGames,
  getPlayerToken,
} from '../../lib/game.js';

let requestCounter = 0;

export const GET: APIRoute = async ({ request, url }) => {
  requestCounter++;
  if (requestCounter % 10 === 0) {
    cleanupOldGames();
  }

  const code = (url.searchParams.get('code') ?? '').trim();
  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let game = await loadGame(code);
  if (!game) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const myToken = getPlayerToken(request);
  const now = Math.floor(Date.now() / 1000);

  // Piggyback a last_seen refresh — fallback heartbeat for mobile browsers that
  // throttle background timers. Only write when stale (>8s) to keep lock contention low.
  if (
    myToken &&
    game.players[myToken] &&
    (game.state === 'lobby' || game.state === 'picking') &&
    now - (game.players[myToken].last_seen ?? 0) > 8
  ) {
    const updated = await withGame(code, (g) => {
      if (!g.players[myToken]) return { result: null, noWrite: true };
      g.players[myToken].last_seen = now;
      return { game: g, result: g };
    });
    if (updated && typeof updated === 'object' && 'players' in updated) {
      game = updated as typeof game;
    }
  }

  return new Response(JSON.stringify(sanitiseState(game, myToken)), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
