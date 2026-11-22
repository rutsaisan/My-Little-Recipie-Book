/**
 * Cualquier servicio con la API de OpenAI (OpenAI, Groq, OpenRouter,
 * LM Studio…). La clave se lee de AI_API_KEY solo en el servidor.
 */
import { fetchWithTimeout, parseJSONLoose, ProviderError, type AIProvider, type ProviderHealth } from './types.ts';

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string;
  readonly baseUrl: string;
  readonly textModel: string;
  readonly visionModel: string | null;
  readonly #apiKey: string;

  constructor(baseUrl: string, apiKey: string, textModel: string, visionModel: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.#apiKey = apiKey;
    this.textModel = textModel;
    this.visionModel = visionModel || null;
    this.name = `Servicio compatible con OpenAI (${new URL(this.baseUrl).host})`;
  }

  async health(): Promise<ProviderHealth> {
    if (!this.#apiKey && !/localhost|127\.0\.0\.1/.test(this.baseUrl)) {
      return { ok: false, vision: false, message: 'Falta AI_API_KEY en el archivo .env del servidor.' };
    }
    try {
      const res = await fetchWithTimeout(`${this.baseUrl}/models`, { headers: this.headers() }, 5000);
      if (!res.ok) return { ok: false, vision: false, message: `El servicio de IA respondió ${res.status}.` };
    } catch {
      return { ok: false, vision: false, message: 'El servicio de IA no responde.' };
    }
    return { ok: true, vision: this.visionModel !== null };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.#apiKey) headers.Authorization = `Bearer ${this.#apiKey}`;
    return headers;
  }

  private async complete(body: object): Promise<string> {
    const res = await fetchWithTimeout(
      `${this.baseUrl}/chat/completions`,
      { method: 'POST', headers: this.headers(), body: JSON.stringify(body) },
      5 * 60_000,
    );
    const data = (await res.json()) as ChatResponse;
    if (!res.ok) throw new ProviderError(`Servicio de IA: ${data.error?.message ?? res.statusText}`);
    return data.choices?.[0]?.message?.content ?? '';
  }

  async chatJSON<T>(system: string, user: string, schema: object): Promise<T> {
    const content = await this.complete({
      model: this.textModel,
      temperature: 0,
      response_format: { type: 'json_schema', json_schema: { name: 'receta', schema } },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return parseJSONLoose<T>(content);
  }

  async describeImage(prompt: string, imageBase64: string): Promise<string> {
    if (!this.visionModel) throw new ProviderError('No hay modelo de visión configurado.', 501);
    const content = await this.complete({
      model: this.visionModel,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        },
      ],
    });
    return content.trim();
  }
}
