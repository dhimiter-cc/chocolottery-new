import type { APIRoute } from 'astro';
import {
  withGame,
  finalizePicking,
  appendLeaderboard,
  getPlayerToken,
} from '../../lib/game.js';
import { UNWRAP_STEPS } from '../../lib/bars.js';
import type { LeaderboardWin } from '../../lib/types.js';

// Bar mode: a player reports how far they've torn their bar open.
//
// Progress only ever moves forward, so a late or duplicated request is a
// harmless no-op. What's inside is decided by the draw (`game.straws`) and is
// only told to the player once they reach the last step. If that bar is the
// golden one, the round ends right here: the win is recorded and every other
// screen flips to the reveal on its next poll.

type UnwrapResult =
  | { ok: true; step: number; golden?: boolean }
  | { error: string; code: number };

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();
  const token = getPlayerToken(request);
  const raw = Number(body.step);

  if (!code || !token) return json({ error: 'Missing code or token' }, 400);
  if (!Number.isFinite(raw)) return json({ error: 'Bad step' }, 400);
  const step = Math.max(0, Math.min(UNWRAP_STEPS, Math.floor(raw)));

  let winRecord: LeaderboardWin | null = null;

  const outcome = await withGame<UnwrapResult>(code, (game) => {
    if (game.state !== 'unwrapping') {
      return { result: { error: 'Not unwrapping', code: 409 }, noWrite: true };
    }
    const player = game.players[token];
    if (!player) {
      return { result: { error: 'Not in game', code: 403 }, noWrite: true };
    }
    if (player.straw_index === null || !Array.isArray(game.straws)) {
      return { result: { error: 'No bar', code: 409 }, noWrite: true };
    }

    const current = player.unwrap ?? 0;
    if (step <= current) {
      const done = current >= UNWRAP_STEPS;
      return {
        result: done
          ? { ok: true, step: current, golden: game.straws[player.straw_index] === 100 }
          : { ok: true, step: current },
        noWrite: true,
      };
    }

    player.unwrap = step;
    player.last_seen = Math.floor(Date.now() / 1000);

    if (step < UNWRAP_STEPS) return { game, result: { ok: true, step } };

    const golden = game.straws[player.straw_index] === 100;
    if (golden) winRecord = finalizePicking(game);
    return { game, result: { ok: true, step, golden } };
  });

  if (winRecord) await appendLeaderboard(winRecord);

  if (outcome === null) return json({ error: 'Game not found' }, 404);
  if ('error' in outcome) return json({ error: outcome.error }, outcome.code);
  return json(outcome, 200);
};
