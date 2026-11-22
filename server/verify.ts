/**
 * Comprobaciones contra la invención: lo que la IA dice haber oído o leído
 * tiene que aparecer de verdad en el audio, en el texto o en lo que se vio
 * en los fotogramas. Si no aparece, se rebaja a «pendiente de confirmar».
 */
import type { ImportedRecipe } from '../src/domain/importTypes.ts';

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ½¼¾/.,\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const WORD_NUMBERS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, veinte: 20, veinticinco: 25, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100,
  doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300, cuatrocientos: 400, cuatrocientas: 400,
  quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900, mil: 1000, medio: 0.5, media: 0.5,
  cuarto: 0.25, docena: 12, one: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5,
};

function toNumber(token: string): number | null {
  const t = token.replace(',', '.');
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const frac = /^(\d+)\/(\d+)$/.exec(t);
  if (frac && Number(frac[2]) > 0) return Number(frac[1]) / Number(frac[2]);
  const glyphs: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75 };
  if (t in glyphs) return glyphs[t];
  return token in WORD_NUMBERS ? WORD_NUMBERS[token] : null;
}

/** Todos los números que aparecen en un texto (en cifra o con palabras sueltas). */
export function numbersIn(text: string): Set<number> {
  const found = new Set<number>();
  const tokens = normalize(text).replace(/(\d)([½¼¾])/g, '$1 $2').split(/[\s]+/);
  let previous: number | null = null;
  for (const raw of tokens) {
    const token = raw.replace(/[.,]$/, '');
    const n = toNumber(token);
    if (n !== null) {
      found.add(n);
      // «doscientos cincuenta», «dos y medio», «1 ½»
      if (previous !== null) {
        found.add(previous + n);
        found.add(previous * n);
      }
      previous = n;
    } else if (token !== 'y') {
      previous = null;
    }
  }
  return found;
}

/** ¿Aparece este nombre (o su raíz) en el texto? «tomates» casa con «tomate». */
export function nameAppears(name: string, haystack: string): boolean {
  const words = normalize(name)
    .split(' ')
    .filter((w) => w.length >= 4 && !['para', 'con', 'sin', 'unos', 'unas', 'trozo', 'trozos'].includes(w));
  if (!words.length) return haystack.includes(normalize(name));
  return words.some((w) => haystack.includes(w.slice(0, Math.max(4, w.length - 2))));
}

const UNIT_WORDS = new Set([
  'g', 'gr', 'gramo', 'gramos', 'kg', 'kilo', 'kilos', 'ml', 'mililitro', 'mililitros', 'cl', 'litro', 'litros',
  'taza', 'tazas', 'vaso', 'vasos', 'cucharada', 'cucharadas', 'cucharadita', 'cucharaditas', 'pizca', 'pizcas',
  'chorrito', 'chorro', 'punado', 'punados', 'diente', 'dientes', 'lata', 'latas', 'sobre', 'sobres', 'rebanada',
  'rebanadas', 'loncha', 'lonchas', 'hoja', 'hojas', 'ramita', 'ramitas', 'paquete', 'paquetes', 'unidad', 'unidades',
]);

/**
 * Busca en el texto una cantidad dicha justo antes del ingrediente:
 * «dos huevos», «una pizca de sal», «150 g de harina». Solo devuelve lo
 * que está escrito literalmente; si no lo encuentra, null.
 */
export function quantityFromText(name: string, text: string): { quantity: string; unit: string | null } | null {
  const tokens = normalize(text).replace(/[.,;:](\s|$)/g, ' ').split(' ').filter(Boolean);
  const key = normalize(name).split(' ').find((w) => w.length >= 3);
  if (!key) return null;
  const stem = key.slice(0, Math.max(3, key.length - 2));
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].startsWith(stem)) continue;
    let j = i - 1;
    if (tokens[j] === 'de' || tokens[j] === 'del') j--;
    let unit: string | null = null;
    if (j >= 0 && UNIT_WORDS.has(tokens[j])) {
      unit = tokens[j];
      j--;
    }
    // Lee hacia atrás el número completo («ciento cincuenta», «dos y medio»).
    const numberTokens: string[] = [];
    while (j >= 0 && (toNumber(tokens[j]) !== null || (tokens[j] === 'y' && numberTokens.length))) {
      numberTokens.unshift(tokens[j]);
      j--;
    }
    if (numberTokens[0] === 'y') numberTokens.shift();
    if (!numberTokens.length) continue;
    const values = numberTokens.filter((t) => t !== 'y').map((t) => toNumber(t) as number);
    let total = 0;
    for (const v of values) total = v === 1000 ? (total || 1) * 1000 : total + v;
    if (total > 0) return { quantity: String(Math.round(total * 100) / 100), unit };
  }
  return null;
}

export function verifyAgainstSources(recipe: ImportedRecipe, sources: { spoken: string; seen: string }): ImportedRecipe {
  const spoken = normalize(sources.spoken);
  const all = normalize(`${sources.spoken} ${sources.seen}`);
  const numbers = numbersIn(`${sources.spoken} ${sources.seen}`);
  const warnings = [...recipe.warnings];

  const ingredients = recipe.ingredients.map((item) => {
    const next = { ...item };
    if (!nameAppears(item.name, all)) {
      next.certain = false;
      warnings.push(`«${item.name}» no aparece ni en el audio ni en el texto: comprueba que esté en la receta.`);
    } else if (next.certain && !nameAppears(item.name, spoken)) {
      // Solo visto en imagen: nunca se da por seguro.
      next.certain = false;
      next.source = 'imagen';
    }
    if (item.quantity === null) {
      // La IA a veces se salta una cantidad que sí se dice: se busca literal.
      const found = quantityFromText(item.name, sources.spoken);
      if (found && !(item.unit && /gusto/.test(normalize(item.unit)))) {
        next.quantity = found.quantity;
        next.unit = found.unit ?? item.unit;
      }
    } else {
      const value = toNumber(normalize(item.quantity).split(' ')[0] ?? '') ?? Number.NaN;
      const total = normalize(item.quantity)
        .split(' ')
        .map(toNumber)
        .reduce<number>((sum, n) => sum + (n ?? 0), 0);
      if (!numbers.has(value) && !numbers.has(total)) {
        // La cantidad no se dice en ningún sitio: no se acepta.
        warnings.push(`La cantidad de «${item.name}» (${item.quantity}) no se dice en el vídeo; se ha dejado en blanco.`);
        next.quantity = null;
        next.certain = false;
      }
    }
    return next;
  });

  return { ...recipe, ingredients, warnings };
}
