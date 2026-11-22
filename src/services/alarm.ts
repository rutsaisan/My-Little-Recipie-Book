/**
 * Aviso sonoro de los temporizadores: un «tilín-tilín» de campanita que se
 * repite hasta que se para (como mucho medio minuto).
 */

let ctx: AudioContext | null = null;
let loop: number | null = null;
let stopAt = 0;

function context(): AudioContext | null {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Llamar al crear un temporizador (desde un clic): desbloquea el audio. */
export function primeAlarm(): void {
  const c = context();
  if (c?.state === 'suspended') void c.resume();
}

function ding(c: AudioContext, freq: number, at: number) {
  for (const [ratio, level, decay] of [
    [1, 0.22, 1.2],
    [2.76, 0.06, 0.5],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(level, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + decay + 0.05);
  }
}

export function startAlarm(): void {
  const c = context();
  if (!c) return;
  void c.resume();
  stopAt = Date.now() + 30_000;
  if (loop !== null) return;
  const pattern = () => {
    if (Date.now() > stopAt) return stopAlarm();
    const t = c.currentTime + 0.02;
    ding(c, 1318.5, t);
    ding(c, 1046.5, t + 0.22);
    ding(c, 1318.5, t + 0.44);
  };
  pattern();
  loop = window.setInterval(pattern, 1800);
}

export function stopAlarm(): void {
  if (loop !== null) window.clearInterval(loop);
  loop = null;
}
