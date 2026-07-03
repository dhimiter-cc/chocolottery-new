import type { APIRoute } from 'astro';
import { withGame, beginPicking } from '../../lib/game.js';

type AutostartResult = { ok: true; started: boolean };

// Lobby timer expiry. Any client whose lobby countdown hit zero can call this;
// it's idempotent — it only acts while the game is still in `lobby`, the
// deadline has passed, and at least 2 players are online. Deliberately NOT
// host-gated so the round still starts even if the host has wandered off.
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const outcome = await withGame<AutostartResult>(code, (game) => {
    const now = Math.floor(Date.now() / 1000);
    const due =
      game.state === 'lobby' &&
      game.lobby_deadline != null &&
      now >= game.lobby_deadline;

    if (!due) {
      return { result: { ok: true, started: false }, noWrite: true };
    }

    // beginPicking bails (mutating nothing) if fewer than 2 are online, so a
    // near-empty lobby just keeps waiting rather than starting a dud round.
    if (!beginPicking(game)) {
      return { result: { ok: true, started: false }, noWrite: true };
    }

    return { game, result: { ok: true, started: true } };
  });

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
