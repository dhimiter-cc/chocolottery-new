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
  }: {
    code: string;
    initialToken?: string | null;
    alreadyJoined?: boolean;
  } = $props();

  let gameState = $state<GameStateResponse | null>(null);
  let joined = $state(alreadyJoined);
  let playerName = $state('');
  let joinError = $state('');
  let joinLoading = $state(false);
  let showCupboard = $state(false);
  let chatOpen = $state(false);
  let copied = $state(false);

  let effectsCanvas: ReturnType<typeof EffectsCanvas> | null = $state(null);

  // ──────────────────── Sound system ────────────────────
  let audioCtx: AudioContext | null = null;

  function getCtx(): AudioContext {
    if (!audioCtx) audioCtx = new AudioContext();
    return audioCtx;
  }

  function tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.15,
    when = 0,
  ) {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + when);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + when + duration);
    osc.start(ctx.currentTime + when);
    osc.stop(ctx.currentTime + when + duration + 0.05);
  }

  function playDrumroll(durationMs: number) {
    const ticks = Math.floor(durationMs / 55);
    for (let i = 0; i < ticks; i++) tone(520, 0.06, 'triangle', 0.08, i * 0.055);
  }

  function playWinFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, 0.18, 'triangle', 0.2, i * 0.18));
    tone(1318.51, 0.6, 'triangle', 0.25, notes.length * 0.18);
  }

  function playLoseTrombone() {
    const ctx = getCtx();
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
    const ctx = getCtx();
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

  const sounds = {
    playDrumroll,
    playWinFanfare,
    playLoseTrombone,
    playRisingRumble,
  };

  // ──────────────────── Avatar helpers ────────────────────
  function avatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `linear-gradient(160deg, hsl(${hue} 70% 60%), hsl(${(hue + 30) % 360} 60% 38%))`;
  }

  function avatarInitial(name: string): string {
    return (name || '?').trim().charAt(0).toUpperCase();
  }

  // ──────────────────── Polling ────────────────────
  $effect(() => {
    if (!joined) return;

    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/state?code=${code}`);
        if (res.ok) {
          gameState = await res.json();
        }
      } catch {
        // ignore network errors
      }
    }, 1000);

    const heartbeat = setInterval(async () => {
      try {
        await fetch('/api/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      clearInterval(poll);
      clearInterval(heartbeat);
    };
  });

  // ──────────────────── Actions ────────────────────
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
    await fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  }

  async function handlePick(index: number) {
    await fetch('/api/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, straw_index: index }),
    });
  }

  async function handleRestart() {
    await fetch('/api/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  }

  function copyShareUrl() {
    const url = `${window.location.origin}/game/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      copied = true;
      setTimeout(() => (copied = false), 2000);
    });
  }

  let phase = $derived(gameState?.state ?? 'lobby');
  let isLobby = $derived(phase === 'lobby');
  let isHost = $derived(gameState?.is_host ?? false);
  let showRestartBtn = $derived(isHost && phase !== 'lobby');

  // ──────────────────── Effects canvas helpers ────────────────────
  function fireConfetti(big: boolean) {
    effectsCanvas?.fireConfetti(big);
  }
  function fireTears() {
    effectsCanvas?.fireTears();
  }
  function fireSparkles() {
    effectsCanvas?.fireSparkles();
  }
</script>

<!-- Join modal -->
{#if !joined}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" style="background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
      <h1 class="text-2xl font-extrabold text-gray-800 mb-1 text-center">Join Game</h1>
      <p class="text-gray-400 text-sm text-center mb-6">Code: <span class="font-mono font-bold text-orange-500">{code}</span></p>

      <form onsubmit={handleJoin} class="flex flex-col gap-4">
        <input
          type="text"
          bind:value={playerName}
          placeholder="Your name…"
          maxlength="32"
          autofocus
          class="rounded-xl px-4 py-3 text-base border border-gray-200 outline-none focus:border-orange-400 transition-colors"
        />
        {#if joinError}
          <p class="text-red-500 text-sm text-center">{joinError}</p>
        {/if}
        <button
          type="submit"
          disabled={joinLoading || !playerName.trim()}
          class="py-3 rounded-xl font-bold text-white text-base transition-all hover:scale-105 active:scale-95 disabled:opacity-40"
          style="background: linear-gradient(135deg, #E89817 0%, #F0B429 100%);"
        >
          {joinLoading ? 'Joining…' : 'Join'}
        </button>
      </form>
    </div>
  </div>
{/if}

<!-- Effects canvas overlay -->
<EffectsCanvas bind:this={effectsCanvas} />

<!-- Main layout -->
{#if joined && gameState}
  <div class="min-h-screen flex flex-col" style="background: var(--bg, #1a1a2e); --accent: #E89817; --stage: #12122a; --panel: rgba(255,255,255,0.06);">

    <!-- Header -->
    <header class="flex items-center gap-3 px-4 py-3 border-b" style="border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.2);">
      <!-- Code badge -->
      <button
        onclick={copyShareUrl}
        class="font-mono text-sm font-bold px-3 py-1 rounded-lg transition-all hover:scale-105 active:scale-95"
        style="background: rgba(255,255,255,0.1); color: {copied ? '#0F9D6E' : 'rgba(255,255,255,0.8)'};"
        title="Click to copy invite link"
      >
        {copied ? '✓ Copied!' : code}
      </button>

      <!-- Phase pill -->
      <span
        class="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
        style="background: rgba(232,152,23,0.2); color: var(--accent,#E89817);"
      >
        {phase}
      </span>

      <div class="flex-1"></div>

      <!-- Cupboard button (host + lobby) -->
      {#if isHost && isLobby}
        <button
          onclick={() => (showCupboard = true)}
          class="px-3 py-1.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          🍫 Cupboard
        </button>
      {/if}

      <!-- Restart button (host + non-lobby) -->
      {#if showRestartBtn}
        <button
          onclick={handleRestart}
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95"
          style="background: rgba(232,152,23,0.15); color: var(--accent,#E89817); border: 1px solid rgba(232,152,23,0.3);"
        >
          ↺ Restart
        </button>
      {/if}
    </header>

    <!-- Desktop: 3-col grid -->
    <div class="flex-1 hidden lg:grid" style="grid-template-columns: 280px 1fr 280px; min-height: 0;">
      <!-- Left: Snacks -->
      <div class="border-r overflow-y-auto" style="border-color: rgba(255,255,255,0.08);">
        <Snacks state={gameState} {code} />
      </div>

      <!-- Center: Stage -->
      <div class="relative overflow-hidden" style="background: var(--stage);">
        {#if phase === 'lobby'}
          <LobbyPhase state={gameState} onStart={handleStart} />
        {:else if phase === 'picking'}
          <PickingPhase state={gameState} onPick={handlePick} />
        {:else if phase === 'reveal' || phase === 'done'}
          <RevealPhase
            state={gameState}
            {sounds}
            onFireConfetti={fireConfetti}
            onFireTears={fireTears}
            onFireSparkles={fireSparkles}
          />
        {/if}
      </div>

      <!-- Right: Chat -->
      <div class="border-l flex flex-col min-h-0" style="border-color: rgba(255,255,255,0.08);">
        <Chat state={gameState} {code} mobile={false} />
      </div>
    </div>

    <!-- Mobile layout -->
    <div class="flex-1 flex flex-col lg:hidden">
      <!-- Stage -->
      <div class="relative flex-shrink-0" style="min-height: 55vh; background: var(--stage);">
        {#if phase === 'lobby'}
          <LobbyPhase state={gameState} onStart={handleStart} />
        {:else if phase === 'picking'}
          <PickingPhase state={gameState} onPick={handlePick} />
        {:else if phase === 'reveal' || phase === 'done'}
          <RevealPhase
            state={gameState}
            {sounds}
            onFireConfetti={fireConfetti}
            onFireTears={fireTears}
            onFireSparkles={fireSparkles}
          />
        {/if}
      </div>

      <!-- Snacks below stage -->
      <div class="overflow-y-auto" style="background: rgba(255,255,255,0.04); border-top: 1px solid rgba(255,255,255,0.08);">
        <Snacks state={gameState} {code} />
      </div>

      <!-- Chat FAB -->
      <button
        onclick={() => (chatOpen = !chatOpen)}
        class="fixed bottom-5 right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center text-white text-xl shadow-2xl transition-all hover:scale-110 active:scale-95"
        style="background: var(--accent,#E89817); box-shadow: 0 4px 20px rgba(232,152,23,0.5);"
      >
        💬
        {#if gameState.chat.length > 0}
          <span
            class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
          >
            {Math.min(gameState.chat.length, 99)}
          </span>
        {/if}
      </button>

      <!-- Chat bottom sheet -->
      {#if chatOpen}
        <Chat state={gameState} {code} mobile={true} />
        <!-- Backdrop to close -->
        <div
          class="fixed inset-0 z-30"
          style="background: rgba(0,0,0,0.3);"
          onclick={() => (chatOpen = false)}
        ></div>
      {/if}
    </div>
  </div>

  <!-- Cupboard modal -->
  <Cupboard
    state={gameState}
    {code}
    open={showCupboard}
    onClose={() => (showCupboard = false)}
  />
{:else if joined && !gameState}
  <!-- Loading state -->
  <div class="fixed inset-0 flex items-center justify-center" style="background: #12122a;">
    <div class="flex flex-col items-center gap-4">
      <div
        class="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
        style="border-color: rgba(232,152,23,0.3); border-top-color: var(--accent,#E89817);"
      ></div>
      <p class="text-white/40 text-sm">Loading game…</p>
    </div>
  </div>
{/if}
