// Web Audio sound engine. Extracted from Game.svelte — none of this is reactive
// or touches the DOM, so it lives as a plain browser-only module. A single lazily
// created AudioContext is shared across all effects.

let audioCtx: AudioContext | null = null;

// Mute is remembered per browser. Every sound goes through getAudio(), so one
// flag silences all of them; muting also suspends the context so sounds that
// are already scheduled stop at once.
const MUTE_KEY = 'chocolottery-muted';
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* server render or storage blocked */ }

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch { /* storage blocked: mute lasts for this visit */ }
  if (audioCtx) void (value ? audioCtx.suspend() : audioCtx.resume());
}

function getAudio(): AudioContext | null {
  if (muted) return null;
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

// ── Noise-based crowd sounds ──────────────────────────────────────────────
// A single 1s white-noise buffer, reused by every clap/cheer (it's read-only).
let noiseBuf: AudioBuffer | null = null;
function getNoise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = Math.floor(ctx.sampleRate);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

// One hand clap: a short band-passed noise pop with a fast decay.
function clapAt(ctx: AudioContext, t: number, vol: number) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1200 + Math.random() * 1600;
  bp.Q.value = 0.6;
  const g = ctx.createGain();
  // exponentialRampToValueAtTime can't target exactly 0 (playApplause's
  // attack envelope is 0 at prog=0, i.e. the very first clap) — floor it to
  // the same silence epsilon used everywhere else in this file.
  const peak = Math.max(0.0001, vol);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06 + Math.random() * 0.05);
  src.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + 0.14);
}

// A whole crowd clapping: many overlapping claps that swell in and fade out.
export function playApplause(durationMs = 2600) {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const start = ctx.currentTime + 0.02;
  const dur = durationMs / 1000;
  let t = start;
  while (t < start + dur) {
    const prog = (t - start) / dur;
    const attack = Math.min(1, prog / 0.12);
    const release = prog > 0.65 ? Math.max(0.08, (1 - prog) / 0.35) : 1;
    const env = attack * release;
    clapAt(ctx, t, (0.03 + Math.random() * 0.09) * env);
    t += 0.01 + Math.random() * 0.028;
  }
}

// A rising crowd "wooo" — looped noise through a sweeping band-pass.
export function playCheer(durationMs = 2200) {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  const dur = durationMs / 1000;
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(500, t0);
  bp.frequency.exponentialRampToValueAtTime(1500, t0 + dur * 0.4);
  bp.frequency.exponentialRampToValueAtTime(900, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.13, t0 + 0.3);
  g.gain.setValueAtTime(0.13, t0 + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// ── Melodic flourishes ────────────────────────────────────────────────────
// A party-blower squawk: a quick rising saw with a wobbly tail.
export function playPartyHorn() {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t = ctx.currentTime + 0.02;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.linearRampToValueAtTime(540, t + 0.12);
  osc.frequency.linearRampToValueAtTime(500, t + 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
  g.gain.setValueAtTime(0.12, t + 0.42);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.6);
}

// A triumphant "ta-da!" — a two-note pickup into a bright major chord.
export function playTada() {
  tone(523.25, 0.12, 'triangle', 0.16, 0);    // C
  tone(587.33, 0.12, 'triangle', 0.16, 0.12); // D
  [783.99, 987.77, 1174.66].forEach(f => tone(f, 0.7, 'triangle', 0.15, 0.26)); // G major
  tone(392.0, 0.7, 'sawtooth', 0.07, 0.26);   // bass
}

// Ascending bell sparkle for the buildup.
export function playSparkleChime() {
  [1046.5, 1318.5, 1568.0, 2093.0].forEach((f, i) => tone(f, 0.5, 'sine', 0.1, i * 0.08));
}

// ── Unwrapping (chocolate-bar mode) ─────────────────────────────────────────
// One noise grain: band-passed, with its own start offset into the shared
// buffer so consecutive grains never sound identical.
function grainAt(ctx: AudioContext, t: number, freq: number, q: number, vol: number, len: number) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  src.start(t, Math.random() * 0.6);
  src.stop(t + len + 0.02);
}

// Paper tearing: a dense run of low, dry grains — a rip rather than a hiss.
export function playPaperRip() {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime + 0.01;
  const dur = 0.16 + Math.random() * 0.1;
  for (let t = 0; t < dur; t += 0.006 + Math.random() * 0.01) {
    grainAt(ctx, t0 + t, 900 + Math.random() * 1400, 1.2, 0.05 + Math.random() * 0.07, 0.03);
  }
}

// Foil crinkling: sparse, bright, high clicks.
export function playFoilCrinkle() {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime + 0.01;
  const dur = 0.22 + Math.random() * 0.1;
  for (let t = 0; t < dur; t += 0.012 + Math.random() * 0.03) {
    grainAt(ctx, t0 + t, 4200 + Math.random() * 3500, 3, 0.04 + Math.random() * 0.06, 0.018);
  }
}

// ── Halloween ───────────────────────────────────────────────────────────────
// A door on dry hinges: a sawtooth whose pitch stutters, through a band-pass
// that slowly opens. Quiet on purpose; it sits under the drumroll.
export function playCreak() {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  const dur = 1.3;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const base = 95 + (i / steps) * 70;
    osc.frequency.setValueAtTime(base + (Math.random() - 0.5) * 38, t0 + (i / steps) * dur);
  }
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 5;
  bp.frequency.setValueAtTime(380, t0);
  bp.frequency.exponentialRampToValueAtTime(980, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.2);
  g.gain.setValueAtTime(0.14, t0 + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// A theremin-ish wail on a diminished chord, wobbling slowly, for the moment
// the bar lights up.
export function playSpookyStinger() {
  const ctx = getAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  const t0 = ctx.currentTime + 0.02;
  const dur = 1.6;
  // A, C, E-flat: the chord that never resolves.
  [220, 261.63, 311.13].forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 0.97, t0);
    osc.frequency.exponentialRampToValueAtTime(f * 1.03, t0 + dur);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5 + i * 0.7;
    lfoGain.gain.value = f * 0.012;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + dur + 0.05);
    lfo.stop(t0 + dur + 0.05);
  });
  // One low bell on top.
  tone(110, 1.4, 'sine', 0.14, 0.05);
}

// Bundle handed to RevealPhase via the `sounds` prop.
export const sounds = {
  playDrumroll,
  playWinFanfare,
  playLoseTrombone,
  playRisingRumble,
  playApplause,
  playCheer,
  playPartyHorn,
  playTada,
  playSparkleChime,
  playCreak,
  playSpookyStinger,
};
