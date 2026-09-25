---
target: in-game view (Game.svelte + phase components)
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
target_identity: "file:C:\\xampp\\htdocs\\Projects\\exfoliate\\chocolottery-new\\src\\components\\Game.svelte"
target_fingerprint: "sha256:34f3a10732d89394b4cc81723c0a7ae6c3f896b0c46b87fbeba2a2782503a8fd"
target_path: "C:\\xampp\\htdocs\\Projects\\exfoliate\\chocolottery-new\\src\\components\\Game.svelte"
timestamp: 2026-09-04T13-19-07Z
slug: src-components-game-svelte
---
Method: dual-agent (A: general-purpose design-review sub-agent · B: general-purpose detector/browser-evidence sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Phase pill and live counters are clear, but the 3-2-1-GO countdown only plays for clients present at the exact lobby→picking transition; a reconnect/refresh drops straight into picking |
| 2 | Match System / Real World | 4 | Straws, cupboard, drumroll copy — literal and consistent |
| 3 | User Control and Freedom | 1 | No leave-game affordance anywhere in the code; no un-vote from cupboard quick-pick chips; no way to remove a duplicate/ghost player |
| 4 | Consistency and Standards | 3 | Cupboard's remove-item uses a native `confirm()` dialog while the restart button uses an in-app arm/confirm pattern — two idioms for similar-risk actions |
| 5 | Error Prevention | 2 | Double-pick and double-vote are blocked, but the 30s auto-resolve silently assigns a straw with no distinct "you were auto-assigned" messaging |
| 6 | Recognition Rather Than Recall | 4 | "You" tags/highlighting on your straw, avatar, and nudge-row position — consistently applied |
| 7 | Flexibility and Efficiency | 0 | Zero keyboard support for either core interaction (straw pick, vote); a11y lint explicitly suppressed rather than fixed |
| 8 | Aesthetic and Minimalist Design | 3 | Three-column layout stays legible; some de-emphasized text drops to 40-55% alpha on the dark stage |
| 9 | Error Recovery | 2 | Failed pick silently no-ops with no toast; rejoin-from-new-context creates an undeduped duplicate player (reproduced live) |
| 10 | Help and Documentation | 3 | No explicit help text, but phase micro-copy carries the "what do I do" weight — works for this surface, with a gap for players dropped straight into picking |
| **Total** | | **25/40** | **Acceptable (62.5%)** |

## Design Specificity Verdict

**LLM assessment**: Genuinely authored for the premise, not a generic lobby/voting template. Copy voice throughout ("It's just a straw. With life-altering consequences.", "Pam would never. Be Pam. Or don't.", "(Dwight, no beets.)"), tone-based countdown beeps with rising pitch, a straw-height reveal animation with a physical "cup" prop, and confetti/tears effects keyed to win/lose. The "You missed this round" excluded-banner is a specific, empathetic answer to a real multiplayer failure mode (phone backgrounded during start) rather than a blank/broken state.

**Deterministic scan**: `detect.mjs` (static/AST scan) was clean across all 10 component files. The live browser overlay found real issues: undersized text (10.8px) recurring on snack labels, straw tags, and give-card labels; and — geometrically confirmed, not a judgment call — a mobile-width text overflow on the lobby's "N ready. Press Start when everyone's in." status line, overflowing its box by 189px. The overlay also flagged `ai-color-palette` (purple/cyan gradient avatar backgrounds); these are algorithmically generated per-player from a name hash (`avatarColor()`), not a designed palette choice, so I'm treating that flag as a false positive for "is this generic AI slop" — though see the Priority Issues below, because that same hash-based generation does create a real, separate contrast problem.

**Distinct methodologies, same underlying concern**: the detector reported very low per-element contrast ratios (e.g. 1.1:1) for player names on the lobby "stage," which is likely a background-misattribution artifact (comparing against the page's cream background rather than the dark stage these elements actually render on — the stage background isn't a simple ancestor `background-color` the detector's per-element lookup would catch). Assessment A independently found the same *area* of concern by reading the literal committed CSS: some stage text (offline player names, phase quips) is set to 40-55% alpha cream-on-dark, which is a real, source-verified legibility risk distinct from the detector's specific (likely wrong) numbers. Treating the detector's raw stage-text ratios as unreliable, but the underlying low-alpha-text concern as real.

## Overall Impression

This is the more ambitious surface of the two critiqued today, and it mostly delivers on its premise — the countdown-to-reveal arc is genuinely well-built as a tension device. But it has the rough edges of a surface built for the happy path: no player can pick a straw or vote without a mouse (P0), a failed pick just does nothing, and rejoining from a new device/browser silently creates a duplicate "ghost" player with no way to reconcile it — all things a real multi-person, cross-device office game will hit routinely, not as edge cases.

## What's Working

1. **Copy voice is load-bearing, not decorative** — "Locked in. Waiting for N more brave souls," the six rotating picking-phase quips, and "🥁 The drumroll, please…" do real work signaling phase and softening a polling UI's sterility, without breaking the office-anxiety register.
2. **Recognition over recall, consistently applied** — "you" tags appear on your straw, your avatar, and your position in the non-voter nudge row. A player never has to remember which entry was theirs.
3. **The "missed this round" excluded-banner** is a specific, empathetic answer to a real failure mode (backgrounded phone during start) instead of leaving that player looking at a broken state.

## Priority Issues

- **[P0] Straw-picking and vote-upvoting are entirely mouse/touch-only.** `PickingPhase.svelte` (straws) and `Snacks.svelte` (vote targets) both use `<div onclick>` with the a11y lint explicitly suppressed (`svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions`) rather than fixed — no `role`, `tabindex`, or key handler.
  - **Why it matters**: this blocks the game's one core action for any keyboard-only or switch-access player. Not degraded — impossible.
  - **Fix**: make straws and vote targets real `<button>` elements, or add `role="button" tabindex="0"` + an Enter/Space handler. The click logic already exists; this is a markup fix.
  - **Suggested command**: `/impeccable audit`

- **[P1] No way to leave a game, and no dedupe on rejoin — reproduced live.** Confirmed via source grep (zero leave/kick code in `src/`) and reproduced directly: joining from a second browser context with a stale remembered name creates a second, undeduped player under the same display name, sitting in the roster/pick-count/vote-count with no reconciliation path until the 24h TTL.
  - **Why it matters**: this is a routine occurrence for a real office game (people switch devices, clear cookies, or reload in a new tab), not a rare edge case — and it visibly pollutes the roster for everyone else in the game.
  - **Fix**: at minimum, dedupe join by name within a game, or give the host a way to remove an offline/duplicate player.
  - **Suggested command**: `/impeccable harden`

- **[P1] Silent no-op on a failed straw pick.** `handleStrawClick` returns early with zero feedback when a straw is already taken — a fast double-click or a click landing a beat after another player's pick shows literally nothing happening.
  - **Why it matters**: on the game's single riskiest, most time-pressured click, giving no explanation reads as broken, not "someone beat you to it."
  - **Fix**: surface a toast via the already-wired `Toaster` component.
  - **Suggested command**: `/impeccable clarify`

- **[P1] Mobile-width text overflow on the lobby status line — geometrically confirmed, not a judgment call.** `span.phase-detail` ("N ready. Press Start when everyone's in.") overflows its container by 189px at 375px viewport width.
  - **Why it matters**: this is the lobby's primary status line — the thing that tells a host whether they can start — breaking on the exact viewport width most players will actually be using for a spontaneous office game.
  - **Fix**: allow the line to wrap, or shorten it responsively below a breakpoint.
  - **Suggested command**: `/impeccable adapt`

- **[P2] The countdown ceremony (3-2-1-GO) isn't guaranteed for every player.** It's gated purely on the client having observed `prevPhase === 'lobby'` immediately before `picking`; a refresh or reconnect at the transition boundary skips straight to the picking grid with none of the buildup.
  - **Why it matters**: the countdown is the product's own tension-building device for its highest-stakes moment — skipping it by accident (not by design) flattens the one moment the product exists to deliver, for exactly the player who stepped away for ten seconds.
  - **Fix**: derive "show the countdown" from a server-provided transition timestamp (e.g. show it while `now - phase_started_at < countdown_duration`) instead of client-observed phase history, so it's reproducible regardless of poll timing.
  - **Suggested command**: `/impeccable harden`

## Persona Red Flags

**Alex (Power User)**: zero keyboard shortcuts or accelerators anywhere — stuck clicking every straw and vote target with a mouse. As host, has to actively babysit the lobby timer with no single-key "start now" affordance beyond the primary button already being there.

**Sam (Accessibility-Dependent)**: cannot pick a straw at all via keyboard (P0 above) — a hard blocker on the primary task, not a degraded experience. Low-alpha stage text (verified in source: 40-55% alpha cream-on-dark for offline names and quips) is a plausible contrast failure worth a formal check. Straw "taken" status is conveyed only via a name tag and CSS class, with no `aria-disabled` or accessible-name change for screen reader users.

**Riley (Stress Tester)**: the 30s auto-resolve fired mid-review while reading the roster/cupboard for ~15 seconds — three of four straws auto-assigned with only a small, easy-to-miss `⏳ 0:0X` countdown, especially when a modal (e.g. Cupboard) is open on top of it. Rapid rejoin/refresh reliably produces duplicate roster entries under realistic conditions (a network blip, switching laptop to phone mid-game), not an edge case.

## Minor Observations

- Recurring undersized functional text (10.8px, below the 11px floor) on snack quick-pick labels, straw name tags, and the give-card "From the cupboard" label — same issue class as the homepage's undersized text, worth fixing together.
- Avatar background colors are generated from a per-name hash (`avatarColor()`); some resulting combinations (e.g. white initial on a light cyan/green avatar) measure below the 3:1 large-text contrast floor. The palette itself isn't the problem (not generic AI slop, as the detector's `ai-color-palette` flag implied) — the *generation* not guaranteeing contrast against white text is the real, narrower issue.
- Cupboard's remove-item action uses a native `confirm()` dialog while the restart button elsewhere in the same view uses an in-app arm/confirm pattern — worth reusing one idiom.
- The CTA button contrast issue the detector also caught here ("New game," "Mark given" buttons, 2.4:1) is the same `.btn-primary` class already fixed for the homepage critique — that fix covers these instances too; no separate action needed.
- Detector flags likely explainable, no action needed: `gpt-thin-border-wide-shadow` on modal/cup cards reads as a consistent, deliberate elevation treatment across the app, not slop; `clipped-overflow-container` on the cup-stage wasn't reproducible as a visible defect in this review.
- `avatarColor()`/`avatarInitial()` are duplicated verbatim across three components — not a UX issue, but worth a shared util if touched again.

## Questions to Consider

- If the countdown and the 30s auto-resolve are both meant to build tension, why is the ceremony skippable by accident while the punishment (silent auto-assignment) never is — shouldn't the highest-stakes moment be the *most* guaranteed to render consistently?
- The whole premise is "who has to buy chocolate" for a small, known group of coworkers — given that, is a stateless-cookie join model (no accounts, no host-side roster control) the right tradeoff, or is the duplicate-ghost-player problem a predictable cost a lightweight "claim your existing seat" flow would avoid?
- Snack voting, the cupboard, and chat stay fully visible during the picking phase's most tense moment — is competing with that chrome the intended experience, or would de-emphasizing the side panels during the countdown/pick window sharpen the "one thing at a time" moment the brief is built around?
