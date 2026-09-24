# chocolate.lottery

A multiplayer office party game. A group draws straws to decide who gets the chocolate.
One straw is secretly the longest (value `100`); **whoever pulls it wins** — they go on
the leaderboard (`finalizePicking` in `lib/game.ts`) and the host hands them something
from the cupboard (`GiveCard.svelte`). Built as a real-time-ish web app where colleagues
join a shared game by code, gather in a lobby, pick straws simultaneously, and watch the
reveal. Includes snack suggestions + voting, a shared cupboard of prizes, in-game chat, a
leaderboard, and a tongue-in-cheek "Fairness Check" that compares actual wins to
statistically expected wins.

## Tech stack

- **Astro 6** (`output: 'server'`, SSR) with the **Node adapter in `middleware` mode**.
- **Svelte 5** islands (runes: `$state`, `$derived`, `$props`, `$effect`) for all interactivity.
- **TypeScript**, **Tailwind v4** (via `@tailwindcss/vite`) — though most styling lives in `src/styles/global.css`.
- **No database.** State is persisted as **JSON files on disk** under `data/`.
- Real-time is simulated by **client polling** `/api/state` every 1s + a `/api/heartbeat` every 5s.

## Run / build

```bash
npm run dev      # astro dev --port 4321 (Vite HMR)
npm run build    # astro build -> dist/
npm start        # node server.js  (production; serves dist/server/entry.mjs on :4321)
```

`server.js` is the production entry point; it wraps the built middleware `handler` in a plain `http` server.

## Two styles: straws and chocolate bars

Each game has a `style` (`lib/bars.ts`, `DEFAULT_STYLE` for new games; the host
flips it in the lobby via `POST /api/style`). **Both share the same draw**:
`game.straws` holds one `100` among random values. In straw mode that's the
longest straw; in bar mode it's the MOVION bar with the golden ticket inside.
Games saved before `style` existed read as `'straws'` (`gameStyle()`).

Bar mode adds an **`unwrapping`** phase between picking and reveal. Every
player's own bar goes full screen on their device (`UnwrapStage.svelte`,
swipe/drag to tear it open in `UNWRAP_STEPS` stop-motion frames); the host's
screen shows the live board of everyone's progress (`UnwrapPhase.svelte`).
Progress goes to `POST /api/unwrap` (forward-only, idempotent). A bar's
contents are only revealed once its holder reaches the last step, and opening
the golden one calls `finalizePicking` in the same write, so the round ends
for everyone on their next poll (500ms while unwrapping). The host's
"resolve" button opens every bar at once if the ticket holder is AFK.

The bar is one SVG (`ChocolateBar.svelte`) drawn per step from seeded
randomness, so every device shows the same frame. Dev-only workbench:
`/dev/bars`.

Rounds can be big (tested with 41 players). On the desktop layout the bars are
sized to the stage (`lib/fitShelf.ts`), elsewhere by head count
(`shelfDensity()`); either way the stage must never clip the shelf, or players
can't reach their bar.

**Event-day layout** (`eventLayout` in `Game.svelte`): on `EVENT_DATE`, or with
`?event` on a game link, the header nav, snack votes and cupboard are hidden and
the stage takes their space; the game code moves onto the stage bar.

## Game lifecycle (state machine)

`game.state` moves through four phases. The whole UI keys off this value.

```
lobby ──(host starts, ≥2 online)──▶ picking ──(all picked)──▶ reveal ─▶ done
  ▲                                    │                        ▲          │
  │                          (bar mode)└──▶ unwrapping ─────────┘          │
  │                                   (golden bar opened / host opens all) │
  └──────────────────────────(host restarts)──────────────────────────────┘
```

- **lobby** — players join via code, suggest + vote on the prize snack, host edits the cupboard.
- **picking** — straws are generated server-side (`generateStraws`); each player clicks one. A 3‑2‑1‑GO countdown runs client-side; picking is blocked while it's active. When the second-to-last player picks, the last player is **auto-assigned** the only remaining straw (`api/pick.ts`).
- **reveal / done** — winner (the `100` straw holder) is computed, prize snack chosen, a leaderboard record is written. Host can mark which cupboard item was handed over ("give"), or restart.

## Identity & data model

- A player is identified by a `player_token` **cookie** (random hex, `getPlayerToken`/`setPlayerCookies` in `lib/game.ts`). No accounts.
- The **host/creator** is the first joiner (`creator_token`). Host-only actions: start, restart, edit cupboard, mark prize given.
- **"Online"** = `last_seen` within `ONLINE_THRESHOLD` (30s). Games older than `GAME_TTL` (24h) are cleaned up lazily.

Persisted files (see `lib/types.ts` for full interfaces):
- `data/games/<CODE>.json` — one `Game` per game (players, straws, suggestions, chat, prize). Codes look like `CHOC-1234` (prefixes: CHOC/COCO/BEAN/WRAP).
- `data/leaderboard.json` — append-only list of `LeaderboardWin` records (powers leaderboard + fairness). **Mirrored to GitHub — see below.**
- `data/cupboard.json` — shared, global list of `CupboardItem` prizes (NOT per-game).

### Durable leaderboard (`lib/leaderboardRemote.ts`)

`data/` sits on the host's container disk, which is disposable — the win history
was lost once already when a Railway deployment was removed. So the leaderboard
(and only the leaderboard; games are 24h-ephemeral) has a second home:

- **GitHub is the durable copy.** Every win is committed to `leaderboard.json`
  on a data branch via the Contents API.
- **`data/leaderboard.json` is a read cache.** On the first leaderboard read of
  a process, `hydrateLeaderboard()` pulls from GitHub and unions it with
  whatever is on disk (deduped on `game_code|timestamp|name`), so a fresh
  deploy self-heals and an offline-recorded win still gets pushed up later.
- Pushes are **fired without awaiting** (the reveal must not wait on GitHub) and
  **serialised** through `mirrorQueue`, because the Contents API rejects
  concurrent writes to the same file.
- Every failure path is non-fatal: no token, GitHub down or rate-limited → the
  game keeps working on local files, and only the off-host backup is lost.

Config lives in `.env.example`. ⚠️ `GITHUB_DATA_BRANCH` must **not** be the
branch Railway deploys from — each win is a commit, so pointing it at the deploy
branch would restart the server mid-game.

## Project structure — where to operate

```
src/
├── pages/
│   ├── index.astro          # Landing: create/join game, fairness modal, feature announcement
│   ├── leaderboard.astro     # Wins table
│   ├── game/[code].astro     # Game page shell — SSR loads cookie/token, mounts <Game> island (client:load)
│   └── api/                   # All server endpoints (Astro API routes, JSON in/out)
│       ├── create.ts          # POST → new game file, returns code
│       ├── join.ts            # POST → add player, set token cookie (also handles rejoin)
│       ├── state.ts           # GET  → sanitised game state for polling (the hot path)
│       ├── heartbeat.ts       # POST → bump last_seen
│       ├── start.ts           # POST → lobby→picking, generate straws (host, ≥2 online)
│       ├── pick.ts            # POST → assign straw; auto-pick last player; resolve→reveal
│       ├── restart.ts         # POST → reveal/done→lobby (host)
│       ├── suggest.ts         # POST → add prize-snack suggestion (auto-votes own)
│       ├── vote.ts            # POST → toggle vote on a suggestion
│       ├── chat.ts            # POST → add chat message (rate-limited, keeps last 100)
│       ├── cupboard.ts        # GET/POST → add/update/remove/give/ungive cupboard items (host)
│       ├── fairness.ts        # GET  → computes expected vs actual wins + luck verdicts
│       ├── unwrap.ts          # POST → bar mode: record unwrap step; last step reveals contents
│       └── style.ts           # POST → host sets straws/bars for the next round (lobby only)
├── components/
│   ├── Game.svelte           # ★ Root island. Owns gameState, polling loop, sound effects,
│   │                         #   countdown, phase routing, join modal, fairness modal.
│   ├── LobbyPhase.svelte     # Players in the room
│   ├── PickingPhase.svelte   # Straw grid + click-to-pick (has `locked` prop for countdown)
│   ├── RevealPhase.svelte    # Animated reveal of straw heights + winner
│   ├── Snacks.svelte         # Suggestions + voting + cupboard entry point
│   ├── Chat.svelte           # In-game chat drawer
│   ├── Cupboard.svelte       # Host prize-stock editor modal
│   ├── EffectsCanvas.svelte  # Confetti / tears / sparkles canvas
│   ├── ChocolateBar.svelte   # Bar mode: the MOVION bar SVG at any unwrap step
│   ├── BarPicking.svelte     # Bar mode picking shelf (twin of PickingPhase)
│   ├── UnwrapPhase.svelte    # Bar mode: host board + per-player scratch view + sync
│   ├── UnwrapStage.svelte    # Full-screen swipe-to-unwrap view of your own bar
│   ├── BoardBar.svelte       # Board tile that plays missed frames at 12fps
│   └── BarReveal.svelte      # Bar mode reveal: ticket lifts out, name, confetti
├── lib/
│   ├── game.ts               # ★ Core: load/save games, withGame(), sanitiseState(),
│   │                         #   straw/code/token generators, leaderboard, cupboard, cookies
│   ├── bars.ts               # Bar mode constants (DEFAULT_STYLE, UNWRAP_STEPS), PRNG
│   ├── lock.ts               # withLock(): per-file async mutex (serialises writes)
│   └── types.ts              # All shared interfaces (Game, GameStateResponse, etc.)
└── styles/global.css         # All visual styling
```

**Mental model:** `Game.svelte` polls `/api/state` → gets a `GameStateResponse` → renders one
phase component based on `state`. Phase components are presentational; **all mutations go
through `POST /api/*`**, which use `withGame()` (load → mutate → save, under a file lock).
`sanitiseState()` is the single source of truth for what the client can see (e.g. straw
values are hidden until reveal).

## Conventions & gotchas

- **Never name a Svelte prop `state`.** It collides with the `$state` rune — Svelte compiles
  `$state(...)` as a store subscription instead (`store_rune_conflict`), silently breaking the
  component. Phase components receive the game as a prop named **`game`**, not `state`. (This
  was the cause of an earlier "stuck on Loading" bug.) Watch the dev-server output for
  `store_rune_conflict` / `non_reactive_update` warnings.
- **All writes use `withGame(code, fn)`** (or `withCupboard` / `withLock`) so concurrent
  requests don't clobber the JSON file. Don't read-modify-write game files directly.
- **API handlers return JSON** with an `{ error, code }` convention; mutations check
  `creator_token` for host-only actions and `game.state` for phase guards.
- Timestamps are **Unix seconds** (`Math.floor(Date.now()/1000)`), except chat rate-limiting
  which uses ms (`last_chat_ms`).
- The client is the only "scheduler": there are no websockets/SSE. If something feels
  un-live, check the polling `$effect` in `Game.svelte` and the `/api/state` response.
- Prize snack is decided by most-voted suggestion (ties broken randomly); the physical prize
  is tracked separately via the cupboard "give" flow.
