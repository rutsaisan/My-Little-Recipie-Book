import { createContext, useContext } from 'react';

/** Estados visuales del asistente. */
export type AssistantMood = 'idle' | 'speaking' | 'listening' | 'thinking' | 'celebrating';

export interface KitchenTimer {
  id: string;
  label: string;
  endsAt: number;
  seconds: number;
  /** Ya sonó y está esperando a que la persona lo pare. */
  ringing: boolean;
}

export interface AssistantContextValue {
  mood: AssistantMood;
  /** Lo que dice el asistente ahora mismo (bocadillo). */
  bubble: string | null;
  /** Habla: muestra el bocadillo y, si está activado, lo lee en voz alta. */
  say: (text: string, options?: { voice?: boolean }) => void;
  setMood: (mood: AssistantMood) => void;
  celebrate: (text?: string) => void;
  hush: () => void;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  timers: KitchenTimer[];
  /** Hora actual (se actualiza cada segundo mientras hay temporizadores). */
  now: number;
  addTimer: (seconds: number, label: string) => KitchenTimer;
  removeTimer: (id: string) => void;
  /** ¿Puede responder dudas con IA (Ollama)? null mientras se comprueba. */
  ai: { available: boolean | null; message: string | null };
  /** Vuelve a mirar si la IA está disponible. */
  recheckAI: () => void;
}

export const AssistantContext = createContext<AssistantContextValue | null>(null);

export function useAssistant(): AssistantContextValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error('useAssistant debe usarse dentro de <AssistantProvider>');
  return value;
}
