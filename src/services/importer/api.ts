/**
 * Cliente del servidor local de importación. El navegador nunca habla
 * directamente con los servicios de IA ni conoce sus claves.
 */
import type {
  AnalyzeRequest,
  AnalyzeResult,
  ImportCapabilities,
  LinkResult,
  TranscriptResult,
} from '../../domain/importTypes';

const BASE = '/api/import';

export class ImportApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ImportApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ImportApiError('No encuentro el ayudante de importación. ¿Está en marcha con «npm run dev»?', 0);
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok || data === null) {
    const message =
      (data as { error?: string } | null)?.error ??
      (res.status === 502 || res.status === 504 || res.status === 500
        ? 'El ayudante de importación no responde. ¿Está en marcha con «npm run dev»?'
        : `Algo ha fallado (${res.status}).`);
    throw new ImportApiError(message, res.status);
  }
  return data as T;
}

/**
 * En la versión publicada (GitHub Pages) no hay servidor de importación:
 * el flujo de publicación compila con VITE_IMPORT_SERVER=off.
 */
export const importServerAvailable = import.meta.env.VITE_IMPORT_SERVER !== 'off';

export function getCapabilities(): Promise<ImportCapabilities> {
  if (!importServerAvailable) {
    return Promise.reject(
      new ImportApiError(
        'La versión publicada en internet no puede sacar recetas de vídeos: la IA funciona en un ordenador con la app instalada.',
        0,
      ),
    );
  }
  return request('/capabilities');
}

export function processLink(url: string): Promise<LinkResult & { notes: string[] }> {
  return request('/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
}

export function transcribeAudio(pcm: ArrayBuffer, language = 'es'): Promise<TranscriptResult> {
  return request(`/transcribe?lang=${encodeURIComponent(language)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: pcm,
  });
}

export function analyze(body: AnalyzeRequest): Promise<AnalyzeResult> {
  return request('/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function downloadVideo(videoUrl: string): Promise<Blob> {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new ImportApiError('El vídeo descargado ya no está disponible.', res.status);
  return res.blob();
}
