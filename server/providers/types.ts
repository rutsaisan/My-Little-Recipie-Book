/**
 * Interfaz común para los servicios de IA. Añadir un proveedor nuevo es
 * escribir un archivo que cumpla esto y registrarlo en `providers/index.ts`.
 */
export interface ProviderHealth {
  ok: boolean;
  vision: boolean;
  message?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly textModel: string;
  readonly visionModel: string | null;
  /** ¿Responde y tiene los modelos? Devuelve un aviso si falta algo. */
  health(): Promise<ProviderHealth>;
  /** Respuesta en JSON que cumple el esquema dado. */
  chatJSON<T>(system: string, user: string, schema: object): Promise<T>;
  /** Describe una imagen (JPEG en base64) siguiendo la instrucción. */
  describeImage(prompt: string, imageBase64: string): Promise<string>;
}

export class ProviderError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/** fetch con tiempo límite (los modelos locales pueden tardar). */
export async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'tardó demasiado' : 'no responde';
    throw new ProviderError(`El servicio de IA ${reason} (${new URL(url).host}).`, 503);
  }
}

/** Extrae el primer objeto JSON de un texto (por si el modelo añade algo). */
export function parseJSONLoose<T>(text: string): T {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        // cae al error de abajo
      }
    }
    throw new ProviderError('La IA no devolvió una respuesta válida.');
  }
}
