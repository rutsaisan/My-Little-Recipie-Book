/** Ollama: modelos locales, gratis y sin enviar nada fuera del ordenador. */
import { fetchWithTimeout, parseJSONLoose, ProviderError, type AIProvider, type ProviderHealth } from './types.ts';

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

export class OllamaProvider implements AIProvider {
  readonly name = 'Ollama (en este ordenador)';
  readonly url: string;
  readonly textModel: string;
  readonly visionModel: string | null;

  constructor(url: string, textModel: string, visionModel: string) {
    this.url = url.replace(/\/$/, '');
    this.textModel = textModel;
    this.visionModel = visionModel || null;
  }

  async health(): Promise<ProviderHealth> {
    let models: string[];
    try {
      const res = await fetchWithTimeout(`${this.url}/api/tags`, {}, 3000);
      const data = (await res.json()) as { models?: { name: string }[] };
      models = (data.models ?? []).map((m) => m.name);
    } catch {
      return { ok: false, vision: false, message: 'Ollama no está en marcha. Ábrelo o ejecuta «ollama serve».' };
    }
    const has = (model: string) => models.some((m) => m === model || m === `${model}:latest`);
    if (!has(this.textModel)) {
      return { ok: false, vision: false, message: `Falta el modelo ${this.textModel}: «ollama pull ${this.textModel}».` };
    }
    const vision = this.visionModel !== null && has(this.visionModel);
    return {
      ok: true,
      vision,
      message: this.visionModel && !vision ? `Sin el modelo ${this.visionModel} no se mirarán las imágenes.` : undefined,
    };
  }

  private async chat(body: object, ms: number): Promise<string> {
    const res = await fetchWithTimeout(
      `${this.url}/api/chat`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stream: false, ...body }) },
      ms,
    );
    const data = (await res.json()) as OllamaChatResponse;
    if (!res.ok || data.error) throw new ProviderError(`Ollama: ${data.error ?? res.statusText}`);
    return data.message?.content ?? '';
  }

  async chatJSON<T>(system: string, user: string, schema: object): Promise<T> {
    const content = await this.chat(
      {
        model: this.textModel,
        think: false,
        format: schema,
        options: { temperature: 0, num_ctx: 16384 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      },
      10 * 60_000,
    );
    return parseJSONLoose<T>(content);
  }

  async describeImage(prompt: string, imageBase64: string): Promise<string> {
    if (!this.visionModel) throw new ProviderError('No hay modelo de visión configurado.', 501);
    const content = await this.chat(
      {
        model: this.visionModel,
        options: { temperature: 0 },
        messages: [{ role: 'user', content: prompt, images: [imageBase64] }],
      },
      5 * 60_000,
    );
    return content.trim();
  }
}
