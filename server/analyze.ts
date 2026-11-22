/**
 * Análisis de un vídeo de receta:
 *   1. el modelo de visión describe cada fotograma (ingredientes, acciones
 *      y texto en pantalla);
 *   2. el modelo de texto ordena transcripción + descripción + fotogramas
 *      en el formato de la app, con reglas estrictas para no inventar;
 *   3. una comprobación final rebaja a «pendiente» lo que no aparece en
 *      ninguna fuente.
 */
import type { AnalyzeRequest, AnalyzeResult, ImportedRecipe } from '../src/domain/importTypes.ts';
import { ProviderError, type AIProvider } from './providers/types.ts';
import { verifyAgainstSources } from './verify.ts';

const MAX_FRAMES = 8;
const MAX_TEXT = 12_000;

const FRAME_PROMPT = `Eres un asistente que mira un fotograma de un vídeo de cocina.
Describe en español, en 2-4 frases cortas y solo lo que se ve con claridad:
- ingredientes o alimentos reconocibles (sin inventar cantidades);
- la acción que se está haciendo (cortar, batir, hornear…) y los utensilios;
- cualquier texto escrito en pantalla, copiado literalmente entre comillas.
Si algo no se distingue bien, di «no se distingue». No supongas nada que no se vea.`;

const SYSTEM_PROMPT = `Conviertes vídeos de recetas en recetas escritas, en español de España.
Recibes la transcripción del audio, el texto de la publicación y descripciones de fotogramas.

REGLAS (obligatorias):
1. NO INVENTES. Usa solo información que aparezca en las fuentes.
2. Cantidades: escribe "quantity" solo si un número se dice o se lee explícitamente para ese ingrediente. Si no, quantity = null. Nunca estimes.
3. "unit" es la palabra de unidad tal como aparece (gramos, ml, cucharadas, tazas, dientes…), o null. "al gusto" si se dice así.
4. "certain" = true solo si el ingrediente se nombra en el audio o en el texto. Si solo se ve en la imagen, certain = false y source = "imagen".
5. Pasos: en orden, en imperativo y frases claras ("Bate los huevos con el azúcar."). certain = false si el paso se deduce solo de las imágenes.
6. "frame": índice del fotograma que mejor ilustra ese paso, o null. "coverFrame": el fotograma que mejor muestra el plato terminado, o null.
7. title, servings, prepMinutes, cookMinutes: null si no se dicen. No calcules tiempos que no se digan.
8. En "warnings" explica brevemente qué no has podido determinar (por ejemplo "No se dice cuánta leche lleva").
9. Traduce al español si las fuentes están en otro idioma, sin cambiar cantidades.
10. Si las fuentes no contienen una receta, devuelve listas vacías y explícalo en warnings.
11. Los comentarios que no son acciones ("salen unas ocho", "queda buenísimo") no son pasos: van a servings (si dice cuántas raciones salen) o a notes.

EJEMPLO
Audio: "Echa dos huevos y un vaso de leche, bate y añade harina hasta que espese. Una pizca de sal. Al horno veinte minutos."
Resultado (resumido):
ingredients: [{"name":"huevos","quantity":"2","unit":null,"certain":true,"source":"audio"},
 {"name":"leche","quantity":"1","unit":"vaso","certain":true,"source":"audio"},
 {"name":"harina","quantity":null,"unit":null,"certain":true,"source":"audio"},
 {"name":"sal","quantity":"1","unit":"pizca","certain":true,"source":"audio"}]
steps: [{"text":"Bate los huevos con la leche.","certain":true,"frame":null},
 {"text":"Añade harina poco a poco hasta que espese y una pizca de sal.","certain":true,"frame":null},
 {"text":"Hornea durante 20 minutos.","certain":true,"frame":null}]
warnings: ["No se dice cuánta harina lleva."]`;

const STRING_OR_NULL = { type: ['string', 'null'] };
const NUMBER_OR_NULL = { type: ['number', 'null'] };
const INT_OR_NULL = { type: ['integer', 'null'] };

export const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title: STRING_OR_NULL,
    servings: NUMBER_OR_NULL,
    prepMinutes: NUMBER_OR_NULL,
    cookMinutes: NUMBER_OR_NULL,
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: STRING_OR_NULL,
          unit: STRING_OR_NULL,
          certain: { type: 'boolean' },
          source: { type: 'string', enum: ['audio', 'texto', 'descripcion', 'imagen'] },
        },
        required: ['name', 'quantity', 'unit', 'certain', 'source'],
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, certain: { type: 'boolean' }, frame: INT_OR_NULL },
        required: ['text', 'certain', 'frame'],
      },
    },
    notes: STRING_OR_NULL,
    coverFrame: INT_OR_NULL,
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'servings', 'prepMinutes', 'cookMinutes', 'ingredients', 'steps', 'notes', 'coverFrame', 'warnings'],
};

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
}

function asFrame(v: unknown, frames: number): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < frames ? v : null;
}

/** Limpia la respuesta del modelo: tipos correctos y nada fuera de rango. */
export function sanitizeRecipe(raw: unknown, frames: number): ImportedRecipe {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'object' && x !== null) : []) as Record<string, unknown>[];
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const sources = ['audio', 'texto', 'descripcion', 'imagen'] as const;

  return {
    title: text(r.title),
    servings: asNumber(r.servings),
    prepMinutes: asNumber(r.prepMinutes),
    cookMinutes: asNumber(r.cookMinutes),
    ingredients: list(r.ingredients)
      .filter((i) => text(i.name))
      .map((i) => {
        const source = sources.find((s) => s === i.source) ?? 'audio';
        const quantity = typeof i.quantity === 'number' ? String(i.quantity) : text(i.quantity);
        return {
          name: text(i.name) as string,
          quantity,
          unit: text(i.unit),
          certain: i.certain === true && source !== 'imagen',
          source,
        };
      }),
    steps: list(r.steps)
      .filter((s) => text(s.text))
      .map((s) => ({ text: text(s.text) as string, certain: s.certain === true, frame: asFrame(s.frame, frames) })),
    notes: text(r.notes),
    coverFrame: asFrame(r.coverFrame, frames),
    warnings: Array.isArray(r.warnings) ? r.warnings.filter((w): w is string => typeof w === 'string' && w.trim() !== '') : [],
  };
}

export async function analyzeVideo(provider: AIProvider, request: AnalyzeRequest, vision: boolean): Promise<AnalyzeResult> {
  const transcript = clip(request.transcript.trim(), MAX_TEXT);
  const description = clip(request.description.trim(), 4000);
  const frames = request.frames.slice(0, MAX_FRAMES);

  const frameNotes: string[] = [];
  if (vision) {
    for (const frame of frames) {
      try {
        frameNotes.push(await provider.describeImage(FRAME_PROMPT, frame));
      } catch (error) {
        if (error instanceof ProviderError && error.status === 503) throw error;
        frameNotes.push('');
      }
    }
  }

  if (!transcript && !description && !frameNotes.some(Boolean)) {
    throw new ProviderError('No hay nada que analizar: el vídeo no tiene voz ni texto, y no se han podido mirar las imágenes.', 422);
  }

  const frameBlock = frameNotes
    .map((note, i) => (note ? `Fotograma ${i} (segundo ${Math.round(request.frameTimes[i] ?? 0)}): ${note}` : ''))
    .filter(Boolean)
    .join('\n');

  const user = [
    `TRANSCRIPCIÓN DEL AUDIO:\n${transcript || '(sin voz o no se ha podido transcribir)'}`,
    `TEXTO DE LA PUBLICACIÓN:\n${description || '(no hay)'}`,
    `FOTOGRAMAS:\n${frameBlock || '(no se han analizado imágenes)'}`,
    'Devuelve la receta en JSON siguiendo las reglas.',
  ].join('\n\n');

  const raw = await provider.chatJSON<unknown>(SYSTEM_PROMPT, user, RECIPE_SCHEMA);
  const recipe = verifyAgainstSources(sanitizeRecipe(raw, frameNotes.length), {
    spoken: `${transcript}\n${description}`,
    seen: frameNotes.join('\n'),
  });
  return { recipe, frameNotes };
}
