/**
 * Preguntas a Tom con IA, a través del servidor local (que habla con Ollama
 * u otro proveedor). En la versión publicada no hay servidor: Tom lo explica.
 */
import type { Recipe } from '../../domain/recipe';
import { ingredientToText } from '../../domain/ingredients';
import { answerQuestion } from '../../domain/kitchenHelp';
import { importServerAvailable } from '../importer/api';

export interface TomAIStatus {
  ai: boolean;
  /** Qué falta, en palabras para la persona (si falta algo). */
  message: string | null;
}

const OFFLINE_WEB =
  'Para responder dudas necesito Ollama, una IA que funciona en tu ordenador. En esta versión de internet no está disponible.';

export async function getTomStatus(): Promise<TomAIStatus> {
  if (!importServerAvailable) return { ai: false, message: OFFLINE_WEB };
  try {
    const res = await fetch('/api/assistant/status', { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { ai?: boolean; message?: string | null };
    return { ai: data.ai === true, message: data.ai ? null : (data.message ?? 'La IA no está disponible ahora mismo.') };
  } catch {
    return {
      ai: false,
      message: 'No encuentro el ayudante de IA. Arranca la app con «npm run dev» y abre Ollama.',
    };
  }
}

export async function askTom(question: string, recipe: Recipe | null): Promise<string> {
  // Si la lista de respuestas de Tom ya sabe algo fiable, la IA se apoya en ello.
  const known = answerQuestion(question);
  const body = {
    question,
    reference: known.known ? known.answer : null,
    recipe: recipe
      ? {
          title: recipe.title,
          ingredients: recipe.ingredients.map((i) => ingredientToText(i)),
          steps: recipe.steps.map((s) => s.text),
        }
      : null,
  };
  let res: Response;
  try {
    res = await fetch('/api/assistant/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4 * 60_000),
    });
  } catch {
    throw new Error('Me he quedado pensando demasiado y no me llega la respuesta. ¿Lo intentamos otra vez?');
  }
  const data = (await res.json().catch(() => null)) as { answer?: string; error?: string } | null;
  if (!res.ok || !data?.answer) throw new Error(data?.error ?? 'No he podido pensar la respuesta ahora mismo.');
  return data.answer;
}
