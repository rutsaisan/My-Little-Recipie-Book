/**
 * Números dichos en voz alta en español: «doscientos», «treinta y cinco»,
 * «una y media», «medio», «un cuarto»… El reconocimiento de voz a veces
 * escribe cifras («200») y a veces palabras; aquí se aceptan las dos.
 */
import { normalizeText } from './search';

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23,
  veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
};

const TENS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
};

const HUNDREDS: Record<string, number> = {
  cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500, seiscientos: 600, seiscientas: 600,
  setecientos: 700, setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
};

const FRACTIONS: Record<string, number> = { medio: 0.5, media: 0.5, cuarto: 0.25, tercio: 1 / 3 };

export interface ParsedNumber {
  value: number;
  /** Cuántas palabras ocupa el número. */
  length: number;
}

function digitValue(word: string): number | null {
  if (/^\d+([.,]\d+)?$/.test(word)) return Number(word.replace(',', '.'));
  const frac = /^(\d+)\/(\d+)$/.exec(word);
  if (frac && Number(frac[2]) > 0) return Number(frac[1]) / Number(frac[2]);
  return null;
}

/** Lee un número entero dicho con palabras (hasta 9999) desde `start`. */
function readInteger(words: string[], start: number): ParsedNumber | null {
  let i = start;
  let total = 0;
  let matched = false;

  const readBelowThousand = (): number | null => {
    let value = 0;
    let any = false;
    if (words[i] in HUNDREDS) {
      value += HUNDREDS[words[i]];
      i++;
      any = true;
    }
    if (words[i] in TENS) {
      value += TENS[words[i]];
      i++;
      any = true;
      if (words[i] === 'y' && words[i + 1] in UNITS && UNITS[words[i + 1]] < 10) {
        value += UNITS[words[i + 1]];
        i += 2;
      }
    } else if (words[i] in UNITS) {
      value += UNITS[words[i]];
      i++;
      any = true;
    }
    return any ? value : null;
  };

  const first = readBelowThousand();
  if (first !== null) {
    total = first;
    matched = true;
  }
  if (words[i] === 'mil') {
    total = (matched ? total : 1) * 1000;
    i++;
    matched = true;
    const rest = readBelowThousand();
    if (rest !== null) total += rest;
  }
  return matched ? { value: total, length: i - start } : null;
}

/**
 * Lee una cantidad desde la posición `start` de una lista de palabras ya
 * normalizadas. Devuelve null si ahí no empieza ningún número.
 */
export function readQuantity(words: string[], start = 0): ParsedNumber | null {
  const word = words[start];
  if (word === undefined) return null;

  // «medio», «un cuarto», «media»
  if (word in FRACTIONS) return { value: FRACTIONS[word], length: 1 };
  if ((word === 'un' || word === 'una') && words[start + 1] in FRACTIONS && words[start + 1] !== 'media') {
    return { value: FRACTIONS[words[start + 1]], length: 2 };
  }

  const digit = digitValue(word);
  const base: ParsedNumber | null = digit !== null ? { value: digit, length: 1 } : readInteger(words, start);
  if (!base) return null;

  // «dos y medio», «1 y media», «tres cuartos»
  const next = start + base.length;
  if (words[next] === 'y' && (words[next + 1] === 'medio' || words[next + 1] === 'media')) {
    return { value: base.value + 0.5, length: base.length + 2 };
  }
  if (words[next] === 'y' && words[next + 1] === 'cuarto') {
    return { value: base.value + 0.25, length: base.length + 2 };
  }
  if (words[next] === 'cuartos' || words[next] === 'tercios') {
    return { value: base.value * (words[next] === 'cuartos' ? 0.25 : 1 / 3), length: base.length + 1 };
  }
  return base;
}

/** Separa un texto en palabras normalizadas (sin tildes ni signos). */
export function toWords(text: string): string[] {
  return normalizeText(text)
    .replace(/[¿?¡!.,;:()"«»]/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Primer número que aparece en un texto (o null). */
export function firstNumber(text: string): number | null {
  const words = toWords(text);
  for (let i = 0; i < words.length; i++) {
    const n = readQuantity(words, i);
    if (n) return n.value;
  }
  return null;
}
