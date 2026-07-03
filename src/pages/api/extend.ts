import type { APIRoute } from 'astro';
import { withGame, getPlayerToken } from '../../lib/game.js';

type ExtendResult = { ok: true; lobby_deadline: number } | { error: string; code: number };

const EXTEND_SECONDS = 30;

// Host-only: push the lobby auto-start deadline back by 30 seconds when players
// are still trickling in. No-op'd for games without a lobby timer.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();
  const token = getPlayerToken(request);

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const outcome = await withGame<ExtendResult>(code, (game) => {
    if (game.state !== 'lobby') {
      return { result: { error: 'Game not in lobby', code: 409 }, noWrite: true };
    }
    if (game.creator_token && game.creator_token !== token) {
      return { result: { error: 'Only the host can extend', code: 403 }, noWrite: true };
    }
    if (game.lobby_deadline == null) {
      return { result: { error: 'This game has no timer', code: 400 }, noWrite: true };
    }
    game.lobby_deadline += EXTEND_SECONDS;
    return { game, result: { ok: true, lobby_deadline: game.lobby_deadline } };
  });

  if (outcome === null) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if ('error' in outcome) {
    return new Response(JSON.stringify({ error: outcome.error }), {
      status: outcome.code ?? 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(outcome), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
