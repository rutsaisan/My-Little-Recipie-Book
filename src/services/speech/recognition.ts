/**
 * Reconocimiento de voz (Web Speech API) en español.
 *
 * Funciona en Chrome, Edge y Safari. Ojo: esos navegadores envían el audio a
 * su servicio de reconocimiento (Google, Microsoft o Apple) para pasarlo a
 * texto; la app no guarda ninguna grabación.
 */

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function speechRecognitionSupported(): boolean {
  return typeof window !== 'undefined' && getCtor() !== null;
}

export interface ListenOptions {
  /** Seguir escuchando entre frases (modo cocina). */
  continuous?: boolean;
  onInterim?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
}

export interface Listening {
  stop: () => void;
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'No tengo permiso para usar el micrófono. Puedes darlo en el candado de la barra de direcciones.',
  'service-not-allowed': 'El navegador no permite el reconocimiento de voz en esta página.',
  'audio-capture': 'No encuentro ningún micrófono.',
  network: 'El reconocimiento de voz necesita conexión a internet.',
};

/** Empieza a escuchar. Devuelve null si el navegador no sabe reconocer voz. */
export function listen(options: ListenOptions): Listening | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  let active = true;
  let recognition: Recognition;

  const begin = () => {
    recognition = new Ctor();
    recognition.lang = 'es-ES';
    recognition.continuous = Boolean(options.continuous);
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (result.isFinal) {
          if (text) options.onFinal(text);
        } else interim += `${text} `;
      }
      options.onInterim?.(interim.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      active = false;
      options.onError?.(ERRORS[event.error] ?? 'No he podido escucharte bien. Inténtalo otra vez.');
    };
    recognition.onend = () => {
      // En modo continuo el navegador corta tras un silencio: se vuelve a empezar.
      if (active && options.continuous) {
        try {
          begin();
          return;
        } catch {
          active = false;
        }
      }
      active = false;
      options.onEnd?.();
    };
    recognition.start();
  };

  try {
    begin();
  } catch {
    return null;
  }
  return {
    stop: () => {
      active = false;
      try {
        recognition.stop();
      } catch {
        /* ya estaba parado */
      }
    },
  };
}
