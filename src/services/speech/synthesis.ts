/**
 * Lectura en voz alta (speechSynthesis) con una voz en español, femenina si
 * el sistema tiene alguna.
 */

export function speechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

const PREFERRED = ['helena', 'laura', 'elvira', 'monica', 'mónica', 'paulina', 'lucia', 'lucía', 'sabina', 'google español'];

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (!voices.length) return null;
  for (const name of PREFERRED) {
    const v = voices.find((voice) => voice.name.toLowerCase().includes(name));
    if (v) return v;
  }
  return voices.find((v) => v.lang.toLowerCase() === 'es-es') ?? voices[0];
}

// Algunos navegadores cargan las voces más tarde.
if (speechSynthesisSupported()) window.speechSynthesis.onvoiceschanged = () => pickVoice();

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
}

/** Lee un texto (cortando lo que se estuviera leyendo). */
export function speak(text: string, options: SpeakOptions = {}): void {
  if (!speechSynthesisSupported() || !text.trim()) {
    options.onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  utterance.rate = 0.97;
  utterance.pitch = 1.05;
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onEnd?.();
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}
