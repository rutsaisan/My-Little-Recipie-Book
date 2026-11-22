/**
 * Órdenes de voz mientras se cocina: «siguiente», «repite», «pon un
 * temporizador de diez minutos»… Se interpretan sin conexión, con reglas.
 */
import { firstNumber, readQuantity, toWords } from './spanishNumbers';

export type VoiceCommand =
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'repeat' }
  | { type: 'ingredients' }
  | { type: 'timer'; seconds: number }
  | { type: 'cancelTimer' }
  | { type: 'timeLeft' }
  | { type: 'finish' }
  | { type: 'stop' }
  | { type: 'unknown'; text: string };

const has = (words: string[], ...options: string[]) => options.some((o) => words.includes(o));

/** Duración dicha en un texto («diez minutos», «1 hora y media») en segundos. */
export function parseDuration(text: string): number | null {
  const words = toWords(text);
  // El número que va justo antes de «minutos/horas/segundos» (así «pon UN
  // temporizador de diez minutos» no se confunde con un minuto).
  const unitAt = words.findIndex((w) => /^(minutos?|horas?|segundos?|min|h|s|seg)$/.test(w));
  let n: number | null = null;
  if (unitAt > 0) {
    for (let start = Math.max(0, unitAt - 5); start < unitAt && n === null; start++) {
      const q = readQuantity(words, start);
      if (q && start + q.length === unitAt) n = q.value;
    }
  }
  if (n === null) n = firstNumber(text);
  if (n === null) {
    if (has(words, 'hora')) return has(words, 'media') ? 5400 : 3600;
    if (has(words, 'minuto')) return 60;
    return null;
  }
  let seconds: number;
  if (has(words, 'hora', 'horas', 'h')) seconds = n * 3600;
  else if (has(words, 'segundo', 'segundos', 's', 'seg')) seconds = n;
  else seconds = n * 60; // por defecto, minutos
  if (has(words, 'hora', 'horas') && has(words, 'media') && n % 1 === 0) seconds += 1800;
  return Math.round(seconds);
}

export function parseCommand(text: string): VoiceCommand {
  const words = toWords(text);
  if (!words.length) return { type: 'unknown', text };
  const sentence = words.join(' ');

  if (has(words, 'temporizador', 'alarma', 'avisame', 'cronometro') || /\bpon\b.*\bminutos?\b/.test(sentence)) {
    if (has(words, 'cancela', 'quita', 'para', 'parar', 'apaga', 'borra')) return { type: 'cancelTimer' };
    if (/cuanto (queda|falta)/.test(sentence)) return { type: 'timeLeft' };
    const seconds = parseDuration(text);
    if (seconds) return { type: 'timer', seconds };
  }
  if (/cuanto (queda|falta)/.test(sentence)) return { type: 'timeLeft' };
  if (has(words, 'ingredientes')) return { type: 'ingredients' };
  if (has(words, 'repite', 'repites', 'repetir', 'repitelo', 'otra') || sentence === 'que' || sentence === 'como') return { type: 'repeat' };
  if (has(words, 'anterior', 'atras', 'vuelve', 'volver')) return { type: 'previous' };
  if (has(words, 'termina', 'terminar', 'termine', 'terminado', 'fin', 'acabado', 'acabe') || sentence === 'ya esta')
    return { type: 'finish' };
  if (has(words, 'siguiente', 'proximo', 'adelante', 'sigue', 'seguir', 'listo', 'hecho', 'vale')) return { type: 'next' };
  if (has(words, 'callate', 'silencio', 'deja', 'escuchar')) return { type: 'stop' };
  return { type: 'unknown', text };
}

/**
 * Tiempo sugerido para un paso a partir de su texto («hornea 35-40 minutos»
 * → 35 min). Se usa el primer tiempo mencionado.
 */
export function suggestTimer(stepText: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:(?:-|a|o)\s*\d+\s*)?(minutos?|min\b|horas?|h\b|segundos?)/i.exec(stepText);
  if (match) {
    const n = Number(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    if (unit.startsWith('h')) return Math.round(n * 3600);
    if (unit.startsWith('s')) return Math.round(n);
    return Math.round(n * 60);
  }
  const words = toWords(stepText);
  const at = words.findIndex((w) => w === 'minutos' || w === 'minuto' || w === 'horas' || w === 'hora');
  if (at > 0) {
    const seconds = parseDuration(words.slice(Math.max(0, at - 4), at + 1).join(' '));
    return seconds && seconds >= 30 ? seconds : null;
  }
  return null;
}

/** 95 → «1 min 35 s»; 3600 → «1 h». */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  if (m) return sec ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
}

/** Cuenta atrás tipo reloj: 95 → «1:35», 3725 → «1:02:05». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
