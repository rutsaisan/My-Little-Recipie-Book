/**
 * Lectura y escritura de cantidades en español: «200», «1,5», «1/2», «1 ½».
 */

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 1 / 8,
};

/** Fracciones que se escriben con su glifo al mostrar cantidades. */
const DISPLAY_FRACTIONS: [number, string][] = [
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
];

export const MAX_QUANTITY = 100_000;

export type ParsedQuantity = { ok: true; value: number | null } | { ok: false };

/**
 * Convierte lo que escribe la persona en un número.
 * Vacío → `null` (sin cantidad). Texto no reconocible → `{ ok: false }`.
 */
export function parseQuantity(input: string): ParsedQuantity {
  let text = input.trim();
  if (text === '') return { ok: true, value: null };

  // «1½» → «1 ½» para tratar el glifo como una parte más.
  text = text.replace(/(\d)([¼½¾⅓⅔⅛])/g, '$1 $2');
  const parts = text.split(/\s+/);
  if (parts.length > 2) return { ok: false };

  let total = 0;
  for (const part of parts) {
    const value = parsePart(part);
    if (value === null) return { ok: false };
    total += value;
  }
  // «1 2» no es una cantidad válida: la segunda parte debe ser una fracción.
  if (parts.length === 2 && !(parsePart(parts[1])! < 1)) return { ok: false };
  if (!(total > 0) || total > MAX_QUANTITY) return { ok: false };
  return { ok: true, value: roundTo(total, 4) };
}

function parsePart(part: string): number | null {
  if (part in UNICODE_FRACTIONS) return UNICODE_FRACTIONS[part];
  const fraction = /^(\d+)\/(\d+)$/.exec(part);
  if (fraction) {
    const den = Number(fraction[2]);
    return den === 0 ? null : Number(fraction[1]) / den;
  }
  if (/^\d+(?:[.,]\d+)?$/.test(part)) return Number(part.replace(',', '.'));
  return null;
}

export function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

const decimalFormatters = new Map<number, Intl.NumberFormat>();

/** 1.5 → «1,5»; 2 → «2». */
export function formatDecimal(value: number, maxDecimals = 2): string {
  let formatter = decimalFormatters.get(maxDecimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-ES', { maximumFractionDigits: maxDecimals });
    decimalFormatters.set(maxDecimals, formatter);
  }
  return formatter.format(value);
}

/** 1.5 → «1½», 0.25 → «¼»; si no se parece a una fracción común, decimal. */
export function formatFraction(value: number): string {
  const whole = Math.floor(value + 1e-9);
  const rest = value - whole;
  if (rest < 0.04) return whole > 0 ? String(whole) : formatDecimal(value);
  if (rest > 0.96) return String(whole + 1);
  for (const [fraction, glyph] of DISPLAY_FRACTIONS) {
    if (Math.abs(rest - fraction) <= 0.04) return `${whole > 0 ? whole : ''}${glyph}`;
  }
  return formatDecimal(value, value < 10 ? 2 : 1);
}

/** Texto editable a partir de un número guardado (para el formulario). */
export function quantityToInput(value: number | null): string {
  if (value === null) return '';
  return formatDecimal(value, 4);
}

/** Redondeo «de cocina» para gramos y mililitros recalculados. */
export function roundKitchen(value: number): number {
  if (value >= 100) return Math.round(value / 5) * 5;
  if (value >= 10) return Math.round(value);
  return roundTo(value, 1);
}
