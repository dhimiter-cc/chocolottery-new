import type { APIRoute } from 'astro';
import { withGame, getPlayerToken } from '../../lib/game.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();
  const id = (body.id ?? '').trim();
  const token = getPlayerToken(request);

  if (!code || !token) {
    return new Response(JSON.stringify({ error: 'Missing code or token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing suggestion id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const outcome = await withGame(code, (game) => {
    if (!game.players[token]) {
      return { result: { error: 'Not in game', code: 403 }, noWrite: true };
    }
    if (!Array.isArray(game.suggestions)) {
      return { result: { error: 'No suggestions', code: 404 }, noWrite: true };
    }

    let found = false;
    for (const s of game.suggestions) {
      if (s.id === id) {
        found = true;
        const votes: string[] = Array.isArray(s.votes) ? s.votes : [];
        const idx = votes.indexOf(token);
        if (idx === -1) {
          votes.push(token);
        } else {
          votes.splice(idx, 1);
        }
        s.votes = votes;
        break;
      }
    }

    if (!found) {
      return { result: { error: 'Suggestion not found', code: 404 }, noWrite: true };
    }

    return { game, result: { ok: true } };
  });

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
