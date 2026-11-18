// The advent calendar: a theme feature, on while the live theme (baseThemeId, the
// one everyone gets, not a visitor's preview) has `advent` words. 24 doors, for
// 1 to 24 December of the season.
//
// The rule, as agreed for the office:
//   - door N belongs to N December; a Saturday's door opens on the Friday before
//     and a Sunday's on the Monday after, so Fridays and Mondays have two doors
//     and two rounds to play
//   - every win opens exactly one door: the oldest one that has opened and is
//     still shut, so the doors of a day nobody played roll over to the next wins
//   - once every door that has opened is taken, a win gets the usual prize only
//
// Which doors are open is not stored on its own: a win records its door
// (LeaderboardWin.advent), and the leaderboard is already durable (mirrored to
// GitHub). This module keeps an index of it in memory, seeded from the local
// leaderboard file on first use and topped up by game.ts as wins come in.

import fs from 'node:fs';
import path from 'node:path';
import { EVENTS, getTheme, windowOf, type EventTheme, type Theme } from '../themes/index.js';
import { baseThemeId, officeDate } from '../themes/resolve.js';
import { getSettings } from './settings.js';
import type { LeaderboardWin } from './types.js';

import { DOORS } from './adventDoors.js';

export { DOORS };
const LB_FILE = path.resolve('data', 'leaderboard.json');

/** Today, as the doors see it. In dev only, ADVENT_TODAY=YYYY-MM-DD pretends. */
export function adventToday(): string {
  const fake = import.meta.env.DEV ? process.env.ADVENT_TODAY?.trim() : '';
  return fake && /^\d{4}-\d{2}-\d{2}$/.test(fake) ? fake : officeDate();
}

/** The live theme, when it runs a calendar. */
export function adventTheme(): Theme | null {
  const t = getTheme(baseThemeId());
  return t.advent ? t : null;
}

/** The event that owns the calendar, live or not (the /advent page, the dashboard). */
export function adventEvent(): EventTheme | null {
  return EVENTS.find((e) => e.advent) ?? null;
}

/** The December the calendar counts: the year the event's dates start in. */
export function seasonYear(): number {
  const e = adventEvent();
  const w = e ? windowOf(e, getSettings().events[e.id]) : null;
  return Number((w?.from ?? adventToday()).slice(0, 4));
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface DoorDay {
  door: number;
  /** The door's own date. */
  date: string;
  /** When it can be opened: the date, or the Friday before / Monday after a weekend. */
  opensOn: string;
}

export function schedule(year = seasonYear()): DoorDay[] {
  return Array.from({ length: DOORS }, (_, i) => {
    const door = i + 1;
    const date = `${year}-12-${String(door).padStart(2, '0')}`;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 Sunday, 6 Saturday
    const opensOn = weekday === 6 ? addDays(date, -1) : weekday === 0 ? addDays(date, 1) : date;
    return { door, date, opensOn };
  });
}

// ── Which doors are open ─────────────────────────────────────────────────────
export interface OpenedDoor { door: number; name: string; game_code: string; timestamp: number; title: string }

const opened = new Map<string, OpenedDoor>();
const key = (year: number, door: number) => `${year}:${door}`;
let seeded = false;

/** Index the doors these wins opened. Called with the leaderboard as it loads. */
export function noteWins(wins: LeaderboardWin[]): void {
  for (const w of wins) {
    if (!w.advent) continue;
    opened.set(key(w.advent.year, w.advent.door), {
      door: w.advent.door, name: w.name, game_code: w.game_code, timestamp: w.timestamp, title: w.advent.title ?? '',
    });
  }
}

function seed(): void {
  if (seeded) return;
  seeded = true;
  try { noteWins(JSON.parse(fs.readFileSync(LB_FILE, 'utf8'))?.wins ?? []); } catch { /* no leaderboard yet */ }
}

export function openedDoors(year = seasonYear()): OpenedDoor[] {
  seed();
  return [...opened.entries()]
    .filter(([k]) => k.startsWith(`${year}:`))
    .map(([, v]) => v)
    .sort((a, b) => a.door - b.door);
}

/** Doors that can be opened and are still shut, oldest first. */
export function waitingDoors(year = seasonYear(), today = adventToday()): number[] {
  seed();
  return schedule(year)
    .filter((d) => d.opensOn <= today && !opened.has(key(year, d.door)))
    .map((d) => d.door);
}

export interface AdventClaim { year: number; door: number; title: string }

/** At a reveal with a winner: take the next door, if the live theme runs a calendar
 *  and a door is waiting. It counts as taken at once, so two rounds finishing at the
 *  same moment can't both get it; the win record carrying it is what makes it last. */
export function claimDoor(winner: string, gameCode: string): AdventClaim | null {
  if (!adventTheme()) return null;
  const year = seasonYear();
  const door = waitingDoors(year)[0];
  if (!door) return null;
  const title = getSettings().advent.prizes[String(door)]?.title.trim() ?? '';
  opened.set(key(year, door), { door, name: winner, game_code: gameCode, timestamp: Math.floor(Date.now() / 1000), title });
  return { year, door, title };
}

/** What the lobby shows: the door this round will open, and how many are waiting. */
export function nextDoor(): { door: number; waiting: number } | null {
  if (!adventTheme()) return null;
  const waiting = waitingDoors();
  return waiting.length ? { door: waiting[0], waiting: waiting.length } : null;
}

/** Everything the dashboard and the /advent page need, in one go. */
export function adventView() {
  const year = seasonYear();
  const today = adventToday();
  return {
    year,
    today,
    live: !!adventTheme(),
    schedule: schedule(year),
    opened: openedDoors(year),
    waiting: waitingDoors(year, today),
  };
}
export type AdventView = ReturnType<typeof adventView>;
