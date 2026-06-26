// Live game connection: owns the polling + heartbeat loop that used to live
// inline in Game.svelte. A `.svelte.ts` module so it can hold reactive `$state`.
//
// Improvements over the old fixed 1s setInterval:
//  - ETag/If-None-Match: a 304 from /api/state means "unchanged", so we skip the
//    JSON parse and the assignment entirely — no needless re-render.
//  - Adaptive cadence: poll every 1s only while `picking` (where snappiness
//    matters); back off to 3s in lobby/reveal/done.
//  - Visibility-aware: when the tab is hidden we stop polling and beating; on
//    return we fire both immediately so the player is marked online again.

import { untrack } from 'svelte';
import type { GameStateResponse } from './types.js';
import { post } from './api.js';

const POLL_FAST = 1000; // picking
const POLL_SLOW = 3000; // lobby / reveal / done
const HEARTBEAT_MS = 5000;

export class GameConnection {
  state = $state<GameStateResponse | null>(null);

  #code: string;
  #etag: string | null = null;
  #pollTimer: ReturnType<typeof setTimeout> | null = null;
  #heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  #onVisibility: (() => void) | null = null;
  #stopped = true;

  constructor(code: string) {
    this.#code = code;
  }

  start() {
    if (!this.#stopped) return;
    this.#stopped = false;

    this.#fetchState();
    this.#scheduleNext();

    this.#heartbeatTimer = setInterval(() => {
      if (!document.hidden) this.#heartbeat();
    }, HEARTBEAT_MS);

    this.#onVisibility = () => {
      if (!document.hidden) {
        this.#fetchState();
        this.#heartbeat();
      }
    };
    document.addEventListener('visibilitychange', this.#onVisibility);
  }

  stop() {
    this.#stopped = true;
    if (this.#pollTimer) { clearTimeout(this.#pollTimer); this.#pollTimer = null; }
    if (this.#heartbeatTimer) { clearInterval(this.#heartbeatTimer); this.#heartbeatTimer = null; }
    if (this.#onVisibility) {
      document.removeEventListener('visibilitychange', this.#onVisibility);
      this.#onVisibility = null;
    }
  }

  #scheduleNext() {
    if (this.#stopped) return;
    const delay = untrack(() => this.state?.state === 'picking' ? POLL_FAST : POLL_SLOW);
    this.#pollTimer = setTimeout(async () => {
      if (!document.hidden) await this.#fetchState();
      this.#scheduleNext();
    }, delay);
  }

  refresh() {
    if (!this.#stopped) this.#fetchState();
  }

  async #fetchState() {
    try {
      const res = await fetch(`/api/state?code=${this.#code}`, {
        headers: this.#etag ? { 'If-None-Match': this.#etag } : {},
      });
      if (res.status === 304) return; // unchanged — keep current state, no work
      if (res.ok) {
        this.#etag = res.headers.get('ETag');
        this.state = await res.json();
      }
    } catch {}
  }

  async #heartbeat() {
    try { await post('/api/heartbeat', { code: this.#code }); } catch {}
  }
}
