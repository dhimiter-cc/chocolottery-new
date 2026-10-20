import type { APIRoute } from 'astro';
import { withGame, generateId, getPlayerToken } from '../../lib/game.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const code = (body.code ?? '').trim();
  let text = (body.text ?? '').trim();
  // Trick or treat: the same endpoint also takes trick suggestions.
  const isTrick = body.kind === 'trick';
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
  const maxLen = isTrick ? 100 : 80;
  if (text.length > maxLen) text = text.slice(0, maxLen);

  const outcome = await withGame(code, (game) => {
    if (!game.players[token]) {
      return { result: { error: 'Not in game', code: 403 }, noWrite: true };
    }

    if (isTrick) {
      if (!Array.isArray(game.tricks)) game.tricks = [];
    } else if (!Array.isArray(game.suggestions)) {
      game.suggestions = [];
    }
    const list = isTrick ? game.tricks! : game.suggestions;

    // Deduplicate by lowercase text
    const needle = text.toLowerCase();
    for (const s of list) {
      if (s.text.toLowerCase() === needle) {
        return { result: { error: 'Already suggested', code: 409 }, noWrite: true };
      }
    }

    if (list.length >= 50) {
      return { result: { error: 'Too many suggestions, slow down', code: 429 }, noWrite: true };
    }

    const id = generateId();
    const author = game.players[token].name ?? 'Anon';

    list.push({
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
