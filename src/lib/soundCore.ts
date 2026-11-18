// What every sound pack shares: the one AudioContext, and the mute switch.
// Mute is remembered per browser; every sound asks getAudio() for the context,
// so one flag silences both packs, and muting also suspends the context so
// sounds that are already scheduled stop at once.

let audioCtx: AudioContext | null = null;

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

export function getAudio(): AudioContext | null {
  if (muted) return null;
  if (audioCtx) return audioCtx;
  try { audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
  catch { audioCtx = null; }
  return audioCtx;
}

// A pack that caches nodes tied to the context (the cheerful pack's reverb bus)
// registers here to drop them when the context is swapped.
const listeners = new Set<() => void>();
export function onContextChange(fn: () => void) {
  listeners.add(fn);
}

/** Swap in another context, e.g. an OfflineAudioContext to render a sound to a
 *  buffer (the /dev/sounds page uses it to check levels). Pass null to go back
 *  to the live one. */
export function useAudioContext(ctx: BaseAudioContext | null) {
  audioCtx = ctx as unknown as AudioContext | null;
  listeners.forEach((fn) => fn());
}

/** Browsers start the context suspended until a gesture; an offline one is
 *  rendered by startRendering() and can't be resumed. */
export function ready(ctx: AudioContext) {
  if (ctx.state === 'suspended' && !('startRendering' in ctx)) void ctx.resume();
}
