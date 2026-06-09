import type { APIRoute } from 'astro';
import {
  withGame,
  pickPrizeSnack,
  appendLeaderboard,
  getPlayerToken,
} from '../../lib/game.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();
  const strawIndex = body.straw_index !== undefined ? Number(body.straw_index) : -1;
  const token = getPlayerToken(request);

  if (!code || !token) {
    return new Response(JSON.stringify({ error: 'Missing code or token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let winRecord: Record<string, any> | null = null;

  const outcome = await withGame(code, (game) => {
    if (game.state !== 'picking') {
      return { result: { error: 'Game not picking', code: 409 }, noWrite: true };
    }
    if (!game.players[token]) {
      return { result: { error: 'Not in game', code: 403 }, noWrite: true };
    }
    if (game.players[token].straw_index !== null) {
      return { result: { error: 'Already picked', code: 409 }, noWrite: true };
    }
    if (!Array.isArray(game.straws)) {
      return { result: { error: 'No straws', code: 500 }, noWrite: true };
    }
    if (strawIndex < 0 || strawIndex >= game.straws.length) {
      return { result: { error: 'Bad straw index', code: 400 }, noWrite: true };
    }

    // Check straw not already taken
    for (const p of Object.values(game.players)) {
      if ((p as any).straw_index === strawIndex) {
        return { result: { error: 'Straw already taken', code: 409 }, noWrite: true };
      }
    }

    game.players[token].straw_index = strawIndex;
    game.players[token].last_seen = Math.floor(Date.now() / 1000);

    // Auto-pick: if exactly one player is left unpicked, there is only one straw
    // they could possibly take — assign it for them so the round resolves at once.
    const unpicked = Object.entries(game.players).filter(
      ([, p]) => (p as any).straw_index === null
    );
    if (unpicked.length === 1) {
      const taken = new Set(
        Object.values(game.players)
          .map((p: any) => p.straw_index)
          .filter((idx) => idx !== null)
      );
      for (let i = 0; i < game.straws.length; i++) {
        if (!taken.has(i)) {
          game.players[unpicked[0][0]].straw_index = i;
          break;
        }
      }
    }

    // Check if all players have picked
    const allPicked = Object.values(game.players).every(
      (p: any) => p.straw_index !== null
    );

    if (allPicked) {
      let winnerToken: string | null = null;
      for (const [t, p] of Object.entries(game.players)) {
        if (game.straws[(p as any).straw_index] === 100) {
          winnerToken = t;
          break;
        }
      }
      game.winner_token = winnerToken;
      game.state = 'reveal';
      game.prize_snack = pickPrizeSnack(game);

      if (winnerToken) {
        const playerNames = Object.values(game.players).map((p: any) => p.name);
        winRecord = {
          name: game.players[winnerToken].name,
          game_code: game.code,
          timestamp: Math.floor(Date.now() / 1000),
          month: new Date().toISOString().slice(0, 7),
          participants: Object.keys(game.players).length,
          player_names: playerNames,
          prize_snack: game.prize_snack?.text ?? null,
        };
      }
    }

    return { game, result: { ok: true } };
  });

  if (winRecord) {
    await appendLeaderboard(winRecord);
  }

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
