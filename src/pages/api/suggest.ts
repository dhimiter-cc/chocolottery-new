import type { APIRoute } from 'astro';
import { withGame, generateId, getPlayerToken } from '../../lib/game.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();
  let text = (body.text ?? '').trim();
  const token = getPlayerToken(request);

  if (!code || !token) {
    return new Response(JSON.stringify({ error: 'Missing code or token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!text) {
    return new Response(JSON.stringify({ error: 'Suggestion is empty' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (text.length > 80) text = text.slice(0, 80);

  const outcome = await withGame(code, (game) => {
    if (!game.players[token]) {
      return { result: { error: 'Not in game', code: 403 }, noWrite: true };
    }

    if (!Array.isArray(game.suggestions)) {
      game.suggestions = [];
    }

    // Deduplicate by lowercase text
    const needle = text.toLowerCase();
    for (const s of game.suggestions) {
      if (s.text.toLowerCase() === needle) {
        return { result: { error: 'Already suggested', code: 409 }, noWrite: true };
      }
    }

    if (game.suggestions.length >= 50) {
      return { result: { error: 'Too many suggestions, slow down', code: 429 }, noWrite: true };
    }

    const id = generateId();
    const author = game.players[token].name ?? 'Anon';

    game.suggestions.push({
      id,
      text,
      author_token: token,
      author_name: author,
      votes: [token], // auto-vote own suggestion
      created_at: Math.floor(Date.now() / 1000),
    });

    return { game, result: { ok: true, id } };
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

  return new Response(JSON.stringify(outcome), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
