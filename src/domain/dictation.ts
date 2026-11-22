/**
 * Convierte lo dictado en voz alta en un borrador de receta.
 *
 * El dictado es guiado: primero el nombre, luego los ingredientes (uno por
 * frase) y después los pasos (uno por frase). Lo que no se entiende no se
 * inventa: queda tal cual para revisarlo en el formulario antes de guardar.
 */
import { createEmptyDraft, newIngredientRow, newStepRow, type IngredientDraft, type RecipeDraft } from './draft';
import { quantityToInput } from './quantities';
import { readQuantity } from './spanishNumbers';
import { normalizeText } from './search';

const UNIT_WORDS: Record<string, string> = {
  gramo: 'g', gramos: 'g', g: 'g', gr: 'g', grs: 'g',
  kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg', kg: 'kg',
  mililitro: 'ml', mililitros: 'ml', ml: 'ml',
  centilitro: 'cl', centilitros: 'cl', cl: 'cl',
  litro: 'l', litros: 'l',
  taza: 'taza', tazas: 'taza', vaso: 'vaso', vasos: 'vaso',
  cucharada: 'cda', cucharadas: 'cda', cucharadita: 'cdta', cucharaditas: 'cdta',
  chorro: 'chorrito', chorrito: 'chorrito', chorritos: 'chorrito',
  pizca: 'pizca', pizcas: 'pizca', punado: 'punado', punados: 'punado',
  unidad: 'unidad', unidades: 'unidad', diente: 'diente', dientes: 'diente',
  rebanada: 'rebanada', rebanadas: 'rebanada', loncha: 'loncha', lonchas: 'loncha',
  hoja: 'hoja', hojas: 'hoja', ramita: 'ramita', ramitas: 'ramita',
  lata: 'lata', latas: 'lata', sobre: 'sobre', sobres: 'sobre', paquete: 'paquete', paquetes: 'paquete',
};

/** Id de unidad a partir de una palabra («gramos», «cucharadas», «tbsp»…); '' si no se reconoce. */
export function unitFromWord(word: string | null | undefined): string {
  if (!word) return '';
  const w = normalizeText(word).replace(/[.]/g, '');
  if (w in UNIT_WORDS) return UNIT_WORDS[w];
  const english: Record<string, string> = { tbsp: 'cda', tablespoon: 'cda', tablespoons: 'cda', tsp: 'cdta', teaspoon: 'cdta', teaspoons: 'cdta', cup: 'taza', cups: 'taza', pinch: 'pizca' };
  return english[w] ?? '';
}

const FILLERS = new Set(['y', 'luego', 'tambien', 'ademas', 'despues', 'pon', 'anade', 'echa']);

/** Interpreta una frase de ingrediente: «doscientos gramos de harina». */
export function parseDictatedIngredient(text: string): IngredientDraft {
  const row = newIngredientRow();
  const original = text.trim().replace(/[.;]+$/, '').split(/\s+/).filter(Boolean);
  const words = original.map((w) => normalizeText(w).replace(/[¿?¡!.,;:]/g, ''));
  let i = 0;
  while (i < words.length - 1 && FILLERS.has(words[i])) i++;

  // «… al gusto»
  let alGusto = false;
  if (words.length >= 2 && words.at(-2) === 'al' && words.at(-1) === 'gusto') {
    alGusto = true;
    original.splice(-2);
    words.splice(-2);
  }

  const quantity = readQuantity(words, i);
  if (quantity) i += quantity.length;
  const unit = UNIT_WORDS[words[i]];
  if (unit && (quantity || words[i + 1] === 'de')) i++;
  // «una cucharada y media de…»
  if (quantity && unit && words[i] === 'y' && (words[i + 1] === 'media' || words[i + 1] === 'medio')) {
    quantity.value += 0.5;
    i += 2;
  }
  if (unit && (words[i] === 'de' || words[i] === 'del')) i++;

  const name = original.slice(i).join(' ').trim();
  if (alGusto) return { ...row, unit: 'al-gusto', name: name || text.trim() };
  if (!name) return { ...row, name: text.trim() }; // no se entendió: se deja para revisar
  return {
    ...row,
    quantity: quantity ? quantityToInput(Math.round(quantity.value * 1000) / 1000) : '',
    unit: unit ?? '',
    name,
  };
}

/** Separa varios ingredientes dichos de un tirón: «2 huevos, 100 gramos de azúcar y una pizca de sal». */
export function splitIngredientUtterance(text: string): string[] {
  const parts = text.split(/[,;]|\n/).flatMap((part) => {
    // « y » solo separa si después viene una cantidad («y 100 gramos…»), no en «sal y pimienta».
    const pieces: string[] = [];
    let rest = part;
    for (;;) {
      const match = / y (?=(\d|un |una |dos |tres |cuatro |cinco |seis |siete |ocho |nueve |diez |medio |media |cien|doscient|trescient|cuatrocient|quinient))/i.exec(rest);
      if (!match) break;
      pieces.push(rest.slice(0, match.index));
      rest = rest.slice(match.index + match[0].length);
    }
    pieces.push(rest);
    return pieces;
  });
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Separa pasos dichos seguidos con «siguiente paso» o «nuevo paso». */
export function splitStepUtterance(text: string): string[] {
  return text
    .split(/\b(?:siguiente paso|nuevo paso|otro paso|punto y aparte)\b/i)
    .map((s) => s.trim().replace(/^(?:y\s+|luego\s+)/i, ''))
    .filter(Boolean)
    .map(tidySentence);
}

function tidySentence(text: string): string {
  const t = text.trim();
  const capital = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…]$/.test(capital) ? capital : `${capital}.`;
}

export interface DictatedRecipe {
  title: string;
  ingredients: string[];
  steps: string[];
}

/** Monta el borrador que se revisará en el formulario. */
export function buildDictatedDraft(dictated: DictatedRecipe, categoryId?: string): RecipeDraft {
  const draft = createEmptyDraft(categoryId);
  const title = dictated.title.trim().replace(/[.]+$/, '');
  draft.title = title ? title.charAt(0).toUpperCase() + title.slice(1) : '';
  draft.photoMode = 'final';
  draft.source = { kind: 'dictated' };
  const ingredients = dictated.ingredients.flatMap(splitIngredientUtterance).map(parseDictatedIngredient);
  const steps = dictated.steps.flatMap(splitStepUtterance).map((text) => ({ ...newStepRow(), text }));
  if (ingredients.length) draft.ingredients = ingredients;
  if (steps.length) draft.steps = steps;
  return draft;
}
