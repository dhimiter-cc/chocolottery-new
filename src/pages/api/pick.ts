import type { APIRoute } from 'astro';
import {
  withGame,
  finalizePicking,
  appendLeaderboard,
  getPlayerToken,
} from '../../lib/game.js';
import type { LeaderboardWin } from '../../lib/types.js';

type PickResult = { ok: true } | { error: string; code: number };

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

  let winRecord: LeaderboardWin | null = null;

  const outcome = await withGame<PickResult>(code, (game) => {
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
      if (p.straw_index === strawIndex) {
        return { result: { error: 'Straw already taken', code: 409 }, noWrite: true };
      }
    }

    game.players[token].straw_index = strawIndex;
    game.players[token].last_seen = Math.floor(Date.now() / 1000);

    // Auto-pick: if exactly one player is left unpicked, there is only one straw
    // they could possibly take — assign it for them so the round resolves at once.
    const unpicked = Object.entries(game.players).filter(
      ([, p]) => p.straw_index === null
    );
    if (unpicked.length === 1) {
      const taken = new Set(
        Object.values(game.players)
          .map((p) => p.straw_index)
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
      (p) => p.straw_index !== null
    );

    if (allPicked) {
      winRecord = finalizePicking(game);
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

  if ('error' in outcome) {
    return new Response(JSON.stringify({ error: outcome.error }), {
      status: outcome.code ?? 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
