/**
 * Servidor local de importación (fase 4).
 *
 * Solo escucha en 127.0.0.1: es un ayudante de la app en este ordenador,
 * no un servicio público. En desarrollo, Vite le reenvía las rutas /api.
 *
 *   GET  /api/import/capabilities  qué se puede hacer aquí
 *   POST /api/import/link          { url } → texto de la publicación y vídeo
 *   GET  /api/import/video/:id     vídeo descargado (temporal)
 *   POST /api/import/transcribe    audio PCM 16 kHz mono → texto
 *   POST /api/import/analyze       transcripción + texto + fotogramas → receta
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AnalyzeRequest, ImportCapabilities } from '../src/domain/importTypes.ts';
import { analyzeVideo } from './analyze.ts';
import { config } from './config.ts';
import { linkDownloadAvailable, openVideo, processLink } from './link.ts';
import { createProvider } from './providers/index.ts';
import { ProviderError } from './providers/types.ts';
import { transcribe, transcriptionAvailable } from './transcribe.ts';

const provider = createProvider();

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(json);
}

async function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) throw new ProviderError('El archivo es demasiado grande.', 413);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJSON<T>(req: IncomingMessage, maxBytes: number): Promise<T> {
  const body = await readBody(req, maxBytes);
  try {
    return JSON.parse(body.toString('utf8')) as T;
  } catch {
    throw new ProviderError('Petición mal formada.', 400);
  }
}

async function capabilities(): Promise<ImportCapabilities> {
  const [health, transcription, links] = await Promise.all([
    provider.health(),
    transcriptionAvailable(),
    linkDownloadAvailable(),
  ]);
  const notes: string[] = [];
  if (health.message) notes.push(health.message);
  if (!transcription) notes.push('Sin Whisper no se puede oír el audio: pega lo que dice el vídeo o su texto.');
  if (!links) notes.push('Sin yt-dlp los enlaces solo dan el texto de la publicación (TikTok). Puedes subir el vídeo.');
  return {
    ai: health.ok,
    provider: provider.name,
    textModel: provider.textModel,
    visionModel: health.vision ? provider.visionModel : null,
    transcription,
    links,
    notes,
  };
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/import/capabilities') return send(res, 200, await capabilities());

  if (route === 'POST /api/import/link') {
    const { url: link } = await readJSON<{ url?: string }>(req, 10_000);
    return send(res, 200, await processLink(String(link ?? '')));
  }

  const video = /^\/api\/import\/video\/([\w-]+)$/.exec(url.pathname);
  if (req.method === 'GET' && video) {
    const file = openVideo(video[1]);
    if (!file) return send(res, 404, { error: 'Ese vídeo ya no está disponible.' });
    res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': file.size, 'Cache-Control': 'no-store' });
    file.stream.pipe(res);
    return;
  }

  if (route === 'POST /api/import/transcribe') {
    const audio = await readBody(req, config.maxUploadMb * 1024 * 1024);
    const language = url.searchParams.get('lang') ?? 'es';
    return send(res, 200, await transcribe(audio, /^[a-z]{2}$/.test(language) ? language : 'es'));
  }

  if (route === 'POST /api/import/analyze') {
    const body = await readJSON<Partial<AnalyzeRequest>>(req, 40 * 1024 * 1024);
    const health = await provider.health();
    if (!health.ok) throw new ProviderError(health.message ?? 'La IA no está disponible.', 503);
    const request: AnalyzeRequest = {
      transcript: typeof body.transcript === 'string' ? body.transcript : '',
      description: typeof body.description === 'string' ? body.description : '',
      frames: Array.isArray(body.frames) ? body.frames.filter((f): f is string => typeof f === 'string') : [],
      frameTimes: Array.isArray(body.frameTimes) ? body.frameTimes.map(Number) : [],
    };
    return send(res, 200, await analyzeVideo(provider, request, health.vision));
  }

  send(res, 404, { error: 'No existe.' });
}

const server = createServer((req, res) => {
  handle(req, res).catch((error: unknown) => {
    const status = error instanceof ProviderError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Error inesperado.';
    if (status >= 500) console.error('[importación]', error);
    if (!res.headersSent) send(res, status, { error: message });
    else res.end();
  });
});

server.listen(config.port, '127.0.0.1', () => {
  console.log(`[importación] Servidor en http://127.0.0.1:${config.port} · IA: ${provider.name} (${provider.textModel})`);
});
