---
target: unwrap phase golden-ticket suspense
total_score: 23
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:C:\\xampp\\htdocs\\Projects\\exfoliate\\chocolottery-new\\src\\components\\UnwrapPhase.svelte"
target_fingerprint: "sha256:66dd7f7999d45b53480caad7fed066e7edeb9b68e7e80aeeda7e0e8d09972923"
target_path: "C:\\xampp\\htdocs\\Projects\\exfoliate\\chocolottery-new\\src\\components\\UnwrapPhase.svelte"
timestamp: 2026-10-07T11-13-07Z
slug: src-components-unwrapphase-svelte
---
Method: dual-agent (A: design review · B: detector + browser evidence)

Target: unwrap phase (UnwrapStage, UnwrapPhase, BarReveal) after the sealed-golden-ticket change.

Score 23/32 (heuristics 7 and 10 n/a: single-gesture party game). Rating: low end of Good.

Priority issues
- [P1] Auto-hop to the board left the writing in the wrong screen: the held screen lives ~700ms. Fixed in this pass: suspense lines moved into the board headline; opened tile no longer dimmed.
- [P1] Board legibility at wall/phone sizes: .board-name 10.5px, .board-status 8.4px, 40 players overflow the stage at 1440x900. Open.
- [P1] Gold halo on the board's leading bar read as a tell. Fixed in this pass (cream).
- [P2] Reduced motion collapses the drumroll to 0ms; board transitions not covered. Open.
- [P2] Last wrapped player's phone is silent; aria-live headline re-announces on every poll. Open.

Detector: 0 findings on the 5 changed .svelte files; 4 of 203 global.css findings land on new lines (token drift only: #0A0210, 2.8rem, 1rem, 3.6rem clamp). Golden-ticket leak check: clean.
