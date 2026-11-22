/**
 * Transcripción del audio con Whisper, ejecutado en este ordenador mediante
 * Python. El audio llega ya convertido por el navegador (PCM 16 kHz mono).
 */
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import type { TranscriptResult } from '../src/domain/importTypes.ts';
import { config, ROOT } from './config.ts';
import { ProviderError } from './providers/types.ts';

const SCRIPT = join(ROOT, 'server', 'transcribe.py');

function run(args: string[], input?: Buffer, ms = 15 * 60_000): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(config.python, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => child.kill(), ms);
    child.stdout.on('data', (d: Buffer) => out.push(d));
    child.stderr.on('data', (d: Buffer) => err.push(d));
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') });
    });
    child.stdin.on('error', () => {});
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

let available: Promise<boolean> | null = null;

/** ¿Están Python y Whisper instalados? (se comprueba una vez). */
export function transcriptionAvailable(): Promise<boolean> {
  available ??= run(['-c', 'import whisper, numpy'], undefined, 60_000)
    .then((r) => r.code === 0)
    .catch(() => false);
  return available;
}

export async function transcribe(pcm16: Buffer, language = 'es'): Promise<TranscriptResult> {
  if (!(await transcriptionAvailable())) {
    throw new ProviderError('No está instalado Whisper (pip install openai-whisper).', 501);
  }
  const result = await run([SCRIPT, config.whisperModel, language], pcm16);
  let parsed: (TranscriptResult & { error?: string }) | null;
  try {
    parsed = JSON.parse(result.stdout.trim()) as TranscriptResult & { error?: string };
  } catch {
    parsed = null;
  }
  if (!parsed || parsed.error || result.code !== 0) {
    const detail = parsed?.error ?? result.stderr.trim().split(/\r?\n/).pop() ?? 'error desconocido';
    throw new ProviderError(`No se pudo transcribir el audio: ${detail}`, 500);
  }
  return parsed;
}
