// Web Audio sound engine. None of this is reactive or touches the DOM, so it
// lives as a plain browser-only module. A single lazily created AudioContext is
// shared across all effects.
//
// Everything is synthesised (no audio files) but not from bare oscillators:
//  - a shared bus gives every sound a little room (a generated reverb) and a
//    gentle compressor, so stacked sounds glue together instead of clipping;
//  - a few small "instruments" (bell, mallet, brass, snare, cymbal, whoop) do the
//    work, and each effect is a short tune or texture played on them.
// The cheerful ones are all in C major, so a fanfare, a "ta-da" and a chime that
// overlap during a reveal land on the same chord.

import { getAudio, ready, isMuted, setMuted, useAudioContext, onContextChange } from './soundCore.js';
import * as classic from './soundClassic.js';

export { isMuted, setMuted, useAudioContext };

// ── Packs ─────────────────────────────────────────────────────────────────
// This file is the "cheerful" pack. The original sounds live in soundClassic.ts
// and the admin dashboard picks between them: the server writes the choice to
// <html data-sound-pack>, and the effects that differ between packs hand over
// at the top of their function. Halloween's creaks and the paper and foil
// tearing are the same in both.
export type SoundPack = 'cheerful' | 'classic';
let forced: SoundPack | null = null;
function useClassic(): boolean {
  if (forced) return forced === 'classic';
  return typeof document !== 'undefined' && document.documentElement.dataset.soundPack === 'classic';
}

/** Run a sound against the shared context, starting a hair from now. */
function play(fn: (ctx: AudioContext, t0: number) => void) {
  const ctx = getAudio();
  if (!ctx) return;
  ready(ctx);
  fn(ctx, ctx.currentTime + 0.02);
}

// ── The bus ───────────────────────────────────────────────────────────────
// voice → wet ─┬────────────────────────────┐
//              └→ send → reverb ────────────┤→ compressor → out
// voice → dry ──────────────────────────────┘
// Noise textures that should stay close and crisp (tearing paper, a snare roll)
// use `dry`; everything tuned uses `wet`.
interface Bus { wet: GainNode; dry: GainNode }
let bus: Bus | null = null;
let busCtx: AudioContext | null = null;
onContextChange(() => { bus = null; busCtx = null; });

/** A room made of decaying stereo noise: no file to load. */
function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function getBus(ctx: AudioContext): Bus {
  if (bus && busCtx === ctx) return bus;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 18;
  comp.ratio.value = 4;
  comp.attack.value = 0.004;
  comp.release.value = 0.22;
  const out = ctx.createGain();
  out.gain.value = 0.9;
  comp.connect(out);
  out.connect(ctx.destination);

  const dry = ctx.createGain();
  dry.connect(comp);
  const wet = ctx.createGain();
  wet.connect(comp);
  const send = ctx.createGain();
  send.gain.value = 0.26;
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, 1.7);
  wet.connect(send);
  send.connect(verb);
  verb.connect(comp);

  bus = { wet, dry };
  busCtx = ctx;
  return bus;
}

/** Place a voice in the stereo field (-1 left … 1 right) before the bus. */
function panned(ctx: AudioContext, pan: number, dest: AudioNode): AudioNode {
  if (!pan || !ctx.createStereoPanner) return dest;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(dest);
  return p;
}

const SILENT = 0.0001;

// ── Noise ─────────────────────────────────────────────────────────────────
// A single 1s white-noise buffer, reused by every clap/cheer/snare (read-only).
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

// ── Instruments ───────────────────────────────────────────────────────────
// All take the context and a start time `t` in context seconds, and clean up
// after themselves.

/** A struck glass bell: FM synthesis, so the attack is bright and the tail mellows. */
function bell(ctx: AudioContext, t: number, freq: number, vol = 0.1, dur = 1.4, pan = 0) {
  const dest = panned(ctx, pan, getBus(ctx).wet);
  const car = ctx.createOscillator();
  car.frequency.value = freq;
  const mod = ctx.createOscillator();
  mod.frequency.value = freq * 3.5;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(freq * 1.6, t);
  depth.gain.exponentialRampToValueAtTime(freq * 0.05, t + dur * 0.5);
  mod.connect(depth);
  depth.connect(car.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
  car.connect(g);
  g.connect(dest);
  car.start(t);
  mod.start(t);
  car.stop(t + dur + 0.05);
  mod.stop(t + dur + 0.05);
}

/** A mallet on wood (marimba-ish): a round fundamental with a short, bright overtone. */
function mallet(ctx: AudioContext, t: number, freq: number, vol = 0.2, dur = 0.45, pan = 0) {
  const dest = panned(ctx, pan, getBus(ctx).wet);
  const body = ctx.createOscillator();
  body.frequency.value = freq;
  const over = ctx.createOscillator();
  over.frequency.value = freq * 4;
  const gb = ctx.createGain();
  gb.gain.setValueAtTime(SILENT, t);
  gb.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  gb.gain.exponentialRampToValueAtTime(SILENT, t + dur);
  const go = ctx.createGain();
  go.gain.setValueAtTime(SILENT, t);
  go.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.003);
  go.gain.exponentialRampToValueAtTime(SILENT, t + dur * 0.22);
  body.connect(gb);
  over.connect(go);
  gb.connect(dest);
  go.connect(dest);
  body.start(t);
  over.start(t);
  body.stop(t + dur + 0.05);
  over.stop(t + dur + 0.05);
}

interface BrassOpts {
  pan?: number;
  /** Multiplier on `freq` the pitch glides to by the end (0.92 = a sag). */
  bend?: number;
  /** Filter opens to `open` × freq on the attack, settles to `close` × freq: a
   *  wide gap with a low `close` is a "wah". */
  open?: number;
  close?: number;
}

/** A brass section: two detuned saws, a filter that "blats" open then settles,
 *  and vibrato that arrives a moment after the note. */
function brass(ctx: AudioContext, t: number, freq: number, dur: number, vol = 0.12, o: BrassOpts = {}) {
  const { pan = 0, bend = 1, open = 5, close = 3 } = o;
  const dest = panned(ctx, pan, getBus(ctx).wet);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(freq * 1.5, t);
  lp.frequency.exponentialRampToValueAtTime(freq * open, t + 0.09);
  lp.frequency.exponentialRampToValueAtTime(freq * close, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.025);
  g.gain.exponentialRampToValueAtTime(vol * 0.75, t + dur);
  g.gain.exponentialRampToValueAtTime(SILENT, t + dur + 0.12);
  lp.connect(g);
  g.connect(dest);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.setValueAtTime(0, t);
  lfoDepth.gain.linearRampToValueAtTime(9, t + 0.28);
  lfo.connect(lfoDepth);

  const stop = t + dur + 0.2;
  [-7, 7].forEach((cents) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.detune.value = cents;
    osc.frequency.setValueAtTime(freq, t);
    if (bend !== 1) osc.frequency.exponentialRampToValueAtTime(freq * bend, t + dur);
    lfoDepth.connect(osc.detune);
    osc.connect(lp);
    osc.start(t);
    osc.stop(stop);
  });
  lfo.start(t);
  lfo.stop(stop);
}

function kick(ctx: AudioContext, t: number, vol = 0.5) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(130, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(SILENT, t + 0.32);
  osc.connect(g);
  g.connect(getBus(ctx).dry);
  osc.start(t);
  osc.stop(t + 0.35);
}

/** A snare: a snap of high noise over a short tonal body. */
function snare(ctx: AudioContext, t: number, vol = 0.3, pan = 0) {
  const dest = panned(ctx, pan, getBus(ctx).dry);
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1700;
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(Math.max(SILENT, vol), t + 0.002);
  g.gain.exponentialRampToValueAtTime(SILENT, t + 0.13);
  src.connect(hp);
  hp.connect(g);
  g.connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + 0.16);

  const body = ctx.createOscillator();
  body.frequency.setValueAtTime(210, t);
  body.frequency.exponentialRampToValueAtTime(130, t + 0.07);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(Math.max(SILENT, vol * 0.55), t);
  bg.gain.exponentialRampToValueAtTime(SILENT, t + 0.09);
  body.connect(bg);
  bg.connect(dest);
  body.start(t);
  body.stop(t + 0.12);
}

/** A crash: bright noise with a long fade. */
function cymbal(ctx: AudioContext, t: number, vol = 0.12, dur = 1.4) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6500;
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
  src.connect(hp);
  hp.connect(g);
  g.connect(getBus(ctx).wet);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** One "woo!": a sawtooth through two vowel-ish formants, gliding up with vibrato. */
function whoop(ctx: AudioContext, t: number, freq: number, dur: number, vol = 0.04, pan = 0) {
  const dest = panned(ctx, pan, getBus(ctx).wet);
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.75, t + dur * 0.7);
  osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);
  const vib = ctx.createOscillator();
  vib.frequency.value = 6.5;
  const vibDepth = ctx.createGain();
  vibDepth.gain.value = 14;
  vib.connect(vibDepth);
  vibDepth.connect(osc.detune);
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.07);
  g.gain.setValueAtTime(vol, t + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
  [[850, 4], [1500, 5]].forEach(([f, q]) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    osc.connect(bp);
    bp.connect(g);
  });
  g.connect(dest);
  osc.start(t);
  vib.start(t);
  osc.stop(t + dur + 0.05);
  vib.stop(t + dur + 0.05);
}

// Notes (Hz). Everything cheerful is built from the C major scale.
const C4 = 261.63, G4 = 392.0;
const C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99;
const C6 = 1046.5, E6 = 1318.51, G6 = 1568.0, C7 = 2093.0;

/** A short tone, kept for callers that just want a beep. Now soft-edged and in the room. */
export function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.15,
  when = 0,
) {
  const ctx = getAudio();
  if (!ctx) return;
  ready(ctx);
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(SILENT, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(SILENT, t0 + duration);
  osc.connect(gain);
  gain.connect(getBus(ctx).wet);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

// ── Round start and picking ───────────────────────────────────────────────
/** The 3-2-1 beeps and the GO: step 0, 1, 2 climb C, E, G on a mallet; 3 is GO. */
export function playCountdownBeep(step: number) {
  if (useClassic()) return classic.playCountdownBeep(step);
  play((ctx, t) => {
    if (step < 3) {
      mallet(ctx, t, [C5, E5, G5][step], 0.26, 0.4);
      return;
    }
    // GO: a bright chord with a bell on top and a little crash.
    [C5, E5, G5, C6].forEach((f, i) => mallet(ctx, t, f, 0.16, 0.7, (i - 1.5) * 0.3));
    bell(ctx, t, C7, 0.07, 1.2);
    cymbal(ctx, t, 0.06, 0.7);
  });
}

/** Taking a straw or a bar: a quick, happy pop. */
export function playPick() {
  if (useClassic()) return classic.playPick();
  play((ctx, t) => {
    mallet(ctx, t, G5, 0.22, 0.28);
    mallet(ctx, t + 0.07, C6, 0.2, 0.4);
  });
}

// ── The build to the reveal ───────────────────────────────────────────────
/** A snare roll that speeds up and swells, landing on a crash. */
export function playDrumroll(durationMs: number) {
  if (useClassic()) return classic.playDrumroll(durationMs);
  play((ctx, t) => {
    const dur = durationMs / 1000;
    let at = 0;
    while (at < dur - 0.05) {
      const prog = at / dur;
      const gap = 0.095 - 0.062 * prog;
      snare(ctx, t + at, 0.07 + 0.3 * prog * prog, (Math.random() - 0.5) * 0.3);
      at += gap;
    }
    // The landing: one big hit.
    kick(ctx, t + dur, 0.38);
    snare(ctx, t + dur, 0.3);
    cymbal(ctx, t + dur, 0.1, 1.6);
  });
}

/** A riser: a sweeping noise wash under a climbing tone, cut off clean at the top. */
export function playRisingRumble(durationMs = 3000) {
  if (useClassic()) return classic.playRisingRumble();
  play((ctx, t) => {
    const dur = durationMs / 1000;
    const out = getBus(ctx);

    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(250, t);
    bp.frequency.exponentialRampToValueAtTime(6000, t + dur);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(SILENT, t);
    ng.gain.exponentialRampToValueAtTime(0.13, t + dur * 0.97);
    ng.gain.setValueAtTime(SILENT, t + dur);
    src.connect(bp);
    bp.connect(ng);
    ng.connect(out.wet);
    src.start(t);
    src.stop(t + dur + 0.05);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(130.81, t);
    osc.frequency.exponentialRampToValueAtTime(523.25, t + dur);
    const og = ctx.createGain();
    og.gain.setValueAtTime(SILENT, t);
    og.gain.exponentialRampToValueAtTime(0.1, t + dur * 0.97);
    og.gain.setValueAtTime(SILENT, t + dur);
    osc.connect(og);
    og.connect(out.wet);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
}

/** The default build to a bar reveal: roll and riser together, as long as the
 *  stage waits. A theme can swap this for its own (see theme.sounds). */
export function playRevealBuild(durationMs: number) {
  if (useClassic()) return classic.playRevealBuild(durationMs);
  playDrumroll(durationMs);
  playRisingRumble(durationMs);
}

// Ascending bell sparkle for the moment things light up.
export function playSparkleChime() {
  if (useClassic()) return classic.playSparkleChime();
  play((ctx, t) => {
    [C6, E6, G6, C7, E6 * 2].forEach((f, i) => bell(ctx, t + i * 0.07, f, 0.07, 1.1, i % 2 ? 0.35 : -0.35));
  });
}

// ── The win ───────────────────────────────────────────────────────────────
/** A three-note brass pickup into a big held C major chord, with a crash and a
 *  bell on top. Says "somebody won!" */
export function playWinFanfare() {
  if (useClassic()) return classic.playWinFanfare();
  play((ctx, t) => {
    [G4, C5, E5].forEach((f, i) => brass(ctx, t + i * 0.12, f, 0.11, 0.1, { open: 4, close: 3 }));
    const hit = t + 0.4;
    [C5, E5, G5, C6].forEach((f, i) => brass(ctx, hit, f, 1.05, 0.085, { pan: (i - 1.5) * 0.25 }));
    brass(ctx, hit, C4 / 2, 1.05, 0.12, { open: 3, close: 2 });
    cymbal(ctx, hit, 0.1, 1.8);
    bell(ctx, hit + 0.02, G6, 0.07, 1.6);
    bell(ctx, hit + 0.1, C7, 0.06, 1.8);
  });
}

/** "Ta-da!": a quick two-note lift into a sparkling chord. */
export function playTada() {
  if (useClassic()) return classic.playTada();
  play((ctx, t) => {
    mallet(ctx, t, G5, 0.2, 0.3);
    mallet(ctx, t + 0.11, C6, 0.2, 0.3);
    const hit = t + 0.24;
    [C5, E5, G5, C6, E6].forEach((f, i) => mallet(ctx, hit, f, 0.14, 0.9, (i - 2) * 0.25));
    brass(ctx, hit, C5, 0.7, 0.05);
    brass(ctx, hit, G5, 0.7, 0.04);
    bell(ctx, hit, C7, 0.07, 1.5);
    bell(ctx, hit + 0.06, G6, 0.05, 1.5);
    cymbal(ctx, hit, 0.05, 1.0);
  });
}

/** A party popper: a crack and a thump, then confetti hissing down while a
 *  handful of little bells scatter across the room. Cheerful, not squeaky. */
export function playPartyPopper() {
  if (useClassic()) return classic.playPartyPopper();
  play((ctx, t) => {
    // The crack.
    const crack = ctx.createBufferSource();
    crack.buffer = getNoise(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(SILENT, t);
    cg.gain.exponentialRampToValueAtTime(0.32, t + 0.002);
    cg.gain.exponentialRampToValueAtTime(SILENT, t + 0.07);
    crack.connect(hp);
    hp.connect(cg);
    cg.connect(getBus(ctx).wet);
    crack.start(t, Math.random() * 0.5);
    crack.stop(t + 0.1);

    // The thump behind it.
    const thump = ctx.createOscillator();
    thump.frequency.setValueAtTime(190, t);
    thump.frequency.exponentialRampToValueAtTime(60, t + 0.09);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.3, t);
    tg.gain.exponentialRampToValueAtTime(SILENT, t + 0.12);
    thump.connect(tg);
    tg.connect(getBus(ctx).dry);
    thump.start(t);
    thump.stop(t + 0.15);

    // Confetti hissing down: a quiet noise wash that falls in pitch.
    const hiss = ctx.createBufferSource();
    hiss.buffer = getNoise(ctx);
    hiss.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(7000, t + 0.02);
    bp.frequency.exponentialRampToValueAtTime(2200, t + 0.7);
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(SILENT, t + 0.02);
    hg.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
    hg.gain.exponentialRampToValueAtTime(SILENT, t + 0.7);
    hiss.connect(bp);
    bp.connect(hg);
    hg.connect(getBus(ctx).wet);
    hiss.start(t + 0.02);
    hiss.stop(t + 0.75);

    // Glitter: little bells on a major pentatonic, scattered in time and space.
    const scale = [C6, D5 * 2, E6, G6, 1760, C7];
    for (let i = 0; i < 9; i++) {
      const at = 0.04 + i * 0.045 + Math.random() * 0.03;
      const f = scale[Math.floor(Math.random() * scale.length)];
      bell(ctx, t + at, f, 0.045 + Math.random() * 0.03, 0.55, (Math.random() - 0.5) * 1.6);
    }
  });
}

/** A rising crowd "wooo": a breathy wash through vowel formants, with a few
 *  voices whooping over the top. */
export function playCheer(durationMs = 2200) {
  if (useClassic()) return classic.playCheer(durationMs);
  play((ctx, t) => {
    const dur = durationMs / 1000;
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    src.loop = true;
    const g = ctx.createGain();
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(0.38, t + 0.3);
    g.gain.setValueAtTime(0.38, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    [[750, 950], [1250, 1750]].forEach(([from, to]) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 3;
      bp.frequency.setValueAtTime(from, t);
      bp.frequency.exponentialRampToValueAtTime(to, t + dur * 0.45);
      bp.frequency.exponentialRampToValueAtTime(from * 1.1, t + dur);
      src.connect(bp);
      bp.connect(g);
    });
    g.connect(getBus(ctx).wet);
    src.start(t);
    src.stop(t + dur + 0.05);

    // Five whoops, staggered and spread across the room.
    [0.05, 0.22, 0.4, 0.62, 0.9].forEach((at, i) => {
      whoop(ctx, t + at, 320 + Math.random() * 200, 0.5 + Math.random() * 0.25, 0.11, (i / 4 - 0.5) * 1.4);
    });
  });
}

/** One hand clap: a short band-passed noise pop with a fast decay. */
function clapAt(ctx: AudioContext, t: number, vol: number, pan: number) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1200 + Math.random() * 1600;
  bp.Q.value = 0.6;
  const g = ctx.createGain();
  // exponentialRampToValueAtTime can't target exactly 0 (the attack envelope is
  // 0 at the very first clap), so floor it to the same silence used everywhere.
  const peak = Math.max(SILENT, vol);
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(SILENT, t + 0.06 + Math.random() * 0.05);
  src.connect(bp);
  bp.connect(g);
  g.connect(panned(ctx, pan, getBus(ctx).wet));
  src.start(t, Math.random() * 0.5);
  src.stop(t + 0.14);
}

/** A whole crowd clapping: many overlapping claps, spread across the room, that
 *  swell in and fade out. */
export function playApplause(durationMs = 2600) {
  if (useClassic()) return classic.playApplause(durationMs);
  play((ctx, t0) => {
    const dur = durationMs / 1000;
    let t = t0;
    while (t < t0 + dur) {
      const prog = (t - t0) / dur;
      const attack = Math.min(1, prog / 0.12);
      const release = prog > 0.65 ? Math.max(0.08, (1 - prog) / 0.35) : 1;
      clapAt(ctx, t, (0.03 + Math.random() * 0.09) * 3 * attack * release, (Math.random() - 0.5) * 1.6);
      t += 0.01 + Math.random() * 0.028;
    }
  });
}

// ── The loss ──────────────────────────────────────────────────────────────
/** Wah-wah-wah-waaah: a muted brass slide down, played for laughs, not for blood. */
export function playLoseTrombone() {
  if (useClassic()) return classic.playLoseTrombone();
  play((ctx, t) => {
    const wah = { open: 3, close: 1.1 };
    brass(ctx, t, 233.08, 0.27, 0.13, wah);
    brass(ctx, t + 0.32, 220.0, 0.27, 0.13, wah);
    brass(ctx, t + 0.64, 207.65, 0.27, 0.13, wah);
    brass(ctx, t + 0.96, 196.0, 0.9, 0.14, { ...wah, bend: 0.9 });
  });
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
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(Math.max(SILENT, vol), t + 0.004);
  g.gain.exponentialRampToValueAtTime(SILENT, t + len);
  src.connect(bp);
  bp.connect(g);
  g.connect(getBus(ctx).dry);
  src.start(t, Math.random() * 0.6);
  src.stop(t + len + 0.02);
}

// Paper tearing: a dense run of low, dry grains — a rip rather than a hiss.
export function playPaperRip() {
  play((ctx, t0) => {
    const dur = 0.16 + Math.random() * 0.1;
    for (let t = 0; t < dur; t += 0.006 + Math.random() * 0.01) {
      grainAt(ctx, t0 + t, 900 + Math.random() * 1400, 1.2, 0.05 + Math.random() * 0.07, 0.03);
    }
  });
}

// Foil crinkling: sparse, bright, high clicks.
export function playFoilCrinkle() {
  play((ctx, t0) => {
    const dur = 0.22 + Math.random() * 0.1;
    for (let t = 0; t < dur; t += 0.012 + Math.random() * 0.03) {
      grainAt(ctx, t0 + t, 4200 + Math.random() * 3500, 3, 0.04 + Math.random() * 0.06, 0.018);
    }
  });
}

// ── Halloween ───────────────────────────────────────────────────────────────
// A door on dry hinges: a sawtooth whose pitch stutters, through a band-pass
// that slowly opens. Quiet on purpose; it sits under the drumroll.
export function playCreak(delay = 0) {
  const ctx = getAudio();
  if (!ctx) return;
  ready(ctx);
  const t0 = ctx.currentTime + 0.02 + delay;
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
  g.gain.setValueAtTime(SILENT, t0);
  g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.2);
  g.gain.setValueAtTime(0.14, t0 + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(SILENT, t0 + dur);
  osc.connect(bp);
  bp.connect(g);
  g.connect(getBus(ctx).wet);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Someone knocking at the door: four low thumps, then the hinges. Plays as the
// reveal's drumroll starts.
export function playKnock() {
  const ctx = getAudio();
  if (!ctx) return;
  ready(ctx);
  const t0 = ctx.currentTime + 0.02;
  [0, 0.22, 0.44, 0.9].forEach((at, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(i === 3 ? 95 : 130, t0 + at);
    osc.frequency.exponentialRampToValueAtTime(52, t0 + at + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(SILENT, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + at + 0.008);
    g.gain.exponentialRampToValueAtTime(SILENT, t0 + at + 0.16);
    osc.connect(g);
    g.connect(getBus(ctx).dry);
    osc.start(t0 + at);
    osc.stop(t0 + at + 0.2);
  });
  playCreak(1.35);
}

// A theremin-ish wail on a diminished chord, wobbling slowly, for the moment
// the bar lights up.
export function playSpookyStinger() {
  const ctx = getAudio();
  if (!ctx) return;
  ready(ctx);
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
    g.gain.setValueAtTime(SILENT, t0);
    g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.35);
    g.gain.exponentialRampToValueAtTime(SILENT, t0 + dur);
    osc.connect(g);
    g.connect(getBus(ctx).wet);
    osc.start(t0);
    lfo.start(t0);
    osc.stop(t0 + dur + 0.05);
    lfo.stop(t0 + dur + 0.05);
  });
  // One low bell on top.
  tone(110, 1.4, 'sine', 0.14, 0.05);
}

/** A short taste of a pack for the admin dashboard, whichever one is live: the
 *  go, a chime, the fanfare with confetti, then a ta-da. */
export function playPackSample(pack: SoundPack) {
  const at = (ms: number, fn: () => void) => setTimeout(() => {
    const before = forced;
    forced = pack;
    try { fn(); } finally { forced = before; }
  }, ms);
  at(0, () => playCountdownBeep(3));
  at(900, () => playSparkleChime());
  at(1500, () => { playWinFanfare(); playPartyPopper(); playCheer(1800); });
  at(3000, () => playTada());
}

// Bundle handed to the reveal components via the `sounds` prop.
export const sounds = {
  playDrumroll,
  playRevealBuild,
  playWinFanfare,
  playLoseTrombone,
  playRisingRumble,
  playApplause,
  playCheer,
  playPartyPopper,
  playTada,
  playSparkleChime,
  playPick,
  playKnock,
  playCreak,
  playSpookyStinger,
};
