/**
 * Tom con IA: responde dudas de cocina y de la app con el modelo de texto
 * configurado (Ollama por defecto). Respuestas cortas, cálidas y honestas:
 * si no lo sabe, lo dice.
 */
import { ProviderError, type AIProvider } from './providers/types.ts';

export interface AskRequest {
  question: string;
  /** Dato fiable de la lista de respuestas de la app, si lo hay. */
  reference?: string | null;
  /** Receta que se está viendo, por si la pregunta va sobre ella. */
  recipe?: { title: string; ingredients: string[]; steps: string[] } | null;
}

const APP_GUIDE = `Cómo funciona la app «My Little Recipe Book» (úsalo solo si preguntan por la app):
- «Nueva receta» (arriba): escribirla a mano, dictarla con la voz o sacarla de un vídeo de TikTok/Instagram. Siempre se revisa en el formulario antes de guardar.
- Formulario en tres apartados: fotografías (una final o una por paso), ingredientes y elaboración (pasos reordenables), más «información adicional» (sección, tiempos, comensales, dificultad, notas, «por probar»).
- Pasar página: botones, flechas del teclado, esquinas o arrastrando la hoja con el dedo o el ratón.
- «Índice», «Marcar página» (cinta marcapáginas) y «Buscar» (por nombre, ingrediente o notas; filtros de favoritas, recientes, por probar).
- En cada receta: corazón (favorita), olla («¡La he cocinado!», suma insignias), ▶ (cocinar paso a paso con voz y temporizadores), lápiz (editar), comensales − / + recalcula cantidades.
- Menú ⋯: «Mi álbum de insignias» y «Personalizar el libro» (nombre, frase de portada, pegatinas, mantel, marcapáginas, música, notificaciones).
- Tom (yo): temporizadores, leer la receta en voz alta, responder dudas.
- Las recetas se guardan solo en este navegador/dispositivo.`;

const SYSTEM = `Eres Tom, un gatito cocinero que ayuda dentro de un recetario digital. Hablas en español de España, con tono cálido y cercano.
Reglas:
- Responde en 1 a 4 frases (máximo unas 80 palabras), sin listas largas ni formato Markdown.
- Sé honesto: si no estás seguro o depende de algo que no sabes, dilo. No inventes datos, marcas ni cantidades exactas que no conozcas.
- Para seguridad alimentaria (conservación, alergias, carnes poco hechas) sé prudente y recomienda consultar fuentes fiables si hay riesgo.
- Si se te da un DATO FIABLE, básate en él y no lo contradigas.
- Si preguntan algo que no tiene nada que ver con cocina ni con la app, dilo con amabilidad y vuelve a la cocina.
${APP_GUIDE}`;

const SCHEMA = {
  type: 'object',
  properties: { answer: { type: 'string' } },
  required: ['answer'],
};

export async function askAssistant(provider: AIProvider, body: AskRequest): Promise<{ answer: string }> {
  const question = body.question.trim().slice(0, 600);
  if (!question) throw new ProviderError('¿Qué quieres preguntarme?', 400);
  const recipe = body.recipe
    ? `\n\nReceta que está viendo ahora: «${body.recipe.title.slice(0, 120)}».\nIngredientes: ${body.recipe.ingredients.slice(0, 40).join('; ').slice(0, 1500)}\nPasos: ${body.recipe.steps.slice(0, 30).map((s, i) => `${i + 1}. ${s}`).join(' ').slice(0, 2500)}`
    : '';
  const reference = body.reference ? `\n\nDATO FIABLE: ${body.reference.slice(0, 800)}` : '';
  const result = await provider.chatJSON<{ answer?: unknown }>(SYSTEM, `${question}${reference}${recipe}`, SCHEMA);
  const answer = typeof result.answer === 'string' ? result.answer.trim() : '';
  if (!answer) throw new ProviderError('No he sabido qué contestar. ¿Me lo preguntas de otra forma?', 502);
  return { answer: answer.slice(0, 900) };
}
