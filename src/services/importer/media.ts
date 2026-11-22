/**
 * Trabajo con el vídeo en el propio navegador: sacar fotogramas (para que la
 * IA los mire y para elegir las fotos de la receta) y convertir el audio al
 * formato que espera Whisper (PCM de 16 bits, mono, 16 kHz). Así el servidor
 * no necesita ffmpeg y el vídeo nunca sale de este ordenador.
 */

export interface VideoFrame {
  /** Segundo del vídeo. */
  time: number;
  /** Fotograma a buena resolución, por si se elige como foto. */
  blob: Blob;
  url: string;
  width: number;
  height: number;
}

const FRAME_MAX_SIDE = 1280;
const AI_FRAME_SIDE = 640;

export class MediaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaError';
  }
}

function once(target: EventTarget, ok: string, ms = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => done(new MediaError('El vídeo tarda demasiado en responder.')), ms);
    const onOk = () => done();
    const onError = () => done(new MediaError('Este navegador no puede abrir el vídeo. Prueba con un MP4.'));
    function done(error?: Error) {
      window.clearTimeout(timer);
      target.removeEventListener(ok, onOk);
      target.removeEventListener('error', onError);
      if (error) reject(error);
      else resolve();
    }
    target.addEventListener(ok, onOk);
    target.addEventListener('error', onError);
  });
}

async function openVideo(src: string): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const ready = once(video, 'loadeddata', 30_000);
  video.src = src;
  await ready;
  // Algunos vídeos (grabados con el navegador, WebM) no dicen su duración
  // hasta que se salta al final.
  if (video.duration === Infinity) {
    const seeked = once(video, 'seeked');
    video.currentTime = 1e7;
    await seeked;
    video.currentTime = 0;
    await once(video, 'seeked');
  }
  if (!video.videoWidth || !Number.isFinite(video.duration)) {
    throw new MediaError('No se ve la imagen del vídeo. Prueba con otro archivo.');
  }
  return video;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new MediaError('No se pudo copiar el fotograma.'))), 'image/jpeg', quality),
  );
}

/**
 * Saca `count` fotogramas repartidos por el vídeo (sin el principio ni el
 * final del todo, que suelen ser rótulos o transiciones).
 */
export async function extractFrames(
  src: string,
  count: number,
  onProgress?: (done: number, total: number) => void,
): Promise<{ frames: VideoFrame[]; duration: number }> {
  const video = await openVideo(src);
  try {
    const duration = video.duration;
    const scale = Math.min(1, FRAME_MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new MediaError('No se pudo preparar el lienzo.');

    const frames: VideoFrame[] = [];
    const start = duration * 0.04;
    const span = duration * 0.92;
    for (let i = 0; i < count; i++) {
      const time = count === 1 ? duration / 2 : start + (span * i) / (count - 1);
      const seeked = once(video, 'seeked');
      video.currentTime = Math.min(time, Math.max(0, duration - 0.05));
      await seeked;
      ctx.drawImage(video, 0, 0, width, height);
      const blob = await canvasToBlob(canvas, 0.88);
      frames.push({ time, blob, url: URL.createObjectURL(blob), width, height });
      onProgress?.(i + 1, count);
    }
    return { frames, duration };
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

/** Fotograma pequeño en base64 (sin «data:») para el modelo de visión. */
export async function frameForAI(frame: VideoFrame): Promise<string> {
  const bitmap = await createImageBitmap(frame.blob);
  try {
    const scale = Math.min(1, AI_FRAME_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 0.8);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  } finally {
    bitmap.close();
  }
}

/**
 * Audio del vídeo a PCM 16 kHz mono (Int16). Devuelve null si el vídeo no
 * tiene sonido o el navegador no sabe leerlo.
 */
export async function extractAudio(file: Blob): Promise<ArrayBuffer | null> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx || typeof OfflineAudioContext === 'undefined') return null;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    return null;
  } finally {
    void ctx.close();
  }
  if (decoded.duration < 0.3) return null;

  const rate = 16_000;
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * rate), rate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);

  // ¿Hay algo de sonido? (vídeos solo con música muy baja o en silencio)
  let peak = 0;
  for (let i = 0; i < samples.length; i += 64) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 0.01) return null;

  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm.buffer;
}

/** Elige `n` índices repartidos entre `total` (para mandar a la IA). */
export function spreadIndices(total: number, n: number): number[] {
  if (total <= n) return Array.from({ length: total }, (_, i) => i);
  return Array.from({ length: n }, (_, i) => Math.round((i * (total - 1)) / (n - 1)));
}

export function releaseFrames(frames: VideoFrame[]): void {
  for (const f of frames) URL.revokeObjectURL(f.url);
}
