<script lang="ts">
  import EffectsCanvas from './EffectsCanvas.svelte';
  import LobbyPhase from './LobbyPhase.svelte';
  import PickingPhase from './PickingPhase.svelte';
  import RevealPhase from './RevealPhase.svelte';
  import Snacks from './Snacks.svelte';
  import Chat from './Chat.svelte';
  import Cupboard from './Cupboard.svelte';
  import Countdown from './Countdown.svelte';
  import Fairness from './Fairness.svelte';
  import GiveCard from './GiveCard.svelte';
  import Toaster from './Toaster.svelte';
  import { sounds } from '../lib/sound.js';
  import { post } from '../lib/api.js';
  import { showToast } from '../lib/toast.svelte.js';
  import { GameConnection } from '../lib/gameConnection.svelte.js';

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

  const conn = new GameConnection(code);
  let gameState = $derived(conn.state);
  let joined = $state(alreadyJoined);
  let playerName = $state(presetName);
  let joinError = $state('');
  let joinLoading = $state(false);
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
  async function handleJoin(e: SubmitEvent) {
    e.preventDefault();
    // Name comes from the signed-in Entra session server-side; we only send the code.
    joinLoading = true;
    joinError = '';
    try {
      const { ok, data } = await post('/api/join', { code });
      if (ok) {
        joined = true;
      } else {
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
      const { data } = await post('/api/start', { code });
      if (data.error) actionError = data.error;
      else conn.refresh();
    } catch { actionError = 'Could not start'; }
  }

  async function handlePick(index: number) {
    await post('/api/pick', { code, straw_index: index });
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

  let showGiveCard = $derived((phase === 'reveal' || phase === 'done') && (isHost || !!gameState?.prize_given_id));

  // Fairness modal (rendered by <Fairness>, which fetches its own data)
  let showFairness = $state(false);

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
        <p class="muted">You'll join as <strong>{playerName || 'your account'}</strong>.</p>
        <button type="submit" class="btn btn-primary" style="margin-top:14px;" disabled={joinLoading}>
          {joinLoading ? 'Joining…' : `Join as ${playerName || 'me'}`}
        </button>
        {#if joinError}<p class="error">{joinError}</p>{/if}
      </form>
    </div>
  </div>
{/if}

<!-- Effects canvas + toasts -->
<EffectsCanvas bind:this={effectsCanvas} />
<Toaster />

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
        <button type="button" class="btn btn-ghost" onclick={() => (showFairness = true)}>⚖️ Fairness</button>
        <a href="/leaderboard" class="btn btn-ghost">Leaderboard</a>
        <a href="/" class="btn btn-ghost">Home</a>
      </div>
    </header>

    {#if gameState}
      <div class="game-grid">
        <!-- Snacks: left column on desktop -->
        <section class="panel snacks-panel">
          <Snacks game={gameState} {code} onOpenCupboard={() => (showCupboard = true)} onRefresh={() => conn.refresh()} />
        </section>

        <!-- Chat: right column on desktop, bottom drawer on mobile -->
        <section class="panel chat-panel" class:drawer-open={chatOpen} hidden={!inGame || undefined}>
          <Chat game={gameState} {code} onClose={closeChatDrawer} onRefresh={() => conn.refresh()} />
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
              <LobbyPhase game={gameState} />
              <div class="straws"></div>
              <div class="cup"></div>
            </div>
          {:else if phase === 'picking'}
            <div class="cup-stage" data-phase="picking" class:countdown={countdownActive}>
              <PickingPhase game={gameState} onPick={handlePick} locked={countdownActive} />
              <Countdown bind:this={countdownRef} onActiveChange={(a) => (countdownActive = a)} />
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
{/if}
