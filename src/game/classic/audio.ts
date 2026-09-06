/**
 * Synthesized sound effects (mouse squeaks), ported from ieee-ras-mouse-maze.
 * A module-level singleton so mute state and the AudioContext persist across
 * tab switches between Classic Maze and First-Person.
 */

let actx: AudioContext | null = null;
let muted = false;
let munchFlip = false;
let lastMunch = 0;

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function audioInit(): void {
  if (!actx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    actx = new AC();
  }
  if (actx.state === "suspended") actx.resume();
}

function squeak(f0: number, f1: number, dur: number, vol = 0.18, type: OscillatorType = "sine", wobble = 0): void {
  if (muted || !actx) return;
  const t = actx.currentTime;
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
  if (wobble) {
    const lfo = actx.createOscillator();
    const lg = actx.createGain();
    lfo.frequency.value = wobble;
    lg.gain.value = f0 * 0.12;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur);
  }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(actx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export function sndMunch(): void {
  const now = performance.now();
  if (now - lastMunch < 70) return;
  lastMunch = now;
  munchFlip = !munchFlip;
  squeak(munchFlip ? 900 : 1150, munchFlip ? 1500 : 1900, 0.07, 0.1);
}
export function sndCheese(): void {
  squeak(700, 2400, 0.35, 0.2, "sine", 30);
  setTimeout(() => squeak(900, 2800, 0.3, 0.15), 120);
}
export function sndEatRobot(): void {
  squeak(1800, 600, 0.18, 0.2, "square");
  squeak(2200, 2900, 0.12, 0.12);
}
export function sndDeath(): void {
  squeak(2200, 300, 0.9, 0.22, "sine", 12);
  setTimeout(() => squeak(800, 150, 0.5, 0.15, "sine", 8), 500);
}
export function sndLevel(): void {
  [0, 120, 240, 360].forEach((d, i) => setTimeout(() => squeak(600 * (i + 1) * 0.8, 900 * (i + 1) * 0.8, 0.12, 0.12), d));
}
/**
 * The proximity tick: one blip, pitched and weighted by how close the nearest
 * robot is.
 *
 * First-person has no rear view of its own to rely on, so a robot arriving
 * from behind used to be an unsignalled death. This is the mouse hearing what
 * it cannot see. It deliberately reads straight-line distance and so carries
 * through walls — a robot two tiles away round a corner is a robot two tiles
 * away, and being told so is the difference between tense and unfair.
 *
 * The caller owns the interval between ticks; this only makes the sound.
 */
export function sndPing(closeness: number): void {
  const c = Math.max(0, Math.min(1, closeness));
  const f = 360 + c * 520;
  squeak(f, f * 0.84, 0.05, 0.04 + c * 0.08, "triangle");
}

export function sndStart(): void {
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => squeak(f, f * 1.02, 0.14, 0.12, "triangle"), i * 130));
}
