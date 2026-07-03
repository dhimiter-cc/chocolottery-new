import type { APIRoute } from 'astro';
import {
  withGame,
  beginPicking,
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

    if (!beginPicking(game)) {
      return { result: { error: 'Need at least 2 online players', code: 400 }, noWrite: true };
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
