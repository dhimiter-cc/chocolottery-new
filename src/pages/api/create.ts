import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { generateGameCode } from '../../lib/game.js';

export const POST: APIRoute = async () => {
  const code = generateGameCode();
  if (!code) {
    return new Response(JSON.stringify({ error: 'Could not generate game code' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const game = {
    code,
    state: 'lobby',
    created_at: Math.floor(Date.now() / 1000),
    players: {},
    straws: null,
    winner_token: null,
    creator_token: null,
    suggestions: [],
    chat: [],
  };

  const gamesDir = path.join(path.resolve('data/games'));
  fs.writeFileSync(path.join(gamesDir, `${code}.json`), JSON.stringify(game));

  return new Response(JSON.stringify({ code }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
