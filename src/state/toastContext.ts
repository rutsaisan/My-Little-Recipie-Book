import { createContext, useContext } from 'react';
import type { CharacterId } from '../assets/characters';

export interface ToastOptions {
  tone?: 'info' | 'success' | 'error';
  character?: CharacterId;
  /** Milisegundos visibles (por defecto 4,5 s; los errores, 7 s). */
  duration?: number;
  /** Botón opcional, p. ej. «Deshacer». */
  action?: { label: string; onClick: () => void };
}

export interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return value;
}
