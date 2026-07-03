import type { APIRoute } from 'astro';
import { generateGameCode, saveGame } from '../../lib/game.js';
import type { Game } from '../../lib/types.js';

export const POST: APIRoute = async ({ request }) => {
  console.log('[api/create] POST called');
  console.log('[api/create] method:', request.method);
  console.log('[api/create] headers:', Object.fromEntries(request.headers.entries()));

  try {
    // Optional lobby wait duration (seconds): after this the round auto-starts
    // so we don't wait all day for people to join. Absent / invalid → no timer.
    let timerSeconds: number | null = null;
    try {
      const body = await request.json();
      const raw = Number(body?.timer_seconds);
      if (Number.isFinite(raw) && raw > 0) timerSeconds = Math.min(3600, Math.floor(raw));
    } catch { /* no body — no timer */ }

    const createdAt = Math.floor(Date.now() / 1000);
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
      created_at: createdAt,
      players: {},
      straws: null,
      winner_token: null,
      creator_token: null,
      suggestions: [],
      prize_snack: null,
      prize_given_id: null,
      prize_given_name: null,
      chat: [],
      timer_seconds: timerSeconds,
      lobby_deadline: timerSeconds ? createdAt + timerSeconds : null,
      picking_deadline: null,
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
