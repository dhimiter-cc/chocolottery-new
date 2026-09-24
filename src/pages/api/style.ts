import type { APIRoute } from 'astro';
import { withGame, getPlayerToken } from '../../lib/game.js';
import type { GameStyle } from '../../lib/types.js';

// Host-only, lobby-only round settings: straws or chocolate bars (`style`),
// and whether the host is in the draw (`host_plays`). Either or both may be
// sent. Kept on the game (not global) so a change never lands mid-draw.

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
  const style = body.style as GameStyle | undefined;
  const hostPlays = body.host_plays as boolean | undefined;
  const token = getPlayerToken(request);

  if (!code || !token) return json({ error: 'Missing code or token' }, 400);
  if (style === undefined && hostPlays === undefined) return json({ error: 'Nothing to change' }, 400);
  if (style !== undefined && !STYLES.includes(style)) return json({ error: 'Unknown style' }, 400);
  if (hostPlays !== undefined && typeof hostPlays !== 'boolean') return json({ error: 'Bad host_plays' }, 400);

  const outcome = await withGame<StyleResult>(code, (game) => {
    if (game.creator_token !== token) {
      return { result: { error: 'Host only', code: 403 }, noWrite: true };
    }
    if (game.state !== 'lobby') {
      return { result: { error: 'Only between rounds', code: 409 }, noWrite: true };
    }
    if (style !== undefined) game.style = style;
    if (hostPlays !== undefined) game.host_plays = hostPlays;
    return { game, result: { ok: true } };
  });

  if (outcome === null) return json({ error: 'Game not found' }, 404);
  if ('error' in outcome) return json({ error: outcome.error }, outcome.code);
  return json(outcome, 200);
};
