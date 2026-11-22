// All sound is synthesized with the Web Audio API — no audio files, no
// network. Footsteps tell the player where a guard is: a soft tick that
// rises in pitch the closer a chasing guard gets.
let audioCtx = null;
let muted = false;

export function ensureAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      audioCtx = null;
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type, gain, when = 0) {
  if (muted) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** A footstep tick. `near` (0..1) is how close the nearest chasing guard is. */
export function playStep(sneaking, near = 0) {
  tone(sneaking ? 190 : 130, 0.06, 'triangle', sneaking ? 0.02 : 0.045 + near * 0.05);
}

/** Two-note sting when a guard's awareness fills. */
export function playAlert() {
  tone(620, 0.14, 'square', 0.06);
  tone(880, 0.2, 'square', 0.06, 0.12);
}

/** Bright chime when a relic is pocketed. */
export function playPickup(combo) {
  const base = 660 + combo * 110;
  tone(base, 0.12, 'sine', 0.07);
  tone(base * 1.5, 0.18, 'sine', 0.06, 0.08);
}

/** Low alarm swell when the alarm level rises. */
export function playAlarm() {
  tone(220, 0.5, 'sawtooth', 0.05);
  tone(233, 0.5, 'sawtooth', 0.05, 0.1);
}

/** Soft puff for a smoke bomb, click for a decoy toss. */
export function playSmoke() {
  tone(300, 0.3, 'sine', 0.05);
}

export function playDecoy() {
  tone(1200, 0.05, 'square', 0.04);
  tone(900, 0.05, 'square', 0.04, 0.07);
}

/** Fanfare when a gallery is cleared. */
export function playClear() {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.07, i * 0.11));
}
