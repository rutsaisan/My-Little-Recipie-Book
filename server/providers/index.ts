import { config } from '../config.ts';
import { OllamaProvider } from './ollama.ts';
import { OpenAICompatibleProvider } from './openaiCompatible.ts';
import type { AIProvider } from './types.ts';

/** Elige el proveedor de IA según AI_PROVIDER. */
export function createProvider(): AIProvider {
  switch (config.provider) {
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config.baseUrl, config.apiKey, config.textModel, config.visionModel);
    case 'ollama':
    default:
      return new OllamaProvider(config.ollamaUrl, config.textModel, config.visionModel);
  }
}
