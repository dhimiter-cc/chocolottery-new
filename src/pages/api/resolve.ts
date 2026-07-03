import type { APIRoute } from 'astro';
import {
  withGame,
  assignRemainingStraws,
  finalizePicking,
  appendLeaderboard,
} from '../../lib/game.js';
import type { LeaderboardWin } from '../../lib/types.js';

type ResolveResult = { ok: true; resolved: boolean };

// Timer expiry. Any client whose countdown hit zero can call this; it's
// idempotent — it only does anything while the game is still `picking` and the
// deadline has actually passed, so concurrent calls (or clock skew) are safe.
// Unpicked players get a random remaining straw, then the round resolves like
// a normal all-picked finish. Deliberately NOT host-gated, so the round still
// ends even if the host has left.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let winRecord: LeaderboardWin | null = null;

  const outcome = await withGame<ResolveResult>(code, (game) => {
    const now = Math.floor(Date.now() / 1000);
    const expired =
      game.state === 'picking' &&
      game.picking_deadline != null &&
      now >= game.picking_deadline &&
      Array.isArray(game.straws);

    if (!expired) {
      return { result: { ok: true, resolved: false }, noWrite: true };
    }

    assignRemainingStraws(game);
    winRecord = finalizePicking(game);
    return { game, result: { ok: true, resolved: true } };
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

  return new Response(JSON.stringify(outcome), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
