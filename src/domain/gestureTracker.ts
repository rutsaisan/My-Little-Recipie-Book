/**
 * Convierte lo que ve la cámara (dónde está la mano y qué forma tiene, en cada
 * fotograma) en gestos con intención:
 *
 *   - deslizar la mano hacia tu izquierda  → «siguiente»
 *   - deslizar la mano hacia tu derecha    → «anterior»
 *   - mano abierta quieta un momento       → «palma» (repetir / parar alarma)
 *   - pulgar arriba quieto un momento      → «pulgar» (temporizador sugerido)
 *
 * Es lógica pura (sin cámara ni navegador) para poder probarla. Las
 * coordenadas ya llegan como en un espejo: x = 0 a tu izquierda, 1 a tu derecha.
 */

export type HandGesture = 'next' | 'previous' | 'palm' | 'thumbUp';

export interface HandFrame {
  /** Centro de la mano (0–1, como en un espejo). */
  x: number;
  y: number;
  /** Forma reconocida por el modelo («Open_Palm», «Thumb_Up»…). */
  shape: string;
  score: number;
}

export interface TrackerOptions {
  /** Distancia horizontal mínima de un deslizamiento (fracción del ancho). */
  swipeDistance: number;
  /** Tiempo máximo para recorrerla (ms). */
  swipeTime: number;
  /** Cuánto hay que mantener una forma para que cuente (ms). */
  holdTime: number;
  /** Pausa tras un gesto para no repetirlo sin querer (ms). */
  cooldown: number;
}

const DEFAULTS: TrackerOptions = { swipeDistance: 0.22, swipeTime: 550, holdTime: 700, cooldown: 1100 };

export class GestureTracker {
  private readonly options: TrackerOptions;
  private trail: { t: number; x: number; y: number }[] = [];
  private hold: { shape: string; since: number; x: number; y: number } | null = null;
  private quietUntil = 0;

  constructor(options: Partial<TrackerOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Se llama en cada fotograma; devuelve un gesto cuando se completa. */
  update(t: number, frame: HandFrame | null): HandGesture | null {
    if (!frame) {
      this.trail = [];
      this.hold = null;
      return null;
    }
    if (t < this.quietUntil) {
      this.trail = [];
      this.hold = null;
      return null;
    }

    // ── Deslizar ──
    const { swipeDistance, swipeTime, holdTime } = this.options;
    this.trail.push({ t, x: frame.x, y: frame.y });
    this.trail = this.trail.filter((p) => t - p.t <= swipeTime);
    const first = this.trail[0];
    const dx = frame.x - first.x;
    const dy = frame.y - first.y;
    if (Math.abs(dx) >= swipeDistance && Math.abs(dx) > Math.abs(dy) * 1.5) {
      return this.fire(t, dx < 0 ? 'next' : 'previous');
    }

    // ── Mantener una forma (con la mano casi quieta) ──
    const shape = frame.score >= 0.6 ? frame.shape : 'None';
    const holdable = shape === 'Open_Palm' || shape === 'Thumb_Up';
    if (!holdable) {
      this.hold = null;
      return null;
    }
    if (!this.hold || this.hold.shape !== shape || Math.hypot(frame.x - this.hold.x, frame.y - this.hold.y) > 0.08) {
      this.hold = { shape, since: t, x: frame.x, y: frame.y };
      return null;
    }
    if (t - this.hold.since >= holdTime) {
      return this.fire(t, shape === 'Open_Palm' ? 'palm' : 'thumbUp');
    }
    return null;
  }

  /** Progreso (0–1) del gesto que se está manteniendo, para dar pistas en pantalla. */
  holdProgress(t: number): { shape: string; progress: number } | null {
    if (!this.hold) return null;
    return { shape: this.hold.shape, progress: Math.min(1, (t - this.hold.since) / this.options.holdTime) };
  }

  private fire(t: number, gesture: HandGesture): HandGesture {
    this.trail = [];
    this.hold = null;
    this.quietUntil = t + this.options.cooldown;
    return gesture;
  }
}
