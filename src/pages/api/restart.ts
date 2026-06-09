import type { APIRoute } from 'astro';
import { withGame, getPlayerToken } from '../../lib/game.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();
  const token = getPlayerToken(request);

  if (!code || !token) {
    return new Response(JSON.stringify({ error: 'Missing code or token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const outcome = await withGame(code, (game) => {
    if (game.creator_token !== token) {
      return { result: { error: 'Host only', code: 403 }, noWrite: true };
    }
    if (game.state === 'lobby') {
      return { result: { error: 'Already in lobby', code: 400 }, noWrite: true };
    }

    game.state = 'lobby';
    game.straws = null;
    game.winner_token = null;
    game.prize_snack = null;
    game.prize_given_id = null;
    game.prize_given_name = null;

    for (const t of Object.keys(game.players)) {
      game.players[t].straw_index = null;
    }

    return { game, result: { ok: true } };
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

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
