import type { APIRoute } from 'astro';
import {
  withGame,
  assignRemainingStraws,
  afterAllPicked,
  openAllBars,
  appendLeaderboard,
  getPlayerToken,
} from '../../lib/game.js';
import type { LeaderboardWin } from '../../lib/types.js';

type ResolveResult = { ok: true } | { error: string; code: number };

// Host-only escape hatch. Picking has no auto-timer — everyone who joined the
// lobby stays in the round and picks on their own schedule — so if someone
// genuinely goes AFK this is the only way the round ever finishes. Unpicked
// players get a random remaining straw, same as the old timer-driven path did.
//
// Bar mode has a second place to get stuck: everyone has a bar but the golden
// one's holder never opens it. Resolving during `unwrapping` opens them all.
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

  let winRecord: LeaderboardWin | null = null;

  const outcome = await withGame<ResolveResult>(code, (game) => {
    if (game.state !== 'picking' && game.state !== 'unwrapping') {
      return { result: { error: 'Nothing to resolve', code: 409 }, noWrite: true };
    }
    if (game.creator_token && game.creator_token !== token) {
      return { result: { error: 'Only the host can force a resolve', code: 403 }, noWrite: true };
    }

    if (game.state === 'unwrapping') {
      winRecord = openAllBars(game);
    } else {
      assignRemainingStraws(game);
      winRecord = afterAllPicked(game);
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

  return new Response(JSON.stringify(outcome), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
