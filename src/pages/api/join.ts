import type { APIRoute } from 'astro';
import {
  withGame,
  getPlayerToken,
  getPlayerName,
} from '../../lib/game.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const code = (body.code ?? '').trim();

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Identity comes from the signed Entra session (enforced by middleware).
  const token = getPlayerToken(request);
  let name = getPlayerName(request);
  if (!token || !name) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (name.length > 30) name = name.slice(0, 30);

  let resultData: { token: string; name: string; code: string } | null = null;

  const outcome = await withGame(code, (game) => {
    const now = Math.floor(Date.now() / 1000);

    // Already a player in this game — refresh name + last_seen (handles reload,
    // rejoin during play, and Entra display-name changes).
    if (game.players[token]) {
      game.players[token].last_seen = now;
      game.players[token].name = name!;
      resultData = { token, name: name!, code: game.code };
      return { game, result: resultData };
    }

    // New players may only join during the lobby.
    if (game.state !== 'lobby') {
      return { result: { error: 'Game already started', code: 409 }, noWrite: true };
    }

    game.players[token] = {
      name: name!,
      last_seen: now,
      straw_index: null,
    };
    if (!game.creator_token) {
      game.creator_token = token;
    }
    resultData = { token, name: name!, code: game.code };
    return { game, result: resultData };
  });

  if (outcome === null) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (outcome && typeof outcome === 'object' && 'error' in outcome) {
    return new Response(JSON.stringify({ error: (outcome as any).error }), {
      status: (outcome as any).code ?? 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(resultData), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
