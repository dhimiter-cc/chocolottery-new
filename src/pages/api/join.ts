import type { APIRoute } from 'astro';
import {
  withGame,
  generateToken,
  getPlayerToken,
  setPlayerCookies,
} from '../../lib/game.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();
  let name = (body.name ?? '').trim();

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!name) {
    return new Response(JSON.stringify({ error: 'Missing name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (name.length > 30) name = name.slice(0, 30);

  const existingToken = getPlayerToken(request);

  let resultData: { token: string; name: string; code: string } | null = null;

  const outcome = await withGame(code, (game) => {
    if (game.state !== 'lobby') {
      // Allow rejoin if already a player (handles reload during play)
      if (existingToken && game.players[existingToken]) {
        game.players[existingToken].last_seen = Math.floor(Date.now() / 1000);
        resultData = {
          token: existingToken,
          name: game.players[existingToken].name,
          code: game.code,
        };
        return { game, result: resultData };
      }
      return { result: { error: 'Game already started', code: 409 }, noWrite: true };
    }

    // Existing token already in this game — update name + last_seen
    if (existingToken && game.players[existingToken]) {
      game.players[existingToken].last_seen = Math.floor(Date.now() / 1000);
      game.players[existingToken].name = name;
      resultData = { token: existingToken, name, code: game.code };
      return { game, result: resultData };
    }

    // New player
    const token = generateToken();
    game.players[token] = {
      name,
      last_seen: Math.floor(Date.now() / 1000),
      straw_index: null,
    };
    if (!game.creator_token) {
      game.creator_token = token;
    }
    resultData = { token, name, code: game.code };
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

  const data = resultData!;
  const cookieStrings = setPlayerCookies(data.token, data.name);
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const c of cookieStrings) headers.append('Set-Cookie', c);

  return new Response(JSON.stringify(data), { status: 200, headers });
};
