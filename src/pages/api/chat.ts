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
    return new Response(JSON.stringify({ error: 'Empty message' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (text.length > 240) text = text.slice(0, 240);

  const outcome = await withGame(code, (game) => {
    if (!game.players[token]) {
      return { result: { error: 'Not in game', code: 403 }, noWrite: true };
    }

    if (!Array.isArray(game.chat)) game.chat = [];

    // Rate limit: max 1 message per 800ms per player
    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const last = game.players[token].last_chat_ms ?? 0;
    if (nowMs - last < 800) {
      return { result: { error: 'Slow down', code: 429 }, noWrite: true };
    }

    const name = game.players[token].name ?? 'Anon';
    game.chat.push({
      id: generateId(),
      token,
      name,
      text,
      ts: nowSec,
    });

    // Keep last 100 messages
    if (game.chat.length > 100) {
      game.chat = game.chat.slice(-100);
    }

    game.players[token].last_chat_ms = nowMs;
    game.players[token].last_seen = nowSec;

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
