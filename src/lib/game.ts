import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { randomBytes, randomInt } from 'node:crypto';
import { withLock } from './lock.js';
import type {
  Game, GameStateResponse, CupboardItem, LeaderboardWin, PrizeSnack,
  PublicPlayer, PublicSuggestion, PublicChatMessage
} from './types.js';

// ── Paths ────────────────────────────────────────────────────────────────────
const DATA_DIR  = path.resolve('data');
const GAMES_DIR = path.join(DATA_DIR, 'games');
const LB_FILE   = path.join(DATA_DIR, 'leaderboard.json');
const CB_FILE   = path.join(DATA_DIR, 'cupboard.json');

if (!fs.existsSync(GAMES_DIR)) fs.mkdirSync(GAMES_DIR, { recursive: true });
if (!fs.existsSync(LB_FILE))   fs.writeFileSync(LB_FILE, JSON.stringify({ wins: [] }));
if (!fs.existsSync(CB_FILE))   fs.writeFileSync(CB_FILE, JSON.stringify({ items: [] }));

// ── Constants ────────────────────────────────────────────────────────────────
export const ONLINE_THRESHOLD = 30;
export const GAME_TTL         = 86400;

// ── In-memory caches ───────────────────────────────────────────────────────
// Games and the (global) cupboard are mirrored in memory so the polling hot
// path (/api/state every 1s) never touches disk. All writes go through the
// per-file mutex in withLock, so the cache stays consistent with disk.
//
// Reads hand out a structuredClone so callers can mutate freely without
// corrupting the cached copy or being observed mid-mutation by the lockless
// GET reader; saveGame swaps in a fresh clone atomically.
const gameCache = new Map<string, Game>();

function cacheKey(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

// ── Game CRUD ────────────────────────────────────────────────────────────────
export function gamePath(code: string): string {
  return path.join(GAMES_DIR, cacheKey(code) + '.json');
}

export async function loadGame(code: string): Promise<Game | null> {
  const key = cacheKey(code);
  let game = gameCache.get(key);
  if (!game) {
    try {
      game = JSON.parse(await fsp.readFile(gamePath(code), 'utf8')) as Game;
      gameCache.set(key, game);
    } catch {
      return null;
    }
  }
  return structuredClone(game);
}

export async function saveGame(game: Game): Promise<void> {
  gameCache.set(cacheKey(game.code), structuredClone(game));
  await fsp.writeFile(gamePath(game.code), JSON.stringify(game));
}

export async function withGame<T>(
  code: string,
  fn: (game: Game) => { game?: Game; result: T; noWrite?: boolean }
): Promise<T | null> {
  return withLock(gamePath(code), async () => {
    const game = await loadGame(code);
    if (!game) return null;
    const { game: updated, result, noWrite } = fn(game);
    if (!noWrite && updated) await saveGame(updated);
    return result;
  });
}

// ── Generators ───────────────────────────────────────────────────────────────
export function generateToken(): string {
  return randomBytes(16).toString('hex');
}

export function generateId(): string {
  return randomBytes(6).toString('hex');
}

export function generateGameCode(): string | null {
  const prefixes = ['CHOC', 'COCO', 'BEAN', 'WRAP'];
  for (let i = 0; i < 50; i++) {
    const prefix = prefixes[randomInt(prefixes.length)];
    const num    = String(randomInt(10000)).padStart(4, '0');
    const code   = `${prefix}-${num}`;
    if (!gameCache.has(cacheKey(code)) && !fs.existsSync(gamePath(code))) return code;
  }
  return null;
}

export function generateStraws(n: number): number[] {
  const deck = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const winnerPos = deck[0];
  const straws = Array.from({ length: n }, () => randomInt(15, 71));
  straws[winnerPos] = 100;
  return straws;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function isOnline(player: { last_seen: number }, now = Math.floor(Date.now() / 1000)): boolean {
  return (now - player.last_seen) <= ONLINE_THRESHOLD;
}

export function pickPrizeSnack(game: Game): PrizeSnack | null {
  if (!game.suggestions?.length) return null;
  let maxVotes = 0;
  for (const s of game.suggestions) {
    const v = s.votes?.length ?? 0;
    if (v > maxVotes) maxVotes = v;
  }
  const candidates = game.suggestions.filter(s => (s.votes?.length ?? 0) === maxVotes);
  if (!candidates.length) return null;
  const pick = candidates[randomInt(candidates.length)];
  return {
    text:        pick.text ?? '',
    author_name: pick.author_name ?? '',
    votes:       pick.votes?.length ?? 0,
    random:      maxVotes === 0,
  };
}

// ── Leaderboard ──────────────────────────────────────────────────────────────
export async function appendLeaderboard(win: LeaderboardWin): Promise<void> {
  return withLock(LB_FILE, async () => {
    let data: { wins: LeaderboardWin[] } = { wins: [] };
    try { data = JSON.parse(await fsp.readFile(LB_FILE, 'utf8')); } catch {}
    data.wins.push(win);
    await fsp.writeFile(LB_FILE, JSON.stringify(data));
  });
}

export async function loadLeaderboard(): Promise<{ wins: LeaderboardWin[] }> {
  try { return JSON.parse(await fsp.readFile(LB_FILE, 'utf8')); }
  catch { return { wins: [] }; }
}

// ── Cupboard ─────────────────────────────────────────────────────────────────
// The cupboard is global and read on every poll (inside sanitiseState), so it
// lives in memory. Seeded once at startup; kept in sync by withCupboard.
let cupboardCache: CupboardItem[] = [];
try { cupboardCache = JSON.parse(fs.readFileSync(CB_FILE, 'utf8')).items ?? []; } catch {}

export async function withCupboard<T>(
  fn: (items: CupboardItem[]) => { items?: CupboardItem[]; result: T; noWrite?: boolean }
): Promise<T> {
  return withLock(CB_FILE, async () => {
    // Hand the callback a private copy; commit to cache + disk only on write.
    const items = cupboardCache.map(i => ({ ...i }));
    const { items: updated, result, noWrite } = fn(items);
    if (!noWrite && updated !== undefined) {
      cupboardCache = updated;
      await fsp.writeFile(CB_FILE, JSON.stringify({ items: updated }));
    }
    return result;
  });
}

export function cupboardPublic(): { id: string; name: string; stock: number }[] {
  return cupboardCache
    .map(i => ({ id: i.id, name: i.name, stock: i.stock }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

// ── State sanitisation ────────────────────────────────────────────────────────
export function sanitiseState(game: Game, myToken: string | null): GameStateResponse {
  const now = Math.floor(Date.now() / 1000);
  const players: PublicPlayer[] = Object.entries(game.players ?? {}).map(([token, p]) => ({
    token,
    name:        p.name,
    online:      isOnline(p, now),
    picked:      p.straw_index != null,
    straw_index: p.straw_index ?? null,
    is_me:       token === myToken,
  }));

  let strawsOut: (number | null)[] | null = null;
  if (Array.isArray(game.straws)) {
    strawsOut = (game.state === 'reveal' || game.state === 'done')
      ? game.straws
      : game.straws.map(() => null);
  }

  const myStraw = myToken ? (game.players[myToken]?.straw_index ?? null) : null;
  const inGame  = !!(myToken && game.players[myToken]);

  const suggestions: PublicSuggestion[] = (game.suggestions ?? [])
    .map(s => ({
      id:           s.id,
      text:         s.text,
      author_name:  s.author_name,
      mine:         s.author_token === myToken,
      votes:        s.votes?.length ?? 0,
      voted_tokens: s.votes ?? [],
      voted:        !!(myToken && s.votes?.includes(myToken)),
      created_at:   s.created_at,
    }))
    .sort((a, b) => b.votes - a.votes || a.created_at - b.created_at);

  const chat: PublicChatMessage[] = inGame
    ? (game.chat ?? []).map(m => ({
        id:   m.id,
        name: m.name,
        text: m.text,
        ts:   m.ts,
        mine: m.token === myToken,
      }))
    : [];

  return {
    code:             game.code,
    state:            game.state,
    players,
    straws:           strawsOut,
    winner_token:     game.winner_token,
    creator_token:    game.creator_token,
    is_host:          !!(myToken && game.creator_token === myToken),
    my_token:         myToken,
    my_straw:         myStraw,
    suggestions,
    prize_snack:      game.prize_snack ?? null,
    cupboard:         cupboardPublic(),
    prize_given_id:   game.prize_given_id ?? null,
    prize_given_name: game.prize_given_name ?? null,
    chat,
    in_game:          inGame,
  };
}

// ── Cleanup ──────────────────────────────────────────────────────────────────
export async function cleanupOldGames(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  try {
    for (const f of await fsp.readdir(GAMES_DIR)) {
      const p = path.join(GAMES_DIR, f);
      try {
        const g: Game = JSON.parse(await fsp.readFile(p, 'utf8'));
        if (now - (g.created_at ?? 0) > GAME_TTL) {
          await fsp.unlink(p);
          gameCache.delete(cacheKey(g.code ?? f.replace(/\.json$/, '')));
        }
      } catch {}
    }
  } catch {}
}

// ── Cookie helpers ────────────────────────────────────────────────────────────
export function getPlayerToken(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const match  = cookie.match(/(?:^|;\s*)player_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function setPlayerCookie(token: string): string {
  return `player_token=${token}; Path=/; Max-Age=86400; SameSite=Lax`;
}
