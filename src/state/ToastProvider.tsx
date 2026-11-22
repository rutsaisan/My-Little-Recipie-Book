import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toasts, type ToastItem } from '../components/ui/Toasts';
import { ToastContext, type ToastOptions } from './toastContext';

let counter = 0;

/** Avisos breves («Receta guardada…») en forma de notita de papel. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = ++counter;
      const tone = options.tone ?? 'info';
      setItems((list) => [...list.slice(-2), { id, message, tone, character: options.character, action: options.action }]);
      const duration = options.duration ?? (tone === 'error' ? 7000 : 4500);
      timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toasts items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
