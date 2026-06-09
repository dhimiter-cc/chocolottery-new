import type { APIRoute } from 'astro';
import {
  withGame,
  withCupboard,
  cupboardPublic,
  generateId,
  getPlayerToken,
} from '../../lib/game.js';

export const GET: APIRoute = async () => {
  const items = await cupboardPublic();
  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  const action = (body.action ?? '').trim();
  const code = (body.code ?? '').trim();
  const token = getPlayerToken(request);

  if (!code || !token) {
    return new Response(JSON.stringify({ error: 'Missing code or token' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // All write actions require the caller to be the host of the named game.
  // Load game first for auth check (lightweight read, no lock needed for read).
  const { loadGame } = await import('../../lib/game.js');
  const game = await loadGame(code);
  if (!game) {
    return new Response(JSON.stringify({ error: 'Game not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (game.creator_token !== token) {
    return new Response(JSON.stringify({ error: 'Only the host can edit the cupboard' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const editActions = ['add', 'update', 'remove'];
  const giveActions = ['give', 'ungive'];

  if (editActions.includes(action) && game.state !== 'lobby') {
    return new Response(JSON.stringify({ error: 'Cupboard is locked once the game starts' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (giveActions.includes(action) && !['reveal', 'done'].includes(game.state)) {
    return new Response(JSON.stringify({ error: 'Cannot mark prize given before the reveal' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- add ---
  if (action === 'add') {
    let name = (body.name ?? '').trim();
    let stock = Math.max(0, Number(body.stock ?? 0));
    if (!name) {
      return new Response(JSON.stringify({ error: 'Name is empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (name.length > 60) name = name.slice(0, 60);
    if (stock > 999) stock = 999;

    const result = await withCupboard((data) => {
      const needle = name.toLowerCase();
      for (const item of data.items) {
        if (item.name.toLowerCase() === needle) {
          item.stock = Math.min(999, Number(item.stock) + stock);
          return { data, result: { ok: true, id: item.id } };
        }
      }
      if (data.items.length >= 100) {
        return { result: { error: 'Cupboard full', code: 429 }, noWrite: true };
      }
      const id = generateId();
      data.items.push({ id, name, stock, created_at: Math.floor(Date.now() / 1000) });
      return { data, result: { ok: true, id } };
    });

    if (result && typeof result === 'object' && 'error' in result) {
      return new Response(JSON.stringify({ error: (result as any).error }), {
        status: (result as any).code ?? 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- update ---
  if (action === 'update') {
    const id = (body.id ?? '').trim();
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const hasStock = body.stock !== undefined;
    const hasName = body.name !== undefined;
    if (!hasStock && !hasName) {
      return new Response(JSON.stringify({ error: 'Nothing to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let newStock = hasStock ? Math.max(0, Math.min(999, Number(body.stock))) : null;
    let newName = hasName ? (body.name as string).trim() : null;
    if (hasName && !newName) {
      return new Response(JSON.stringify({ error: 'Name is empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (newName && newName.length > 60) newName = newName.slice(0, 60);

    const result = await withCupboard((data) => {
      for (const item of data.items) {
        if (item.id === id) {
          if (hasStock) item.stock = newStock!;
          if (hasName) item.name = newName!;
          return { data, result: { ok: true } };
        }
      }
      return { result: { error: 'Item not found', code: 404 }, noWrite: true };
    });

    if (result && typeof result === 'object' && 'error' in result) {
      return new Response(JSON.stringify({ error: (result as any).error }), {
        status: (result as any).code ?? 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- remove ---
  if (action === 'remove') {
    const id = (body.id ?? '').trim();
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = await withCupboard((data) => {
      const before = data.items.length;
      data.items = data.items.filter((it: any) => it.id !== id);
      if (data.items.length === before) {
        return { result: { error: 'Item not found', code: 404 }, noWrite: true };
      }
      return { data, result: { ok: true } };
    });

    if (result && typeof result === 'object' && 'error' in result) {
      return new Response(JSON.stringify({ error: (result as any).error }), {
        status: (result as any).code ?? 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- give ---
  if (action === 'give') {
    const id = (body.id ?? '').trim();
    if (!id) {
      return new Response(JSON.stringify({ error: 'Missing id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Validate game state and host via withGame
    const gameCheck = await withGame(code, (g) => {
      if (!['reveal', 'done'].includes(g.state)) {
        return { result: { error: 'Cannot mark prize given before the reveal', code: 409 }, noWrite: true };
      }
      if (g.creator_token !== token) {
        return { result: { error: 'Host only', code: 403 }, noWrite: true };
      }
      return { result: { ok: true }, noWrite: true };
    });

    if (gameCheck && typeof gameCheck === 'object' && 'error' in gameCheck) {
      return new Response(JSON.stringify({ error: (gameCheck as any).error }), {
        status: (gameCheck as any).code ?? 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Decrement stock in cupboard
    let itemName = '';
    const cupResult = await withCupboard((data) => {
      for (const item of data.items) {
        if (item.id === id) {
          if (Number(item.stock) <= 0) {
            return { result: { error: 'Out of stock', code: 409 }, noWrite: true };
          }
          item.stock = Number(item.stock) - 1;
          itemName = item.name;
          return { data, result: { ok: true, name: item.name } };
        }
      }
      return { result: { error: 'Item not found', code: 404 }, noWrite: true };
    });

    if (cupResult && typeof cupResult === 'object' && 'error' in cupResult) {
      return new Response(JSON.stringify({ error: (cupResult as any).error }), {
        status: (cupResult as any).code ?? 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Update prize_given fields on the game
    await withGame(code, (g) => {
      g.prize_given_id = id;
      g.prize_given_name = itemName;
      return { game: g, result: { ok: true } };
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- ungive ---
  if (action === 'ungive') {
    const previousId = game.prize_given_id ?? null;
    if (!previousId) {
      return new Response(JSON.stringify({ error: 'No prize marked given' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Validate game state via withGame
    const gameCheck = await withGame(code, (g) => {
      if (!['reveal', 'done'].includes(g.state)) {
        return { result: { error: 'Cannot unmark prize before the reveal', code: 409 }, noWrite: true };
      }
      if (g.creator_token !== token) {
        return { result: { error: 'Host only', code: 403 }, noWrite: true };
      }
      return { result: { ok: true }, noWrite: true };
    });

    if (gameCheck && typeof gameCheck === 'object' && 'error' in gameCheck) {
      return new Response(JSON.stringify({ error: (gameCheck as any).error }), {
        status: (gameCheck as any).code ?? 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Increment stock in cupboard
    await withCupboard((data) => {
      for (const item of data.items) {
        if (item.id === previousId) {
          item.stock = Math.min(999, Number(item.stock) + 1);
          return { data, result: { ok: true } };
        }
      }
      return { result: { ok: true }, noWrite: true };
    });

    // 3. Clear prize_given fields on the game
    await withGame(code, (g) => {
      g.prize_given_id = null;
      g.prize_given_name = null;
      return { game: g, result: { ok: true } };
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
};
