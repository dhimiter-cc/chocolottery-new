import type { APIRoute } from 'astro';
import { withGame, getPlayerToken } from '../../lib/game.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();
  const token = getPlayerToken(request);

  if (code && token) {
    await withGame(code, (game) => {
      if (!game.players[token]) return { result: null, noWrite: true };
      game.players[token].last_seen = Math.floor(Date.now() / 1000);
      return { game, result: true };
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
