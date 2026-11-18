// Admin-controlled settings (see /admin). One small JSON document that decides
// things which used to be edited in code or env vars: which sound pack plays,
// which theme is forced (or "auto" = follow the calendar), whether each event
// runs and on which dates, what new games default to, and when the outing is.
//
//   data/settings.json         fast local copy, read at boot and on every save
//   GitHub, settings branch    the durable copy: every save is a commit, so the
//                              branch history is the audit log, and a fresh
//                              deploy picks the settings back up
//
// Reads are synchronous (pages call getSettings() while rendering). The first
// seconds after boot may serve the local copy before GitHub has been asked.
//
// ⚠️  GITHUB_SETTINGS_BRANCH must not be the branch the host deploys from.

import fs from 'node:fs';
import path from 'node:path';
import { EVENTS, type EventSchedule } from '../themes/index.js';
import { remoteJson, type PushResult } from './githubStore.js';
import { DEFAULT_STYLE, DEFAULT_HOST_PLAYS } from './bars.js';
import { EVENT_DATE, TEASE_FROM } from './specialPrize.js';
import type { GameStyle } from './types.js';

export type SoundPack = 'cheerful' | 'classic';
export const SOUND_PACKS: SoundPack[] = ['cheerful', 'classic'];

export interface Settings {
  /** Which set of sound effects every client plays. */
  soundPack: SoundPack;
  /** 'auto' follows the event calendar; an id forces that theme for everyone. */
  theme: string;
  /** Per event theme: does it run, and on which dates (empty = its own window). */
  events: Record<string, EventSchedule>;
  /** What a new game starts as. The host can still change both in the lobby. */
  defaults: { style: GameStyle; hostPlays: boolean };
  /** The team outing the golden-ticket teaser counts down to. */
  outing: { eventDate: string; teaseFrom: string };
  /** Unix ms of the last save, and where from. */
  updated_at: number;
  updated_by: string;
}

const FILE = path.resolve('data', 'settings.json');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: unknown): v is string => typeof v === 'string' && DATE.test(v) && !Number.isNaN(Date.parse(v));

const remote = remoteJson<Settings>({
  branch: process.env.GITHUB_SETTINGS_BRANCH ?? 'chocolottery-settings',
  path: process.env.GITHUB_SETTINGS_PATH ?? 'settings.json',
  label: 'settings',
});

/** `YYYY-MM-DD` in the office's timezone. (resolve.ts has the same helper, but
 *  imports this file, so it can't be shared from there.) */
function officeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Everything as it ships. An event whose own window has already ended starts
 *  switched off, so a retired event stays retired until someone turns it on. */
export function defaultSettings(): Settings {
  const today = officeToday();
  const events: Record<string, EventSchedule> = {};
  for (const e of EVENTS) {
    events[e.id] = { enabled: e.window ? e.window.to >= today : true, from: '', to: '' };
  }
  return {
    soundPack: 'cheerful',
    theme: 'auto',
    events,
    defaults: { style: DEFAULT_STYLE, hostPlays: DEFAULT_HOST_PLAYS },
    outing: { eventDate: EVENT_DATE, teaseFrom: TEASE_FROM },
    updated_at: 0,
    updated_by: '',
  };
}

/** Anything → a complete, valid Settings. Unknown or malformed fields fall back
 *  to `base`, so a half-written file or a hand-edited commit can't break pages. */
export function normalise(input: unknown, base: Settings = defaultSettings()): Settings {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, any>;
  const out: Settings = structuredClone(base);

  if (SOUND_PACKS.includes(i.soundPack)) out.soundPack = i.soundPack;

  if (i.theme === 'auto' || (typeof i.theme === 'string' && (i.theme === 'default' || EVENTS.some((e) => e.id === i.theme)))) {
    out.theme = i.theme;
  }

  if (i.events && typeof i.events === 'object') {
    for (const e of EVENTS) {
      const s = i.events[e.id];
      if (!s || typeof s !== 'object') continue;
      const cur = out.events[e.id];
      if (typeof s.enabled === 'boolean') cur.enabled = s.enabled;
      const from = s.from === '' ? '' : isDate(s.from) ? s.from : cur.from;
      const to = s.to === '' ? '' : isDate(s.to) ? s.to : cur.to;
      // Both or neither: half a window means nothing.
      if ((from && to && from <= to) || (!from && !to)) { cur.from = from; cur.to = to; }
    }
  }

  if (i.defaults && typeof i.defaults === 'object') {
    if (i.defaults.style === 'straws' || i.defaults.style === 'bars') out.defaults.style = i.defaults.style;
    if (typeof i.defaults.hostPlays === 'boolean') out.defaults.hostPlays = i.defaults.hostPlays;
  }

  if (i.outing && typeof i.outing === 'object') {
    const ev = isDate(i.outing.eventDate) ? i.outing.eventDate : out.outing.eventDate;
    const tease = isDate(i.outing.teaseFrom) ? i.outing.teaseFrom : out.outing.teaseFrom;
    if (tease <= ev) { out.outing.eventDate = ev; out.outing.teaseFrom = tease; }
  }

  if (typeof i.updated_at === 'number') out.updated_at = i.updated_at;
  if (typeof i.updated_by === 'string') out.updated_by = i.updated_by.slice(0, 60);
  return out;
}

// ── Cache ────────────────────────────────────────────────────────────────────
function readLocal(): Settings | null {
  try { return normalise(JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch { return null; }
}

function writeLocal(s: Settings): void {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(s, null, 2));
  } catch (err) {
    console.error('[settings] cannot write local copy:', err instanceof Error ? err.message : err);
  }
}

let cache: Settings = readLocal() ?? defaultSettings();

export function getSettings(): Settings {
  return cache;
}

// ── Mirror status, for the dashboard ─────────────────────────────────────────
export interface SyncStatus {
  /** GITHUB_TOKEN and GITHUB_REPO are set. */
  configured: boolean;
  target: string;
  historyUrl: string;
  /** 'idle' until the first pull or push has finished. */
  last: 'idle' | 'saved' | 'pulled' | 'failed' | 'unreachable';
  at: number;
}
const sync: SyncStatus = { configured: remote.enabled(), target: remote.target(), historyUrl: remote.historyUrl(), last: 'idle', at: 0 };
export const syncStatus = (): SyncStatus => ({ ...sync });

// Pull the durable copy once per process. The newer of the two wins; if the
// local one is newer (a save whose push never landed) it is pushed up.
let hydration: Promise<void> | null = null;
export function hydrateSettings(): Promise<void> {
  if (!hydration) {
    hydration = (async () => {
      if (!remote.enabled()) {
        console.warn('[settings] GITHUB_TOKEN / GITHUB_REPO not set: settings live on local disk only.');
        return;
      }
      const res = await remote.pull();
      sync.at = Date.now();
      if (!res.reachable) { sync.last = 'unreachable'; return; }
      if (res.found && res.value) {
        const theirs = normalise(res.value);
        if (theirs.updated_at >= cache.updated_at) {
          cache = theirs;
          writeLocal(cache);
          sync.last = 'pulled';
          console.log(`[settings] loaded from ${remote.target()}`);
          return;
        }
      }
      sync.last = 'pulled';
      if (cache.updated_at > 0) void pushSettings(cache, 'settings: sync local copy');
    })().catch((err) => { console.error('[settings] hydrate error:', err); sync.last = 'failed'; });
  }
  return hydration;
}
void hydrateSettings();

async function pushSettings(s: Settings, message: string): Promise<PushResult> {
  const r = await remote.push(s, message);
  sync.at = Date.now();
  sync.last = r === 'saved' ? 'saved' : r === 'failed' ? 'failed' : sync.last;
  return r;
}

// ── Saving ───────────────────────────────────────────────────────────────────
/** Dotted paths of what differs, for the commit message. */
function changes(a: unknown, b: unknown, prefix = ''): string[] {
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    return [...keys].flatMap((k) => (k === 'updated_at' || k === 'updated_by') ? [] : changes((a as any)[k], (b as any)[k], prefix ? `${prefix}.${k}` : k));
  }
  return a === b ? [] : [`${prefix} ${JSON.stringify(a)} → ${JSON.stringify(b)}`];
}

export interface SaveResult { settings: Settings; changed: string[]; remote: PushResult }

let saveChain: Promise<unknown> = Promise.resolve();

/** Validate, save locally, commit to the settings branch. The local save has
 *  happened by the time this resolves, whatever `remote` says. */
export function saveSettings(input: unknown, by = 'admin'): Promise<SaveResult> {
  const run = saveChain.then(async () => {
    await hydrateSettings();
    const next = normalise(input, cache);
    const changed = changes(cache, next);
    if (changed.length === 0) return { settings: cache, changed, remote: 'saved' as PushResult };
    next.updated_at = Date.now();
    next.updated_by = by;
    cache = next;
    writeLocal(cache);
    const message = `settings: ${changed.slice(0, 4).join('; ')}${changed.length > 4 ? ` (+${changed.length - 4} more)` : ''}`;
    return { settings: cache, changed, remote: await pushSettings(cache, message) };
  });
  saveChain = run.catch(() => undefined);
  return run;
}
