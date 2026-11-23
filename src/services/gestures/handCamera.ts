/**
 * Cámara + reconocimiento de manos (MediaPipe Gesture Recognizer).
 *
 * Todo ocurre en el navegador: las imágenes de la cámara nunca salen del
 * dispositivo. La primera vez se descargan el motor (WebAssembly) y el modelo
 * de gestos (unos 20 MB en total); después quedan guardados para usarlos sin
 * conexión. La cámara solo se enciende al pulsar «Manos libres» y se apaga al
 * desactivarlo o al salir del modo cocina.
 */
import type { GestureRecognizer } from '@mediapipe/tasks-vision';
import { GestureTracker, type HandFrame, type HandGesture } from '../../domain/gestureTracker';

declare const __MEDIAPIPE_VERSION__: string;
const VERSION = __MEDIAPIPE_VERSION__;
export const GESTURE_WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
export const GESTURE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task';

export type HandCameraStatus = 'loading' | 'ready' | 'no-hand' | 'error';

export interface HandCameraCallbacks {
  onGesture: (gesture: HandGesture) => void;
  onStatus: (status: HandCameraStatus, detail?: string) => void;
  /** Forma que se está manteniendo y cuánto falta (para dar pistas). */
  onHold?: (hold: { shape: string; progress: number } | null) => void;
}

export interface HandCamera {
  stop: () => void;
}

let recognizerPromise: Promise<GestureRecognizer> | null = null;

async function loadRecognizer(): Promise<GestureRecognizer> {
  // El motor de visión solo se descarga si alguien activa «Manos libres».
  const { FilesetResolver, GestureRecognizer } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(GESTURE_WASM_BASE);
  const create = (delegate: 'GPU' | 'CPU') =>
    GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: GESTURE_MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.6,
      minHandPresenceConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
  try {
    return await create('GPU');
  } catch {
    return await create('CPU');
  }
}

function cameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'No tengo permiso para usar la cámara. Puedes darlo en los ajustes del navegador (el candado junto a la dirección).';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No encuentro ninguna cámara en este dispositivo.';
  if (name === 'NotReadableError') return 'La cámara está ocupada por otra aplicación.';
  return 'No he podido encender la cámara o cargar el reconocimiento de gestos. Comprueba la conexión la primera vez.';
}

export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function startHandCamera(video: HTMLVideoElement, callbacks: HandCameraCallbacks): HandCamera {
  let stopped = false;
  let stream: MediaStream | null = null;
  let frame = 0;
  let lastTime = -1;
  let lastSeen = 0;
  let lastStatus: HandCameraStatus | null = null;
  const tracker = new GestureTracker();

  const status = (s: HandCameraStatus, detail?: string) => {
    if (s === lastStatus && !detail) return;
    lastStatus = s;
    callbacks.onStatus(s, detail);
  };

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };

  (async () => {
    status('loading');
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      if (stopped) return stop();
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      recognizerPromise ??= loadRecognizer();
      const recognizer = await recognizerPromise.catch((error: unknown) => {
        recognizerPromise = null;
        throw error;
      });
      if (stopped) return;
      status('ready');

      // ~15 análisis por segundo: suficiente para los gestos y ligero para el móvil.
      let lastRun = 0;
      const loop = (now: number) => {
        if (stopped) return;
        frame = requestAnimationFrame(loop);
        if (now - lastRun < 66 || video.readyState < 2 || video.currentTime === lastTime) return;
        lastRun = now;
        lastTime = video.currentTime;
        const result = recognizer.recognizeForVideo(video, now);
        const landmarks = result.landmarks[0];
        let hand: HandFrame | null = null;
        if (landmarks?.length) {
          // Centro de la palma (muñeca y nudillos), en espejo como lo ve la persona.
          const ids = [0, 5, 9, 13, 17];
          const cx = ids.reduce((s, i) => s + landmarks[i].x, 0) / ids.length;
          const cy = ids.reduce((s, i) => s + landmarks[i].y, 0) / ids.length;
          const top = result.gestures[0]?.[0];
          hand = { x: 1 - cx, y: cy, shape: top?.categoryName ?? 'None', score: top?.score ?? 0 };
          lastSeen = now;
          status('ready');
        } else if (now - lastSeen > 4000) {
          status('no-hand');
        }
        const gesture = tracker.update(now, hand);
        callbacks.onHold?.(tracker.holdProgress(now));
        if (gesture) callbacks.onGesture(gesture);
      };
      frame = requestAnimationFrame(loop);
    } catch (error) {
      stop();
      status('error', cameraError(error));
    }
  })();

  return { stop };
}
