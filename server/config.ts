/**
 * Configuración del servidor local de importación.
 *
 * Todo sale de variables de entorno (archivo `.env` en la raíz o del propio
 * sistema). Las claves de servicios externos viven SOLO aquí, en el
 * servidor: nunca llegan al navegador.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Lee `.env` (formato CLAVE=valor) sin pisar lo que ya venga del sistema. */
function loadDotEnv(): void {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trimStart().startsWith('#')) continue;
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const value = match[2].replace(/^(["'])(.*)\1$/, '$2');
    if (process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}
loadDotEnv();

const env = (name: string, fallback: string) => process.env[name]?.trim() || fallback;

export type ProviderKind = 'ollama' | 'openai-compatible';

export const config = {
  port: Number(env('IMPORT_SERVER_PORT', '8787')),
  provider: env('AI_PROVIDER', 'ollama') as ProviderKind,
  ollamaUrl: env('OLLAMA_URL', 'http://127.0.0.1:11434'),
  /** Modelo que ordena el texto en receta. */
  textModel: env('AI_TEXT_MODEL', 'qwen3:8b'),
  /** Modelo que mira los fotogramas («none» = no mirar imágenes). */
  visionModel: env('AI_VISION_MODEL', 'gemma3:4b') === 'none' ? '' : env('AI_VISION_MODEL', 'gemma3:4b'),
  /** Para AI_PROVIDER=openai-compatible (OpenAI, Groq, LM Studio, OpenRouter…). */
  baseUrl: env('AI_BASE_URL', 'https://api.openai.com/v1'),
  apiKey: process.env.AI_API_KEY?.trim() ?? '',
  whisperModel: env('WHISPER_MODEL', 'base'),
  python: env('PYTHON', process.platform === 'win32' ? 'python' : 'python3'),
  ytDlp: env('YT_DLP', 'yt-dlp'),
  /** Carpeta temporal para los vídeos descargados. */
  tmpDir: join(ROOT, 'node_modules', '.import-cache'),
  /** Tamaño máximo de lo que se sube (audio), en MB. */
  maxUploadMb: Number(env('IMPORT_MAX_UPLOAD_MB', '120')),
};
