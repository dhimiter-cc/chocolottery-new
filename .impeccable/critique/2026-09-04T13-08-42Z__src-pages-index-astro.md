---
target: homepage (src/pages/index.astro)
total_score: 26
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 2
target_identity: "file:C:\\xampp\\htdocs\\Projects\\exfoliate\\chocolottery-new\\src\\pages\\index.astro"
target_fingerprint: "sha256:53790224d77f550b6debbfff4e883fd97206c52b2d2a113ea66eda57ed2ca313"
target_path: "C:\\xampp\\htdocs\\Projects\\exfoliate\\chocolottery-new\\src\\pages\\index.astro"
timestamp: 2026-09-04T13-08-42Z
slug: src-pages-index-astro
---
Method: dual-agent (A: general-purpose design-review sub-agent · B: general-purpose detector/browser-evidence sub-agent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good busy states ("Joining…", "Creating…"), but the join error text has no `aria-live`/`role="alert"` |
| 2 | Match System / Real World | 4 | Consistent office-party voice throughout ("code," "straw," "victim") |
| 3 | User Control and Freedom | 2 | Escape/backdrop-click close all 3 modals, but focus is never trapped or returned to the trigger; no `role="dialog"`/`aria-modal` anywhere |
| 4 | Consistency and Standards | 3 | Site-wide vocabulary is consistent, but the Join flow's polished inline errors sit next to the Create flow's bare `alert()` on the same page |
| 5 | Error Prevention | 3 | Inline validation + code normalization (paste/blur/uppercase) prevents a real failure class; docked for no visual error state on invalid fields |
| 6 | Recognition Rather Than Recall | 3 | Remembered-name banner is a strong recall-avoidance pattern; Fairness table (60+ rows live) has no find-me/search |
| 7 | Flexibility and Efficiency | 2 | Shared-link code parsing is a real power-user accommodation; timer-preset buttons carry `role="radiogroup"` but no arrow-key nav or `aria-checked` |
| 8 | Aesthetic and Minimalist Design | 3 | Landing page is lean (one CTA per panel); Fairness modal's 5-column table is dense once populated |
| 9 | Error Recovery | 3 | Error copy is specific per failure mode (404 vs 409 vs format); no in-place recovery helper beyond retry |
| 10 | Help and Documentation | n/a | Persuade surface — no help affordance expected |
| **Total** | | **26/36** | **Good (72%)** |

## Design Specificity Verdict

**LLM assessment**: This clears the "generic signup page" bar convincingly. Copy voice is consistent and specific throughout — "Watch productivity plummet," "No HR forms. No team-building exercises," verdict labels like "🎰 Suspiciously Lucky" / "😢 Chronically Unlucky." The join-form error copy is where this shows most: "We need a name to put on the straw" and "Almost — codes need the word at the front too, like CHOC-1234" read as written by someone who cared, not boilerplate. The one lapse: the Create-game timer modal is functionally a generic duration picker that could belong to any scheduling tool.

**Deterministic scan**: `detect.mjs` on the source file itself was clean (exit 0, no findings) — the file has no obviously slop-templated markup. The live browser overlay found 9 element-groups / 13 individual findings across states, most notably: `gradient-text` on the `H1` and `BODY`, `cream-palette` flagged on `BODY`, and a `kicker-above-heading` pattern ("New feature" above "Fairness Check is here"). Weighing these against Assessment A's direct visual inspection: the warm cream/parchment palette and gradient title are the product's established identity (parchment-themed chocolate lottery), not generic AI slop — I'm treating those as false positives for *this* product rather than real issues. The `kicker-above-heading` pattern is worth a second look (it's a recognized generic-AI tell) but reads consistently with the rest of the voice here, so it's a judgment call, not a clear defect — flagged below as a minor item rather than a priority fix.

**Genuinely confirmed by both assessments independently**: the primary CTA buttons (`Create a game`, `Join the game`) measure **2.4:1 text contrast against a required 4.5:1** — Assessment A found this via direct inspection, Assessment B's detector found the identical ratio via computed styles. Two independent methods landing on the same number is strong signal — this is real, not a false positive.

## Overall Impression

The join/create moment is handled with real care for the underlying anxiety ("am I about to spam my whole team") — reassuring copy, forgiving code-paste parsing, and a genuinely well-designed remembered-name pattern. The biggest gap is that the polish is uneven: the Join flow (just fixed) got a full validation/error treatment, while Create still fails with a bare native `alert()`, and neither flow gives failed inputs any visual (not just textual) error state. The CTA contrast failure is the most consequential single fix — it affects the page's only two conversion actions for every visitor.

## What's Working

1. **Code normalization/forgiveness** — accepts `choc1234`, `CHOC 1234`, a full pasted invite URL, or lowercase, and always shows the user exactly what will be submitted before submission. Directly prevents the "silent failure" bug class the join fix was addressing.
2. **Remembered-name banner with explicit escape hatch** — "Joining as **Casey** · not you?" is a well-designed recognition-over-recall pattern that explicitly anticipates the shared-laptop-in-the-kitchen case.
3. **Voice-consistent, failure-specific error copy** — each validation failure and each server error code (404 vs 409) gets distinct, in-character copy rather than one generic message. Unusually thorough for a low-stakes internal tool.

## Priority Issues

- **[P1] Primary CTA buttons fail text contrast (2.4:1, need 4.5:1) — confirmed independently by both assessments.** Both `.btn-primary` buttons render white text over the `--accent`→`--accent-deep` gradient (`#E89817`→`#B6730A`). This affects the page's only two conversion actions for every visitor, not an edge case.
  - **Why it matters**: WCAG AA failure; low-vision users may not be able to read "Create a game" or "Join the game" at all.
  - **Fix**: darken the gradient stops, or switch button text to `--text` (dark, `#2A1F12`), and re-verify against the *lightest* rendered pixel of the gradient, not the flat hex.
  - **Suggested command**: `/impeccable audit`

- **[P1] No visual error state or `aria-live` on the Join form.** After a failed submit, `#join-code`/`#join-name` never get a red border, `aria-invalid`, or focus distinction — the only signal is plain text below the button, which a screen reader won't announce and a fast-scanning sighted user can miss.
  - **Why it matters**: Screen-reader users get zero feedback on failure; sighted users retrying quickly can miss why nothing happened.
  - **Fix**: toggle an `.invalid` class + `aria-invalid="true"` + `aria-describedby="join-error"` on the offending field; mark `#join-error` `role="alert"` or `aria-live="polite"`.
  - **Suggested command**: `/impeccable audit`

- **[P2] Create-game flow's error handling is a bare native `alert()`, sharply inconsistent with Join's polished inline errors — on the same page, for the page's other primary action.**
  - **Why it matters**: Breaks Heuristic 4 (Consistency) directly; a user who just experienced Join's careful error copy gets a jarring native browser dialog if Create fails instead.
  - **Fix**: give Create-game the same inline error pattern (styled message, no page-blocking dialog, button re-enables) already built for Join.
  - **Suggested command**: `/impeccable harden`

- **[P2] Functional text below the 11px legibility floor in two places — caught by the detector, human-verifiable.** The "New feature"/"Good to know" announcement badges render at 10.8px; the Fairness table's 5 column sub-captions (e.g. "click a row to see game history") render at 10.5px.
  - **Why it matters**: Below-floor text is a real legibility problem, especially for the sub-captions, which carry actual explanatory content, not just decoration.
  - **Fix**: bump both to ≥11px; consider whether the sub-captions need to be persistently visible at all vs. a tooltip/info-icon pattern.
  - **Suggested command**: `/impeccable typeset`

- **[P2] Modals have no dialog semantics or focus management.** None of the three modals (`#create-modal`, `#announce-modal`, `#fairness-modal`) carry `role="dialog"`/`aria-modal="true"`; focus is never moved into the modal on open or restored to the trigger button on close (confirmed: `document.activeElement` lands on `<body>` after closing Fairness with Escape).
  - **Why it matters**: Keyboard and screen-reader users lose their place after closing any modal.
  - **Fix**: on open, focus the modal card (`tabindex="-1"`) or its first interactive element; store/restore the previously-focused element on close.
  - **Suggested command**: `/impeccable audit`

## Persona Red Flags

**Jordan (Confused First-Timer)**
- Lands mid-flow into a 2-step feature-announcement modal about "Fairness Check" before doing anything — a first-time visitor has no baseline for step 2's "here's what changed in our data model" framing.
- The `CHOC-1234` placeholder in the code field is styled close enough to real input text that a first pass could read it as pre-filled (mitigated by an error message, but that's recovery, not prevention).
- No visible path from "Join an existing round" to "how do I get a code" if Jordan doesn't have one yet.

**Riley (Deliberate Stress Tester)**
- Pasting a full shared link (`http://host/game/CHOC-1234`) correctly extracts the code — held up.
- Bare 4-digit input (`1234`) correctly triggers the tailored "codes need the word at the front too" message — held up.
- Break: after any failed submit, no field gets distinguishing visual treatment — rapid-fire invalid submissions give no reinforcing signal beyond the text line.
- Break: clicking "not you?" clears the visible name field but doesn't clear the stored `localStorage` value until a new name is actually submitted — if abandoned mid-way, the stale name persists for the next visit, undermining the shared-laptop scenario the feature exists for.

**Casey (Distracted Mobile User)**
- At 375px, the two-panel grid collapses cleanly to one column, no horizontal scroll, ~44px+ tap targets — held up.
- Risk: the feature-announcement modal takes close to full viewport height across two sequential screens before Casey can reach the form underneath — two extra taps (Continue → Close) before the actual task, with no skip-both option from step 1.
- `autocapitalize="characters"` on the code input is a good mobile-specific touch that benefits Casey without friction.

## Minor Observations

- `role="radiogroup"` on the timer-preset picker has no `role="radio"`/`aria-checked` on children and no arrow-key roving-tabindex — either drop the ARIA role or implement it properly.
- Detector flagged `gradient-text` (H1, body) and `cream-palette` (body) — judged as intentional brand identity (parchment/chocolate theme), not generic slop; no action recommended.
- `kicker-above-heading` pattern ("New feature" above "Fairness Check is here") is a recognized generic-AI tell per the detector, but reads consistently with the page's established voice — a judgment call the team should make deliberately rather than by default.
- Paragraph line-length runs ~88–125 characters in the Fairness and timer modals (aim for <80) — minor readability drag, not urgent.
- Detector's `layout-transition` finding ("transition: height" on BODY) couldn't be traced to a specific source rule by Assessment B — likely a modal open/close transition misattributed to `<body>`, not a real body-level animation issue.
- Detector findings for the announcement/Fairness modal markup persisted in scans taken while those modals were visually closed — the detector doesn't appear to filter by visibility (`hidden`/`display:none`), so closed-modal findings aren't evidence of a visible problem; treat as scanner limitation, not a defect.
- Footer "The Chocolate Industrial Complex 🏭" link duplicates the header's "Leaderboard →" link to the same destination — harmless redundancy.
- No `prefers-color-scheme: dark` handling anywhere in `global.css` — confirmed by forcing dark mode; the page renders unchanged. Light-only appears to be a deliberate choice, not an oversight, but worth confirming.

## Questions to Consider

- If the Fairness table is meant to be a fun, low-stakes aside, is a 60-row unsorted table still "fun," or does it become the thing people bounce off once every office has played a few months of rounds?
- The Join flow's error handling is meaningfully more polished than Create's bare `alert()` — was that an intentional prioritization (since Join was the reported bug), or should Create get the same treatment now?
- Given the original bug was a silent `localStorage`-throw failure, is there a plan for any automated regression coverage of that failure mode, or does the safety net rely entirely on the code comment as documentation?
