import type { APIRoute } from 'astro';
import {
  withGame,
  isOnline,
  generateStraws,
  getPlayerToken,
} from '../../lib/game.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = getPlayerToken(request);

  const outcome = await withGame(code, (game) => {
    if (game.state !== 'lobby') {
      return { result: { error: 'Game not in lobby', code: 409 }, noWrite: true };
    }
    if (game.creator_token && game.creator_token !== token) {
      return { result: { error: 'Only the host can start', code: 403 }, noWrite: true };
    }

    const now = Math.floor(Date.now() / 1000);
    const online: Record<string, any> = {};
    for (const [t, p] of Object.entries(game.players)) {
      if (isOnline(p, now)) {
        online[t] = p;
      }
    }

    if (Object.keys(online).length < 2) {
      return { result: { error: 'Need at least 2 online players', code: 400 }, noWrite: true };
    }

    for (const t of Object.keys(online)) {
      online[t].straw_index = null;
    }

    game.players = online;
    game.straws = generateStraws(Object.keys(online).length);
    game.state = 'picking';
    game.winner_token = null;

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
