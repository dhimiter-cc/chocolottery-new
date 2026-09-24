import type { APIRoute } from 'astro';
import { withGame, getPlayerToken } from '../../lib/game.js';
import type { GameStyle } from '../../lib/types.js';

// Host-only, lobby-only: play this round with straws or chocolate bars. Kept
// on the game (not global) so flipping it never changes a round mid-draw.

const STYLES: GameStyle[] = ['straws', 'bars'];

type StyleResult = { ok: true } | { error: string; code: number };

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();
  const style = body.style as GameStyle;
  const token = getPlayerToken(request);

  if (!code || !token) return json({ error: 'Missing code or token' }, 400);
  if (!STYLES.includes(style)) return json({ error: 'Unknown style' }, 400);

  const outcome = await withGame<StyleResult>(code, (game) => {
    if (game.creator_token !== token) {
      return { result: { error: 'Host only', code: 403 }, noWrite: true };
    }
    if (game.state !== 'lobby') {
      return { result: { error: 'Only between rounds', code: 409 }, noWrite: true };
    }
    game.style = style;
    return { game, result: { ok: true } };
  });

  if (outcome === null) return json({ error: 'Game not found' }, 404);
  if ('error' in outcome) return json({ error: outcome.error }, outcome.code);
  return json(outcome, 200);
};
