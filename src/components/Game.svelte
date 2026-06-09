<script lang="ts">
  import type { GameStateResponse } from '../lib/types.js';
  import EffectsCanvas from './EffectsCanvas.svelte';
  import LobbyPhase from './LobbyPhase.svelte';
  import PickingPhase from './PickingPhase.svelte';
  import RevealPhase from './RevealPhase.svelte';
  import Snacks from './Snacks.svelte';
  import Chat from './Chat.svelte';
  import Cupboard from './Cupboard.svelte';

  let {
    code,
    initialToken = null,
    alreadyJoined = false,
    presetName = '',
  }: {
    code: string;
    initialToken?: string | null;
    alreadyJoined?: boolean;
    presetName?: string;
  } = $props();

  let gameState = $state<GameStateResponse | null>(null);
  let joined = $state(alreadyJoined);
  let playerName = $state(presetName);
  let joinError = $state('');
  let joinLoading = $state(false);
  let showCupboard = $state(false);
  let chatOpen = $state(false);
  let copied = $state(false);
  let restartArmed = $state(false);
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let giveSelectId = $state('');
  let giveError = $state('');

  let effectsCanvas: ReturnType<typeof EffectsCanvas> | null = $state(null);

  // ── Sound system ──────────────────────────────────────────────────────────
  let audioCtx: AudioContext | null = null;

  function getAudio(): AudioContext | null {
    if (audioCtx) return audioCtx;
    try { audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
    catch { audioCtx = null; }
    return audioCtx;
  }

  function tone(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.15, when = 0) {
    const ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  function playDrumroll(durationMs: number) {
    const ticks = Math.floor(durationMs / 55);
    for (let i = 0; i < ticks; i++) tone(520, 0.06, 'triangle', 0.08, i * 0.055);
  }

  function playWinFanfare() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.18, 'triangle', 0.2, i * 0.18));
    tone(1318.51, 0.6, 'triangle', 0.25, 4 * 0.18);
  }

  function playLoseTrombone() {
    const ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(330, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 1.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.15);
  }

  function playRisingRumble() {
    const ctx = getAudio();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 3);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 3.1);
  }

  const sounds = { playDrumroll, playWinFanfare, playLoseTrombone, playRisingRumble };

  // ── Avatar helpers ────────────────────────────────────────────────────────
  function avatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    const hue = ((h % 360) + 360) % 360;
    return `linear-gradient(160deg, hsl(${hue} 70% 60%), hsl(${(hue + 30) % 360} 60% 38%))`;
  }

  // ── Polling ───────────────────────────────────────────────────────────────
  $effect(() => {
    if (!joined) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/state?code=${code}`);
        if (res.ok) gameState = await res.json();
      } catch {}
    }, 1000);
    const heartbeat = setInterval(async () => {
      try {
        await fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
      } catch {}
    }, 5000);
    // Initial poll
    fetch(`/api/state?code=${code}`).then(r => r.ok ? r.json() : null).then(d => { if (d) gameState = d; }).catch(() => {});
    return () => { clearInterval(poll); clearInterval(heartbeat); };
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  async function handleJoin(e: SubmitEvent) {
    e.preventDefault();
    const name = playerName.trim();
    if (!name) return;
    joinLoading = true;
    joinError = '';
    try {
      const res = await fetch('/api/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name }),
      });
      if (res.ok) {
        joined = true;
      } else {
        const data = await res.json().catch(() => ({}));
        joinError = data?.error || 'Failed to join';
      }
    } catch {
      joinError = 'Network error';
    } finally {
      joinLoading = false;
    }
  }

  async function handleStart() {
    if (!gameState) return;
    try {
      const res = await fetch('/api/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.error) actionError = data.error;
    } catch { actionError = 'Could not start'; }
  }

  async function handlePick(index: number) {
    await fetch('/api/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, straw_index: index }),
    });
  }

  async function handleRestart() {
    if (!restartArmed) {
      restartArmed = true;
      restartTimer = setTimeout(() => { restartArmed = false; restartTimer = null; }, 4000);
    } else {
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
      restartArmed = false;
      try {
        await fetch('/api/restart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
      } catch {}
    }
  }

  async function handleGive() {
    if (!giveSelectId) return;
    giveError = '';
    try {
      const res = await fetch('/api/cupboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'give', code, id: giveSelectId }),
      });
      const data = await res.json();
      if (data.error) giveError = data.error;
    } catch { giveError = 'Could not save'; }
  }

  async function handleUngive() {
    giveError = '';
    try {
      const res = await fetch('/api/cupboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ungive', code }),
      });
      const data = await res.json();
      if (data.error) giveError = data.error;
    } catch { giveError = 'Could not undo'; }
  }

  function copyShareUrl() {
    const url = `${window.location.origin}/game/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 2000);
      showToast('Link copied. Share. Conquer.');
    });
  }

  function showToast(msg: string) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  let phase = $derived(gameState?.state ?? 'lobby');
  let isHost = $derived(gameState?.is_host ?? false);
  let inGame = $derived(gameState?.in_game ?? false);
  let showRestartBtn = $derived(isHost && inGame && phase !== 'lobby');
  let actionError = $state('');

  let actionBtnText = $derived.by(() => {
    if (!gameState) return 'Start the lottery';
    if (phase === 'lobby') {
      const onlineCount = gameState.players.filter(p => p.online).length;
      return onlineCount < 2 ? 'Need 2+ players' : `Start the lottery (${onlineCount})`;
    }
    if (phase === 'reveal' || phase === 'done') return 'New game';
    return '';
  });

  let actionBtnDisabled = $derived.by(() => {
    if (phase === 'lobby') {
      const onlineCount = gameState?.players.filter(p => p.online).length ?? 0;
      return onlineCount < 2;
    }
    return false;
  });

  let showActionBtn = $derived(isHost && (phase === 'lobby' || phase === 'reveal' || phase === 'done'));

  // Track previous phase for countdown
  let prevPhase = $state<string | null>(null);
  let countdownActive = $state(false);

  $effect(() => {
    const current = phase;
    if (prevPhase === 'lobby' && current === 'picking' && !countdownActive) {
      runCountdown();
    }
    prevPhase = current;
  });

  function runCountdown() {
    const cupStageEl = document.querySelector('.cup-stage') as HTMLElement | null;
    if (!cupStageEl) return;
    countdownActive = true;
    const existing = cupStageEl.querySelector('.countdown-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    cupStageEl.appendChild(overlay);
    cupStageEl.classList.add('countdown');

    const steps = [
      { text: '3', freq: 440, dur: 700 },
      { text: '2', freq: 494, dur: 700 },
      { text: '1', freq: 554, dur: 700 },
      { text: 'GO!', freq: 880, dur: 700, big: true },
      { text: 'Pick your straw', freq: 0, dur: 900, small: true },
    ];
    let i = 0;
    function tick() {
      if (i >= steps.length) {
        overlay.remove();
        cupStageEl!.classList.remove('countdown');
        countdownActive = false;
        return;
      }
      const step = steps[i++];
      overlay.textContent = step.text;
      overlay.classList.toggle('big', !!(step as any).big);
      overlay.classList.toggle('small', !!(step as any).small);
      overlay.classList.remove('pop');
      void overlay.offsetWidth;
      overlay.classList.add('pop');
      if (step.freq) tone(step.freq, (step as any).big ? 0.35 : 0.12, (step as any).big ? 'triangle' : 'square', (step as any).big ? 0.20 : 0.14);
      setTimeout(tick, step.dur);
    }
    tick();
  }

  let phaseDetailText = $state('Waiting for the brave to gather…');

  $effect(() => {
    if (!gameState) { phaseDetailText = 'Waiting for the brave to gather…'; return; }
    const onlineCount = gameState.players.filter(p => p.online).length;
    if (phase === 'lobby') {
      if (!isHost) {
        const host = gameState.players.find(p => p.token === gameState!.creator_token);
        phaseDetailText = onlineCount < 2
          ? `${onlineCount} here. Waiting for more.`
          : `${onlineCount} ready. Waiting for ${host?.name ?? 'the host'} to start.`;
      } else {
        phaseDetailText = onlineCount < 2
          ? `${onlineCount} here. Send the link to your colleagues.`
          : `${onlineCount} ready. Press Start when everyone's in.`;
      }
    } else if (phase === 'picking') {
      const pickedCount = gameState.players.filter(p => p.picked).length;
      const remaining = gameState.players.length - pickedCount;
      if (remaining === 0) phaseDetailText = '🥁 The drumroll, please…';
      else if (gameState.my_straw == null) phaseDetailText = '';
      else phaseDetailText = `Locked in. Waiting for ${remaining} more brave soul${remaining === 1 ? '' : 's'}.`;
    } else if (phase === 'reveal' || phase === 'done') {
      const winner = gameState.players.find(p => p.token === gameState!.winner_token);
      phaseDetailText = winner ? `🍫 ${winner.name} wins.` : 'Round over.';
    }
  });

  let phaseDetail = $derived(phaseDetailText);

  // Stocked cupboard items for give-card
  let stockedItems = $derived((gameState?.cupboard ?? []).filter(i => i.stock > 0));
  let showGiveCard = $derived((phase === 'reveal' || phase === 'done') && (isHost || !!gameState?.prize_given_id));

  // Fairness modal
  let showFairness = $state(false);
  let fairnessLoaded = $state(false);
  let fairnessBody = $state('<p class="muted center">Loading…</p>');
  let fairnessNote = $state('');

  async function openFairness() {
    showFairness = true;
    if (fairnessLoaded) return;
    try {
      const res = await fetch('/api/fairness');
      const data = await res.json();
      fairnessLoaded = true;
      renderFairnessData(data);
    } catch {
      fairnessBody = '<p class="error center">Could not load fairness data.</p>';
    }
  }

  function renderFairnessData(data: any) {
    if (!data.players || data.players.length === 0) {
      fairnessBody = '<p class="muted center">No games played yet — nothing to check!</p>';
      return;
    }
    function fmtMonth(m: string) {
      if (!m) return '—';
      return new Date(m + '-02').toLocaleDateString('en', { month: 'short', year: 'numeric' });
    }
    const rows = data.players.map((p: any, i: number) => {
      const expected = p.expected_wins !== null ? p.expected_wins.toFixed(1) : '—';
      const score    = p.luck_score    !== null ? p.luck_score.toFixed(2)    : '—';
      const verdict  = p.verdict
        ? `<span class="fairness-verdict fairness-${p.verdict.class}">${p.verdict.emoji} ${p.verdict.label}</span>`
        : '<span class="fairness-verdict fairness-none">—</span>';
      const gameRows = (p.games || []).map((g: any) => `
        <div class="fg-row">
          <span class="fg-month">${fmtMonth(g.month)}</span>
          <span class="fg-players">👥 ${g.participants} players</span>
          <span class="fg-chance">1 in ${g.participants} &nbsp;·&nbsp; ${g.chance_pct}% chance</span>
          <span class="fg-result ${g.won ? 'fg-won' : 'fg-lost'}">${g.won ? '🍫 Won' : '✗ Lost'}</span>
        </div>`).join('');
      const detail = p.games?.length
        ? `<div class="fg-list">${gameRows}</div>`
        : '<p class="muted" style="margin:0;font-size:0.85rem;">No tracked games yet.</p>';
      return `
        <tr class="fairness-row" data-idx="${i}">
          <td><span class="fg-chevron">▸</span> ${p.name}</td>
          <td class="tc">${p.actual_wins}</td>
          <td class="tc">${expected}</td>
          <td class="tc">${score}</td>
          <td>${verdict}</td>
        </tr>
        <tr class="fairness-detail" id="fg-detail-${i}" hidden>
          <td colspan="5"><div class="fg-detail-inner">${detail}</div></td>
        </tr>`;
    }).join('');
    fairnessBody = `
      <table class="leaderboard fairness-table">
        <thead><tr>
          <th>Name<span class="th-sub">click a row to see game history</span></th>
          <th>Wins<span class="th-sub">times you've won</span></th>
          <th>Expected<span class="th-sub">based on players per game</span></th>
          <th>Luck score<span class="th-sub">wins ÷ expected</span></th>
          <th>Verdict<span class="th-sub">our unbiased assessment</span></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    const diff = data.total_games - data.tracked_games;
    fairnessNote = diff > 0
      ? `${diff} game${diff > 1 ? 's' : ''} predate participant tracking and are excluded from expected win calculations.`
      : '';
  }

  function attachFairnessHandlers() {
    document.querySelectorAll('.fairness-row').forEach((row: any) => {
      row.addEventListener('click', () => {
        const detail = document.getElementById('fg-detail-' + row.dataset.idx) as HTMLElement;
        const chevron = row.querySelector('.fg-chevron') as HTMLElement;
        const opening = detail.hidden;
        detail.hidden = !opening;
        chevron.textContent = opening ? '▾' : '▸';
        row.classList.toggle('fairness-row-open', opening);
      });
    });
  }

  $effect(() => {
    if (fairnessBody && fairnessBody.includes('fairness-row')) {
      setTimeout(attachFairnessHandlers, 0);
    }
  });

  // Chat drawer
  function openChatDrawer() { chatOpen = true; }
  function closeChatDrawer() { chatOpen = false; }
</script>

<!-- Join modal -->
{#if !joined}
  <div class="modal">
    <div class="modal-card">
      <h2>Join the round</h2>
      <p class="muted">Game <span class="stamp">{code}</span></p>
      <form onsubmit={handleJoin} style="margin-top:18px;">
        <label>Display name
          <input type="text" bind:value={playerName} maxlength="30" required placeholder="your name" autofocus>
        </label>
        <button type="submit" class="btn btn-primary" disabled={joinLoading || !playerName.trim()}>
          {joinLoading ? 'Joining…' : 'Join'}
        </button>
        {#if joinError}<p class="error">{joinError}</p>{/if}
      </form>
    </div>
  </div>
{/if}

<!-- Effects canvas -->
<EffectsCanvas bind:this={effectsCanvas} />

<!-- Main game layout -->
{#if joined}
  <div class="parchment game-room">
    <header class="game-head">
      <div>
        <h1 class="title small">chocolate.lottery</h1>
        <p class="muted">Game
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <span class="stamp" title="Click to copy share link" onclick={copyShareUrl}>
            {copied ? '✓ Copied!' : code}
          </span>
        </p>
      </div>
      <div class="head-actions">
        <button type="button" class="btn btn-ghost" onclick={openFairness}>⚖️ Fairness</button>
        <a href="/leaderboard" class="btn btn-ghost">Leaderboard</a>
        <a href="/" class="btn btn-ghost">Home</a>
      </div>
    </header>

    {#if gameState}
      <div class="game-grid">
        <!-- Snacks: left column on desktop -->
        <section class="panel snacks-panel">
          <Snacks state={gameState} {code} onOpenCupboard={() => (showCupboard = true)} />
        </section>

        <!-- Chat: right column on desktop, bottom drawer on mobile -->
        <section class="panel chat-panel" class:drawer-open={chatOpen} hidden={!inGame || undefined}>
          <Chat state={gameState} {code} onClose={closeChatDrawer} />
        </section>

        <!-- Stage: center on desktop, top on mobile -->
        <section class="panel stage-panel">
          <div class="phase-bar">
            <div class="phase-info">
              <span class="phase-pill {phase}">{phase.charAt(0).toUpperCase() + phase.slice(1)}</span>
              <span class="phase-detail">{phaseDetail}</span>
            </div>
            {#if showActionBtn}
              <button
                class="btn btn-primary big"
                disabled={actionBtnDisabled}
                onclick={phase === 'lobby' ? handleStart : () => { window.location.href = '/'; }}
              >
                {actionBtnText}
              </button>
            {/if}
          </div>

          {#if phase === 'lobby'}
            <div class="cup-stage" data-phase="lobby">
              <LobbyPhase state={gameState} />
              <div class="straws"></div>
              <div class="cup"></div>
            </div>
          {:else if phase === 'picking'}
            <div class="cup-stage" data-phase="picking">
              <PickingPhase state={gameState} onPick={handlePick} />
            </div>
          {:else if phase === 'reveal' || phase === 'done'}
            <div class="cup-stage" data-phase="reveal">
              <RevealPhase
                state={gameState}
                {sounds}
                onFireConfetti={(big) => effectsCanvas?.fireConfetti(big)}
                onFireTears={() => effectsCanvas?.fireTears()}
                onFireSparkles={() => effectsCanvas?.fireSparkles()}
              />
            </div>
          {/if}

          {#if actionError}<p class="error" style="margin: 10px 0 0;">{actionError}</p>{/if}

          <!-- Prize snack card -->
          {#if gameState.prize_snack && (phase === 'reveal' || phase === 'done')}
            <div class="prize-card">
              <div class="prize-label">🍫 Prize snack</div>
              <div class="prize-text">{gameState.prize_snack.text}</div>
              <div class="prize-meta">
                {gameState.prize_snack.random
                  ? 'picked at random — democracy failed'
                  : `${gameState.prize_snack.votes} vote${gameState.prize_snack.votes === 1 ? '' : 's'} · suggested by ${gameState.prize_snack.author_name}`}
              </div>
            </div>
          {/if}

          <!-- Give card (post-reveal, host) -->
          {#if showGiveCard}
            <div class="give-card">
              <div class="give-label">From the cupboard</div>
              {#if gameState.prize_given_id}
                <div class="give-status given">✓ {gameState.prize_given_name} was handed to the winner.</div>
              {:else}
                <div class="give-status">Host: which cupboard snack did the winner get?</div>
              {/if}
              {#if isHost}
                <div class="give-controls">
                  {#if !gameState.prize_given_id}
                    {#if stockedItems.length > 0}
                      <select bind:value={giveSelectId}>
                        {#each stockedItems as item}
                          <option value={item.id}>{item.name} (×{item.stock})</option>
                        {/each}
                      </select>
                      <button type="button" class="btn btn-primary" onclick={handleGive}>Mark given (−1)</button>
                    {:else}
                      <span class="muted" style="font-size:0.88rem;">Nothing in stock</span>
                    {/if}
                  {:else}
                    <button type="button" class="btn btn-ghost" onclick={handleUngive}>Undo</button>
                  {/if}
                </div>
                {#if giveError}<p class="error" style="margin: 8px 0 0;">{giveError}</p>{/if}
              {/if}
            </div>
          {/if}

          <!-- Restart button (host only) -->
          {#if showRestartBtn}
            <button
              class="restart-btn"
              class:armed={restartArmed}
              onclick={handleRestart}
            >
              {restartArmed ? 'Really restart? Click again to confirm' : '↺ restart game'}
            </button>
          {/if}
        </section>
      </div>
    {:else}
      <p class="muted center" style="padding: 40px;">Loading game…</p>
    {/if}
  </div>

  <!-- Mobile chat backdrop -->
  <div id="chat-backdrop" class="chat-backdrop" hidden={!chatOpen || undefined} onclick={closeChatDrawer}></div>
  <!-- Mobile chat FAB -->
  {#if inGame}
    <button
      class="chat-fab"
      aria-label="Open chat"
      onclick={openChatDrawer}
    >
      💬
      {#if gameState && gameState.chat.length > 0}
        <span class="chat-fab-dot"></span>
      {/if}
    </button>
  {/if}

  <!-- Cupboard modal -->
  {#if showCupboard && gameState}
    <Cupboard
      state={gameState}
      {code}
      open={showCupboard}
      onClose={() => (showCupboard = false)}
    />
  {/if}

  <!-- Fairness modal -->
  {#if showFairness}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal" onclick={(e) => { if (e.target === e.currentTarget) showFairness = false; }}>
      <div class="modal-card fairness-modal-card">
        <div class="section-head" style="margin-bottom:16px;">
          <h2>⚖️ Fairness Check</h2>
          <button type="button" class="btn btn-ghost" style="padding:4px 10px;" onclick={() => (showFairness = false)}>✕</button>
        </div>
        <p class="muted">Actual wins vs. statistically expected wins — based on how many players were in each game.</p>
        <div style="margin-top:16px;">{@html fairnessBody}</div>
        {#if fairnessNote}<p class="muted" style="font-size:0.8rem;margin-top:14px;">{fairnessNote}</p>{/if}
      </div>
    </div>
  {/if}
{/if}
