<script lang="ts">
  import EffectsCanvas from './EffectsCanvas.svelte';
  import LobbyPhase from './LobbyPhase.svelte';
  import PickingPhase from './PickingPhase.svelte';
  import RevealPhase from './RevealPhase.svelte';
  import BarPicking from './BarPicking.svelte';
  import UnwrapPhase from './UnwrapPhase.svelte';
  import BarReveal from './BarReveal.svelte';
  import Snacks from './Snacks.svelte';
  import Chat from './Chat.svelte';
  import Cupboard from './Cupboard.svelte';
  import Countdown from './Countdown.svelte';
  import Fairness from './Fairness.svelte';
  import GiveCard from './GiveCard.svelte';
  import GoldenTicket from './GoldenTicket.svelte';
  import PrizeStrip from './PrizeStrip.svelte';
  import Toaster from './Toaster.svelte';
  import { PRIZE, hasSeenTeaserToday, markTeaserSeenToday, isEventDay, isTeaseActive, hasEventPreviewParam } from '../lib/specialPrize.js';
  import { sounds } from '../lib/sound.js';
  import { UNWRAP_STEPS } from '../lib/bars.js';
  import { post } from '../lib/api.js';
  import { showToast } from '../lib/toast.svelte.js';
  import { GameConnection } from '../lib/gameConnection.svelte.js';
  import type { GameStyle } from '../lib/types.js';

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

  const REMEMBERED_NAME_KEY = 'chocolottery_player_name';
  const rememberedName = typeof localStorage !== 'undefined' ? localStorage.getItem(REMEMBERED_NAME_KEY) ?? '' : '';

  const conn = new GameConnection(code);
  let gameState = $derived(conn.state);
  let joined = $state(alreadyJoined);
  let playerName = $state(presetName || rememberedName);
  let joinError = $state('');
  // Skip the name form entirely when a remembered name exists — join right away.
  let autoJoining = $state(!alreadyJoined && !!rememberedName);
  let joinLoading = $state(autoJoining);
  let showCupboard = $state(false);
  let chatOpen = $state(false);
  let copied = $state(false);
  let restartArmed = $state(false);
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  let effectsCanvas: ReturnType<typeof EffectsCanvas> | null = $state(null);
  let countdownRef: ReturnType<typeof Countdown> | null = $state(null);

  // Sound engine lives in lib/sound.ts; `tone` (countdown) + `sounds` (reveal) are imported.

  // ── Avatar helpers ────────────────────────────────────────────────────────
  function avatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    const hue = ((h % 360) + 360) % 360;
    return `linear-gradient(160deg, hsl(${hue} 70% 60%), hsl(${(hue + 30) % 360} 60% 38%))`;
  }

  // ── Live connection ─────────────────────────────────────────────────────────
  // Polling + heartbeat + ETag/304 + adaptive cadence live in GameConnection.
  $effect(() => {
    if (!joined) return;
    conn.start();
    return () => conn.stop();
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  async function join(name: string) {
    joinLoading = true;
    joinError = '';
    try {
      const { ok, data } = await post('/api/join', { code, name });
      if (ok) {
        joined = true;
        localStorage.setItem(REMEMBERED_NAME_KEY, name);
      } else {
        joinError = data?.error || 'Failed to join';
        autoJoining = false;
      }
    } catch {
      joinError = 'Network error';
      autoJoining = false;
    } finally {
      joinLoading = false;
    }
  }

  function handleJoin(e: SubmitEvent) {
    e.preventDefault();
    const name = playerName.trim();
    if (!name) return;
    join(name);
  }

  // Join immediately with the remembered name, without showing the form.
  $effect(() => {
    if (autoJoining) join(playerName.trim());
  });

  async function handleStart() {
    if (!gameState) return;
    try {
      const { data } = await post('/api/start', { code });
      if (data.error) actionError = data.error;
      else conn.refresh();
    } catch { actionError = 'Could not start'; }
  }

  async function handlePick(index: number) {
    // A straw can be taken by someone else between this client's last poll
    // and the click landing — the server is the real source of truth here,
    // so a rejection needs its own feedback, not just the local pre-check.
    const { ok, data } = await post('/api/pick', { code, straw_index: index });
    if (!ok) showToast(data?.error === 'Straw already taken' ? "Someone beat you to that one" : 'Could not pick that straw');
    conn.refresh();
  }

  // Picking has no auto-timer, so if someone's genuinely AFK the host can
  // force the round to finish instead of it hanging forever. Same arm/confirm
  // pattern as restart — this randomly hands out the remaining straws.
  let resolveArmed = $state(false);
  let resolveTimer: ReturnType<typeof setTimeout> | null = null;
  async function handleForceResolve() {
    if (!resolveArmed) {
      resolveArmed = true;
      resolveTimer = setTimeout(() => { resolveArmed = false; resolveTimer = null; }, 4000);
    } else {
      if (resolveTimer) { clearTimeout(resolveTimer); resolveTimer = null; }
      resolveArmed = false;
      try {
        await post('/api/resolve', { code });
        conn.refresh();
      } catch { actionError = 'Could not resolve'; }
    }
  }

  // Give latecomers another 30s before the lobby auto-starts.
  async function handleExtend() {
    try {
      await post('/api/extend', { code });
      conn.refresh();
    } catch { actionError = 'Could not add time'; }
  }

  // Straws or chocolate bars for the next round. Lobby-only on the server too.
  async function handleStyle(next: GameStyle) {
    if (next === style) return;
    const { ok, data } = await post('/api/style', { code, style: next });
    if (!ok) showToast(data?.error ?? 'Could not switch');
    conn.refresh();
  }

  // Is the host in the draw? Off by default: the host runs the screen.
  async function handleHostPlays(next: boolean) {
    const { ok, data } = await post('/api/style', { code, host_plays: next });
    if (!ok) showToast(data?.error ?? 'Could not switch');
    conn.refresh();
  }

  async function handleRestart() {
    if (!restartArmed) {
      restartArmed = true;
      restartTimer = setTimeout(() => { restartArmed = false; restartTimer = null; }, 4000);
    } else {
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
      restartArmed = false;
      try {
        await post('/api/restart', { code });
        conn.refresh();
      } catch {}
    }
  }

  // For the host's QR code. Browser-only, so it's filled in after mount. When
  // the host's screen is in the event layout, the QR carries it along, so
  // phones scanning it land in the same full-screen view without anyone
  // typing a query string.
  let joinUrl = $state('');
  $effect(() => {
    joinUrl = `${window.location.origin}/game/${code}${eventLayout ? '?event' : ''}`;
  });

  function copyShareUrl() {
    const url = `${window.location.origin}/game/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 2000);
      showToast('Link copied. Share. Conquer.');
    });
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  let phase = $derived(gameState?.state ?? 'lobby');
  let style = $derived<GameStyle>(gameState?.style ?? 'straws');
  let bars = $derived(style === 'bars');
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

  // ── Timers ────────────────────────────────────────────────────────────────
  // Deadlines (Unix seconds) are authoritative on the server; the client just
  // ticks a local clock and counts down toward them. The lobby timer auto-starts
  // the round so we don't wait all day for joiners; picking gets a fixed short
  // window before straws auto-resolve.
  let nowTs = $state(Math.floor(Date.now() / 1000));
  $effect(() => {
    const id = setInterval(() => { nowTs = Math.floor(Date.now() / 1000); }, 1000);
    return () => clearInterval(id);
  });

  let onlineCount = $derived(gameState?.players.filter(p => p.online).length ?? 0);

  let lobbyDeadline = $derived(gameState?.lobby_deadline ?? null);
  let lobbyTimeLeft = $derived(
    phase === 'lobby' && lobbyDeadline != null ? Math.max(0, lobbyDeadline - nowTs) : null
  );

  // Lobby countdown hit zero with enough players → any client fires the
  // idempotent auto-start. The in-flight guard stops this client from spamming
  // while the poll catches up; the server no-ops duplicate/early calls.
  let autoStarting = $state(false);
  $effect(() => {
    if (phase === 'lobby' && lobbyTimeLeft === 0 && onlineCount >= 2 && !autoStarting) {
      autoStarting = true;
      post('/api/autostart', { code })
        .then(() => conn.refresh())
        .finally(() => { autoStarting = false; });
    }
  });

  $effect(() => {
    const current = phase;
    if (prevPhase === 'lobby' && current === 'picking') {
      countdownRef?.run();
    }
    prevPhase = current;
  });

  let phaseDetailText = $state('Waiting for the brave to gather…');

  $effect(() => {
    if (!gameState) { phaseDetailText = 'Waiting for the brave to gather…'; return; }
    const onlineCount = gameState.players.filter(p => p.online).length;
    if (phase === 'lobby') {
      if (!isHost) {
        phaseDetailText = onlineCount < 2
          ? `${onlineCount} here. Waiting for more.`
          : `${onlineCount} ready. Waiting for ${gameState.host?.name ?? 'the host'} to start.`;
      } else {
        phaseDetailText = onlineCount < 2
          ? `${onlineCount} here. Send the link to your colleagues.`
          : `${onlineCount} ready. Press Start when everyone's in.`;
      }
    } else if (phase === 'picking') {
      const pickedCount = gameState.players.filter(p => p.picked).length;
      const remaining = gameState.players.length - pickedCount;
      if (remaining === 0) phaseDetailText = '🥁 The drumroll, please…';
      else if (hostOnly) phaseDetailText = `${remaining} still to pick.`;
      else if (gameState.my_straw == null) phaseDetailText = '';
      else phaseDetailText = `Locked in. Waiting for ${remaining} more brave soul${remaining === 1 ? '' : 's'}.`;
    } else if (phase === 'unwrapping') {
      const wrapped = gameState.players.filter(p => p.unwrap < UNWRAP_STEPS).length;
      phaseDetailText = `${wrapped} bar${wrapped === 1 ? '' : 's'} still wrapped.`;
    } else if (phase === 'reveal' || phase === 'done') {
      const winner = gameState.players.find(p => p.token === gameState!.winner_token);
      phaseDetailText = winner
        ? (bars ? `🎟️ ${winner.name} found the golden ticket.` : `🍫 ${winner.name} wins.`)
        : 'Round over.';
    }
  });

  let phaseDetail = $derived(phaseDetailText);

  // This screen is the host's and the host isn't in the draw.
  let hostOnly = $derived(isHost && !(gameState?.host_plays ?? true));

  let showGiveCard = $derived((phase === 'reveal' || phase === 'done') && (isHost || !!gameState?.prize_given_id));

  // Fairness modal (rendered by <Fairness>, which fetches its own data)
  let showFairness = $state(false);

  // ── Golden ticket (MOVION special edition) ────────────────────────────────
  // Both flags are read once: the window only matters at page load, and nobody
  // is going to have the tab open across midnight into the outing.
  const ticketActive = isTeaseActive();
  const ticketIsEventDay = isEventDay();

  // Event-day layout: the room on the wall only needs the game. No nav header,
  // no snack votes or cupboard — the stage takes their space; the game code
  // moves onto the stage bar so the join link can still be copied. On the day
  // it's on from the first render; `?event` previews it on any other day, set
  // after mount so the server-rendered markup never disagrees with hydration.
  let eventLayout = $state(ticketIsEventDay);
  $effect(() => { if (hasEventPreviewParam()) eventLayout = true; });

  let ticketOpen = $state(false);
  let ticketMode = $state<'tease' | 'payoff'>('tease');

  let winnerName = $derived(
    gameState?.players.find(p => p.token === gameState?.winner_token)?.name ?? ''
  );

  function openTicket() {
    ticketMode = 'tease';
    ticketOpen = true;
  }

  // Anyone who opens a shared game link never sees the landing page's own
  // auto-open (GoldenTicketIsland) — so the game room shows it once itself,
  // right after joining. Same once-per-day gate, marked seen the moment it
  // auto-opens rather than on close.
  let teaseAutoFired = false;
  $effect(() => {
    if (!joined || !ticketActive || teaseAutoFired) return;
    teaseAutoFired = true;
    if (!hasSeenTeaserToday()) {
      markTeaserSeenToday();
      ticketMode = 'tease';
      ticketOpen = true;
    }
  });

  // On the day itself the ticket lands on the winner — but only once
  // <RevealPhase> has finished its own ~4.1s sequence, so the two don't collide.
  let payoffTimer: ReturnType<typeof setTimeout> | null = null;
  let payoffFired = false;

  $effect(() => {
    const current = phase;
    const hasWinner = !!gameState?.winner_token;
    // A restart re-arms it for the next round.
    if (current === 'lobby') payoffFired = false;
    if (!ticketIsEventDay || payoffFired) return;
    if (current !== 'reveal' && current !== 'done') return;
    if (!hasWinner) return;

    payoffFired = true;
    payoffTimer = setTimeout(() => {
      ticketMode = 'payoff';
      ticketOpen = true;
    }, 5200);
  });

  // Destroy-only cleanup: the effect above deliberately does not return one, or
  // the phase flip from `reveal` to `done` would cancel the pending payoff.
  $effect(() => () => {
    if (payoffTimer) clearTimeout(payoffTimer);
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
      {#if autoJoining}
        <p class="muted" style="margin-top:18px;">Joining as <strong>{playerName}</strong>…</p>
        {#if joinError}<p class="error">{joinError}</p>{/if}
      {:else}
        <form onsubmit={handleJoin} style="margin-top:18px;">
          <label>Display name
            <input type="text" bind:value={playerName} maxlength="30" required placeholder="your name" autofocus>
          </label>
          <button type="submit" class="btn btn-primary" disabled={joinLoading || !playerName.trim()}>
            {joinLoading ? 'Joining…' : 'Join'}
          </button>
          {#if joinError}<p class="error">{joinError}</p>{/if}
        </form>
      {/if}
    </div>
  </div>
{/if}

<!-- Effects canvas + toasts -->
<EffectsCanvas bind:this={effectsCanvas} />
<Toaster />

<!-- Main game layout -->
{#if joined}
  <div class="parchment game-room" class:event-layout={eventLayout}>
    {#if !eventLayout}
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
        {#if ticketActive}
          <button type="button" class="btn btn-ghost" onclick={openTicket}>🎟️ Golden Ticket</button>
        {/if}
        <button type="button" class="btn btn-ghost" onclick={() => (showFairness = true)}>⚖️ Fairness</button>
        <a href="/leaderboard" class="btn btn-ghost">Leaderboard</a>
        <a href="/" class="btn btn-ghost">Home</a>
      </div>
    </header>
    {/if}

    {#if gameState}
      <div class="game-grid">
        <!-- Snacks: left column on desktop. Dimmed during picking so
             attention goes to the straws, not vote-chasing or cupboard
             browsing — chat stays at full prominence next to it. -->
        {#if !eventLayout}
          <section class="panel snacks-panel" class:dimmed={phase === 'picking' || phase === 'unwrapping'}>
            <Snacks game={gameState} {code} onOpenCupboard={() => (showCupboard = true)} onRefresh={() => conn.refresh()} />
          </section>
        {/if}

        <!-- Chat: right column on desktop, bottom drawer on mobile -->
        <section class="panel chat-panel" class:drawer-open={chatOpen} hidden={!inGame || undefined}>
          <Chat game={gameState} {code} onClose={closeChatDrawer} onRefresh={() => conn.refresh()} />
        </section>

        <!-- Stage: center on desktop, top on mobile -->
        <section class="panel stage-panel">
          <div class="phase-bar">
            <div class="phase-info">
              {#if eventLayout}
                <button type="button" class="stamp stamp-btn" title="Click to copy share link" onclick={copyShareUrl}>
                  {copied ? '✓ Copied!' : code}
                </button>
              {/if}
              <span class="phase-pill {phase}">{phase.charAt(0).toUpperCase() + phase.slice(1)}</span>
              <span class="phase-detail">{phaseDetail}</span>
              {#if lobbyTimeLeft != null}
                <span class="pick-timer" class:urgent={lobbyTimeLeft <= 10}>
                  ⏳ {Math.floor(lobbyTimeLeft / 60)}:{(lobbyTimeLeft % 60).toString().padStart(2, '0')}
                  <span class="timer-caption">{onlineCount < 2 ? 'waiting for players' : 'until auto-start'}</span>
                </span>
              {/if}
            </div>
            {#if showActionBtn}
              <div class="phase-actions">
                {#if isHost && phase === 'lobby' && lobbyDeadline != null}
                  <button class="btn btn-ghost" onclick={handleExtend} title="Wait 30 more seconds for people to join">
                    +30s
                  </button>
                {/if}
                <button
                  class="btn btn-primary big"
                  disabled={actionBtnDisabled}
                  onclick={phase === 'lobby' ? handleStart : () => { window.location.href = '/'; }}
                >
                  {actionBtnText}
                </button>
              </div>
            {/if}
          </div>

          <!-- The prize, on the host's screen only, for the whole round. The
               phones get the plain text banner in the lobby instead. -->
          {#if ticketActive && isHost}
            <PrizeStrip {style} onOpen={openTicket} />
          {/if}

          {#if phase === 'lobby'}
            <!-- Anyone who opened a shared link lands straight here, having never
                 seen the landing page's teaser. -->
            {#if ticketActive && !isHost}
              <button type="button" class="gt-banner" onclick={openTicket}>
                🎟️
                <span>This week the winner takes home a {PRIZE.weightKg} kg Toblerone.</span>
                <span class="gt-banner-tag">take a look</span>
              </button>
            {/if}
            <div class="cup-stage" class:bar-stage={bars} data-phase="lobby">
              <LobbyPhase game={gameState} joinUrl={isHost ? joinUrl : ''} />
              <div class="straws"></div>
              <div class="cup"></div>
            </div>
            {#if isHost}
              <div class="style-row">
                <span>Play with</span>
                <div class="style-toggle" role="group" aria-label="Game style">
                  <button type="button" aria-pressed={style === 'straws'} onclick={() => handleStyle('straws')}>🥤 Straws</button>
                  <button type="button" aria-pressed={bars} onclick={() => handleStyle('bars')}>🍫 Chocolate bars</button>
                </div>
                <label class="host-plays">
                  <input
                    type="checkbox"
                    checked={gameState.host_plays}
                    onchange={(e) => handleHostPlays(e.currentTarget.checked)}
                  />
                  I'm playing too
                </label>
              </div>
            {:else if bars}
              <p class="style-row">This round: 🍫 chocolate bars. One has a golden ticket inside.</p>
            {/if}
          {:else if phase === 'picking'}
            <div class="cup-stage" class:bar-stage={bars} data-phase="picking" class:countdown={countdownActive}>
              {#if bars}
                <BarPicking game={gameState} onPick={handlePick} locked={countdownActive} />
              {:else}
                <PickingPhase game={gameState} onPick={handlePick} locked={countdownActive} />
              {/if}
              <Countdown bind:this={countdownRef} onActiveChange={(a) => (countdownActive = a)} />
            </div>
            {#if isHost}
              <button
                type="button"
                class="restart-btn"
                class:armed={resolveArmed}
                onclick={handleForceResolve}
              >
                {resolveArmed ? 'Really assign the rest at random? Click again to confirm' : '⏭ someone’s AFK — resolve now'}
              </button>
            {/if}
          {:else if phase === 'unwrapping'}
            <div class="cup-stage bar-stage" data-phase="unwrapping">
              <UnwrapPhase game={gameState} {code} onRefresh={() => conn.refresh()} />
            </div>
            {#if isHost}
              <button
                type="button"
                class="restart-btn"
                class:armed={resolveArmed}
                onclick={handleForceResolve}
              >
                {resolveArmed ? 'Tear every bar open now? Click again to confirm' : '⏭ someone’s AFK — open all the bars'}
              </button>
            {/if}
          {:else if (phase === 'reveal' || phase === 'done') && bars}
            <div class="cup-stage bar-stage" data-phase="reveal">
              <BarReveal
                game={gameState}
                {sounds}
                onFireConfetti={(big) => effectsCanvas?.fireConfetti(big)}
                onFireSparkles={() => effectsCanvas?.fireSparkles()}
                onFireFireworks={(bursts) => effectsCanvas?.fireFireworks(bursts)}
              />
            </div>
          {:else if phase === 'reveal' || phase === 'done'}
            <div class="cup-stage" data-phase="reveal">
              <RevealPhase
                game={gameState}
                {sounds}
                onFireConfetti={(big) => effectsCanvas?.fireConfetti(big)}
                onFireTears={() => effectsCanvas?.fireTears()}
                onFireSparkles={() => effectsCanvas?.fireSparkles()}
                onFireFireworks={(bursts) => effectsCanvas?.fireFireworks(bursts)}
              />
            </div>
          {/if}

          {#if actionError}<p class="error" style="margin: 10px 0 0;">{actionError}</p>{/if}

          <!-- Prize snack card -->
          {#if !eventLayout && gameState.prize_snack && (phase === 'reveal' || phase === 'done')}
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
          {#if showGiveCard && !eventLayout}
            <GiveCard game={gameState} {code} {isHost} onRefresh={() => conn.refresh()} />
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
      game={gameState}
      {code}
      open={showCupboard}
      onClose={() => (showCupboard = false)}
    />
  {/if}

  <!-- Fairness modal -->
  {#if showFairness}
    <Fairness onClose={() => (showFairness = false)} />
  {/if}

  <!-- Golden ticket: teaser on demand, payoff automatically on the day -->
  {#if ticketActive && ticketOpen}
    <GoldenTicket
      mode={ticketMode}
      {style}
      {winnerName}
      onClose={() => (ticketOpen = false)}
      onFireConfetti={(big) => effectsCanvas?.fireConfetti(big)}
      onFireFireworks={(bursts) => effectsCanvas?.fireFireworks(bursts)}
    />
  {/if}
{/if}
