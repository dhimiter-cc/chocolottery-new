import type { APIRoute } from 'astro';
import { generateGameCode, saveGame } from '../../lib/game.js';
import type { Game } from '../../lib/types.js';

export const POST: APIRoute = async ({ request }) => {
  console.log('[api/create] POST called');
  console.log('[api/create] method:', request.method);
  console.log('[api/create] headers:', Object.fromEntries(request.headers.entries()));

  try {
    const code = generateGameCode();
    if (!code) {
      const response = new Response(JSON.stringify({ error: 'Could not generate game code' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
      console.log('[api/create] responding 500 — could not generate game code');
      return response;
    }

    const game: Game = {
      code,
      state: 'lobby',
      created_at: Math.floor(Date.now() / 1000),
      players: {},
      straws: null,
      winner_token: null,
      creator_token: null,
      suggestions: [],
      prize_snack: null,
      prize_given_id: null,
      prize_given_name: null,
      chat: [],
    };

    await saveGame(game);

    const response = new Response(JSON.stringify({ code }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('[api/create] responding 200 with code:', code);
    return response;
  } catch (err) {
    console.error('[api/create] unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
