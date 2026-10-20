# chocolottery

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
Progress goes to `POST /api/unwrap` (forward-only, idempotent). **Nobody learns what's
in a bar before the reveal, the holder included**: `/api/unwrap` returns only the step,
`sanitiseState` sends every straw as `null` until `reveal`/`done`, and a fully opened bar
is drawn as a glowing orb with a "?" (`ChocolateBar` with `golden === null`), identical
for every bar. Players hop to the board (the live view of everyone) a beat after their
last tear; the stage keeps the rotating suspense lines. The write that opens the last bar
calls `finalizePicking` (`allBarsOpen()`), and every screen flips to the reveal on its
next poll (500ms while unwrapping). The reveal opens with a drumroll (`DRUMROLL_MS`),
then the ticket lifts out of the winner's bar; the prize snack and the host's "mark
given" control sit inside that canvas (`prize` snippet) so the stage never scrolls. The
host's "unlock them and reveal" button opens the rest if someone is AFK.

The bar is one SVG (`ChocolateBar.svelte`) drawn per step from seeded
randomness, so every device shows the same frame. Dev-only workbench:
`/dev/bars`.

Rounds can be big (tested with 41 players). On the desktop layout the bars are
sized to the stage (`lib/fitShelf.ts`), elsewhere by head count
(`shelfDensity()`); either way the stage must never clip the shelf, or players
can't reach their bar. After the lobby, bar rounds drop the snack column
(`.game-grid.stage-wide`) so the stage gets the width.

**Event-day layout** (`eventLayout` in `Game.svelte`): on `EVENT_DATE`, or with
`?event` on a game link, the header nav, snack votes and cupboard are hidden and
the stage takes their space; the game code moves onto the stage bar.

## Themes and events (`src/themes/`)

The default look is the base. An **event** (Halloween, Winter, …) is a partial override
on top of it: it can swap copy, change what the confetti throws, add sounds, print extra
shapes on the bars, add ambient markup and add CSS. Remove an event and everything falls
back to the default, so nothing is left half-themed.

- **Picking one** (`themes/resolve.ts`, first match wins): `?theme=<id>` (a preview, kept in
  the `theme_preview` cookie; `?theme=default` forces the base, `?theme=auto` drops the
  preview), then the `THEME` env var (ops override, see `.env.example`), then an event's date
  window (Europe/Amsterdam), then the default. Every page calls `themeFor(Astro)` and writes
  `<html data-theme="id">` on the server, so the first paint is themed and server and
  client never disagree.
- **Files per event:** `themes/<id>.ts` (copy, effects, sounds, bar print, window),
  `styles/themes/<id>.css` (every rule under `html[data-theme='<id>']`, imported by
  `styles/themes/index.css`), optional `themes/<id>/Decor.astro` (ambient layer, registered
  in `themes/decor.ts`). Register the event in `EVENTS` in `themes/index.ts`. Retire it by
  removing it from `EVENTS`. An event with no `window` never starts by date (Winter is that
  today: preview only).
- **Where each part is read:** copy is `theme.copy['key']` (all keys in `themes/types.ts`,
  defaults in `themes/default.ts`); Astro pages use `themeFor(Astro)`, Svelte uses
  `currentTheme()` from `themes/client.ts`. Components never test for a particular event.
  `EffectsCanvas` reads `effects`, `BarReveal` plays `sounds.revealStart/barLit`,
  `ChocolateBar` prints `barPrint` and the two taglines.
- **Adding a copy key:** add it to `Copy` in `types.ts` and a default in `default.ts`; then
  any event may override it.
- **Also themeable:** bar sleeve print (`barPrint`, gold foil shapes; Halloween adds a web,
  bat and two jack-o'-lanterns), straw-mode reveal copy and sounds (`reveal.straw*`), a glyph
  before each snack (`snacks.itemIcon`). Extra CSS can reach anything else.
- **Sound mute:** `SoundToggle.svelte` (stage header) flips `setMuted()` in `lib/sound.ts`;
  every sound goes through `getAudio()`, so one flag silences them all. Kept in localStorage.
- **Trick or treat** (a theme feature: only on while the theme provides `trickOrTreat` words,
  today Halloween). The room suggests and votes on **tricks** in the lobby (`Tricks.svelte`;
  `/api/suggest` and `/api/vote` take `kind: 'trick'`, stored in `game.tricks`). At the reveal
  `finalizePicking` sets `game.door` and `game.trick_pick` (`lib/trickOrTreat.ts`): **the winner
  never chooses**, the door comes from `sha256(draw_salt + ':door')` (one in `TRICK_ODDS` is a
  trick), so it is sealed until the reveal and recomputable afterwards. Treat = the usual prize.
  Trick = the top-voted trick (a house trick if nobody wrote any), then the prize anyway.
  `TrickOrTreat.svelte` shows the knock and the result on every screen; it never touches who wins.
- **Costume avatars** (`costumes: true` on a theme): each player gets a random costume emoji at
  join (`lib/costumes.ts`, `player.costume`), shown as their lobby avatar.
- **Rules:** gold stays the winner's colour; every animation respects
  `prefers-reduced-motion`; ambient layers are `position:fixed; pointer-events:none` and
  low contrast (the stage is projected).
- **Gotcha:** `.winner-name` is gold gradient on transparent text, so a `text-shadow`
  paints over it and tints it. Use `filter: drop-shadow` for glows there.

## Game lifecycle (state machine)

`game.state` moves through four phases. The whole UI keys off this value.

```
lobby ──(host starts, ≥2 online)──▶ picking ──(all picked)──▶ reveal ─▶ done
  ▲                                    │                        ▲          │
  │                          (bar mode)└──▶ unwrapping ─────────┘          │
  │                                     (every bar opened / host opens all)│
  └──────────────────────────(host restarts)──────────────────────────────┘
```

- **lobby** — players join via code, suggest + vote on the prize snack (and, on trick-or-treat themes, on tricks), host edits the cupboard. The votes sit **inside the lobby canvas, at its bottom** as two slim lines (`LobbyPhase` renders `VoteLine.svelte` twice: a strip of tap-to-vote pills that scrolls sideways, and a "+" that turns it into an input); the side snack column is dropped in the lobby (`.votes-in-stage`) and comes back in later phases. On a trick-or-treat theme the host can't start (and the lobby timer won't auto-start) until the room has written at least one trick (`MIN_TRICKS`, enforced in `api/start.ts` and `api/autostart.ts`, which resolve the theme from the request).
- **picking** — straws are generated server-side (`generateStraws`); each player clicks one. A 3‑2‑1‑GO countdown runs client-side; picking is blocked while it's active. When the second-to-last player picks, the last player is **auto-assigned** the only remaining straw (`api/pick.ts`).
- **reveal / done** — winner (the `100` straw holder) is computed, prize snack chosen, a leaderboard record is written. Host can mark which cupboard item was handed over ("give"), or restart.

## Identity & data model

- A player is identified by a `player_token` **cookie** (random hex, `getPlayerToken`/`setPlayerCookies` in `lib/game.ts`). No accounts.
- The **host/creator** is the first joiner (`creator_token`). Host-only actions: start, restart, edit cupboard, mark prize given.
- By default the host **only oversees** (`host_plays: false` on new games, lobby switch "I'm playing too"): they stay in `game.players` for identity and chat, but get no straw/bar and can't win. Anything that counts the draw goes through `drawEntries()`; `sanitiseState` leaves the host out of `players` and reports them in `host` instead, so client counts need no special-casing. Games without the field are treated as `host_plays: true`.
- **"Online"** = `last_seen` within `ONLINE_THRESHOLD` (30s). Games older than `GAME_TTL` (24h) are cleaned up lazily.

Persisted files (see `lib/types.ts` for full interfaces):
- `data/games/<CODE>.json` — one `Game` per game (players, straws, suggestions, chat, prize). Codes look like `CHOC-1234` (prefixes: CHOC/COCO/BEAN/WRAP).
- `data/leaderboard.json` — append-only list of `LeaderboardWin` records (powers leaderboard + fairness). **Mirrored to GitHub — see below.**
- `data/cupboard.json` — shared, global list of `CupboardItem` prizes (NOT per-game).

### Sealed draw and audit trail

So nobody has to take the draw on trust ("the first to open wins"):

- **Sealed draw.** `beginPicking` stores a random `draw_salt` and
  `draw_commit = sha256(JSON.stringify(straws) + ':' + salt)` (`drawCommit()`).
  `sanitiseState` sends the commit from Start and the salt only in
  `reveal`/`done`. The client prints the first 8 hex as a small `SEAL xxxx·xxxx`
  under the stage; after the reveal it links to `/verify/<CODE>`.
- **Audit trail.** Players get `picked_at` and (bar mode) `opened_at`, Unix
  **ms**. A bar opened by the host's resolve has no `opened_at`.
- **Both go into the leaderboard record** (`draw`, `audit` on `LeaderboardWin`),
  so they survive the 24h game file and are mirrored to GitHub.
  `/verify/<CODE>` (not linked in the nav, `noindex`) reads that record,
  recomputes the hash and shows the open log.

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
│   ├── verify/[code].astro   # Hidden proof page: sealed draw check + open log
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
│       ├── unwrap.ts          # POST → bar mode: record unwrap step; last step tells the holder what's inside
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
