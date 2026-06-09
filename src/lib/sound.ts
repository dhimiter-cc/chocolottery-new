// Web Audio sound engine. Extracted from Game.svelte — none of this is reactive
// or touches the DOM, so it lives as a plain browser-only module. A single lazily
// created AudioContext is shared across all effects.

let audioCtx: AudioContext | null = null;

function getAudio(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try { audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
  catch { audioCtx = null; }
  return audioCtx;
}

export function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  when = 0,
) {
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

export function playDrumroll(durationMs: number) {
  const ticks = Math.floor(durationMs / 55);
  for (let i = 0; i < ticks; i++) tone(520, 0.06, 'triangle', 0.08, i * 0.055);
}

export function playWinFanfare() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.18, 'triangle', 0.2, i * 0.18));
  tone(1318.51, 0.6, 'triangle', 0.25, 4 * 0.18);
}

export function playLoseTrombone() {
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

export function playRisingRumble() {
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

// Bundle handed to RevealPhase via the `sounds` prop.
export const sounds = { playDrumroll, playWinFanfare, playLoseTrombone, playRisingRumble };
