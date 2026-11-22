/**
 * Enlaces de TikTok e Instagram.
 *
 * - Con yt-dlp instalado: se leen el título y la descripción y se descarga
 *   el vídeo a una carpeta temporal para que el navegador saque fotogramas
 *   y audio.
 * - Sin yt-dlp: en TikTok se lee al menos el texto de la publicación con su
 *   oEmbed público; si no se puede, se pide subir el vídeo o pegar el texto.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { LinkResult } from '../src/domain/importTypes.ts';
import { config } from './config.ts';
import { ProviderError } from './providers/types.ts';

const HOSTS: { pattern: RegExp; platform: 'tiktok' | 'instagram' }[] = [
  { pattern: /(^|\.)tiktok\.com$/, platform: 'tiktok' },
  { pattern: /(^|\.)instagram\.com$/, platform: 'instagram' },
];

const VIDEO_TTL_MS = 60 * 60_000;

export function parseRecipeLink(raw: string): { url: URL; platform: 'tiktok' | 'instagram' } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ProviderError('Eso no parece un enlace. Cópialo entero desde la app (Compartir → Copiar enlace).', 400);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ProviderError('El enlace debe empezar por https://', 400);
  const host = url.hostname.toLowerCase();
  const match = HOSTS.find((h) => h.pattern.test(host));
  if (!match) throw new ProviderError('Por ahora solo se aceptan enlaces de TikTok o Instagram.', 400);
  url.hash = '';
  return { url, platform: match.platform };
}

function run(cmd: string, args: string[], ms: number): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { windowsHide: true });
    } catch {
      resolve({ code: 127, stdout: '', stderr: 'no encontrado' });
      return;
    }
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => child.kill(), ms);
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => err.push(d));
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: 127, stdout: '', stderr: 'no encontrado' });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') });
    });
  });
}

let ytDlp: Promise<boolean> | null = null;

export function linkDownloadAvailable(): Promise<boolean> {
  ytDlp ??= run(config.ytDlp, ['--version'], 20_000).then((r) => r.code === 0);
  return ytDlp;
}

function cleanOldVideos(): void {
  if (!existsSync(config.tmpDir)) return;
  for (const name of readdirSync(config.tmpDir)) {
    const file = join(config.tmpDir, name);
    try {
      if (Date.now() - statSync(file).mtimeMs > VIDEO_TTL_MS) rmSync(file, { force: true });
    } catch {
      // otro proceso lo estará usando
    }
  }
}

interface YtDlpInfo {
  title?: string;
  description?: string;
  uploader?: string;
}

async function withYtDlp(url: URL): Promise<LinkResult> {
  const info = await run(config.ytDlp, ['-J', '--no-playlist', '--no-warnings', url.href], 90_000);
  if (info.code !== 0) {
    throw new ProviderError(
      'No se ha podido abrir el vídeo (puede ser privado o necesitar iniciar sesión). Prueba a subir el vídeo o a pegar el texto.',
      422,
    );
  }
  const meta = JSON.parse(info.stdout) as YtDlpInfo;

  mkdirSync(config.tmpDir, { recursive: true });
  cleanOldVideos();
  const id = randomUUID();
  const output = join(config.tmpDir, `${id}.mp4`);
  // Se prefiere H.264, que cualquier navegador sabe decodificar.
  const download = await run(
    config.ytDlp,
    ['--no-playlist', '--no-warnings', '-f', 'b[vcodec^=avc1]/b[ext=mp4]/b', '--max-filesize', '300M', '-o', output, url.href],
    5 * 60_000,
  );
  const ok = download.code === 0 && existsSync(output);
  return {
    title: meta.title?.trim() || null,
    description: meta.description?.trim() || null,
    uploader: meta.uploader?.trim() || null,
    videoUrl: ok ? `/api/import/video/${id}` : null,
  };
}

/** Texto de la publicación de TikTok mediante su oEmbed público. */
async function tiktokCaption(url: URL): Promise<LinkResult | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.href)}`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string };
    if (!data.title?.trim()) return null;
    return { title: null, description: data.title.trim(), uploader: data.author_name ?? null, videoUrl: null };
  } catch {
    return null;
  }
}

export async function processLink(raw: string): Promise<LinkResult & { notes: string[] }> {
  const { url, platform } = parseRecipeLink(raw);
  if (await linkDownloadAvailable()) {
    const result = await withYtDlp(url);
    return { ...result, notes: result.videoUrl ? [] : ['Se ha leído el texto, pero el vídeo no se ha podido descargar.'] };
  }
  if (platform === 'tiktok') {
    const caption = await tiktokCaption(url);
    if (caption) {
      return {
        ...caption,
        notes: ['Solo se ha podido leer el texto de la publicación. Para ver y oír el vídeo, súbelo o instala yt-dlp.'],
      };
    }
  }
  throw new ProviderError(
    'Este ordenador no puede descargar vídeos de enlaces (falta yt-dlp). Sube el vídeo guardado o pega el texto de la receta.',
    422,
  );
}

/** Sirve un vídeo descargado (solo los ids que hemos creado). */
export function openVideo(id: string): { stream: NodeJS.ReadableStream; size: number } | null {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const file = join(config.tmpDir, `${id}.mp4`);
  if (!existsSync(file)) return null;
  return { stream: createReadStream(file), size: statSync(file).size };
}
