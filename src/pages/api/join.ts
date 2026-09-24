import type { APIRoute } from 'astro';
import {
  withGame,
  generateToken,
  isOnline,
  getPlayerToken,
  setPlayerCookie,
} from '../../lib/game.js';

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const code = (body.code ?? '').trim();
  let name = (body.name ?? '').trim();

  if (!code) {
    return new Response(JSON.stringify({ error: 'Missing code' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!name) {
    return new Response(JSON.stringify({ error: 'Missing name' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (name.length > 30) name = name.slice(0, 30);

  const existingToken = getPlayerToken(request);

  let resultData: { token: string; name: string; code: string } | null = null;

  const outcome = await withGame(code, (game) => {
    if (game.state !== 'lobby') {
      // Allow rejoin if already a player (handles reload during play)
      if (existingToken && game.players[existingToken]) {
        game.players[existingToken].last_seen = Math.floor(Date.now() / 1000);
        resultData = {
          token: existingToken,
          name: game.players[existingToken].name,
          code: game.code,
        };
        return { game, result: resultData };
      }
      return { result: { error: 'Game already started', code: 409 }, noWrite: true };
    }

    // Existing token already in this game — update name + last_seen
    if (existingToken && game.players[existingToken]) {
      game.players[existingToken].last_seen = Math.floor(Date.now() / 1000);
      game.players[existingToken].name = name;
      resultData = { token: existingToken, name, code: game.code };
      return { game, result: resultData };
    }

    // New device, but a name already in the lobby. If that player has gone
    // quiet (closed the tab, phone locked) this is them coming back on a new
    // device, so hand them their seat instead of minting a ghost player.
    //
    // Never when that player is the host, and never while they're still
    // online: then it's a second person with the same name, e.g. someone
    // scanning the QR on the wall and typing the host's name. Merging used to
    // hand them the host's identity, host controls and all. They get a
    // numbered name instead ("Ali 2").
    const nameKey = name.toLowerCase();
    const existingEntry = Object.entries(game.players).find(
      ([, p]) => p.name.toLowerCase() === nameKey
    );
    if (existingEntry) {
      const [existingToken, existingPlayer] = existingEntry;
      const now = Math.floor(Date.now() / 1000);
      const reclaimable = existingToken !== game.creator_token && !isOnline(existingPlayer, now);
      if (reclaimable) {
        existingPlayer.last_seen = now;
        existingPlayer.name = name;
        resultData = { token: existingToken, name, code: game.code };
        return { game, result: resultData };
      }
      const taken = new Set(Object.values(game.players).map((p) => p.name.toLowerCase()));
      for (let n = 2; n < 100; n++) {
        const suffix = ` ${n}`;
        const candidate = name.slice(0, 30 - suffix.length) + suffix;
        if (!taken.has(candidate.toLowerCase())) { name = candidate; break; }
      }
    }

    const token = generateToken();
    game.players[token] = {
      name,
      last_seen: Math.floor(Date.now() / 1000),
      straw_index: null,
    };
    if (!game.creator_token) {
      game.creator_token = token;
    }
    resultData = { token, name, code: game.code };
    return { game, result: resultData };
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

  const data = resultData!;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', setPlayerCookie(data.token));

  return new Response(JSON.stringify(data), { status: 200, headers });
};
