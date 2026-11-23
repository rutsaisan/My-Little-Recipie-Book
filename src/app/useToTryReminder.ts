/**
 * Recordatorio de recetas «Por probar»: como mucho una vez cada tres días, al
 * abrir la app, Tom propone una de las recetas pendientes (y, si están
 * activados los avisos, también con una notificación).
 */
import { useEffect, useRef } from 'react';
import { notify } from '../services/notifications';
import { useAssistant } from '../state/assistantContext';
import { usePreferences } from '../state/preferencesContext';
import { useRecipes } from '../state/recipesContext';

const EVERY_MS = 3 * 24 * 60 * 60 * 1000;

export function useToTryReminder(): void {
  const { prefs, loaded, setPref } = usePreferences();
  const { recipes, status } = useRecipes();
  const { say } = useAssistant();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || !loaded || status !== 'ready' || !prefs.notifications.toTry) return;
    done.current = true;
    if (Date.now() - prefs.lastToTryReminder < EVERY_MS) return;
    const pending = recipes.filter((r) => r.toTry);
    if (!pending.length) return;
    const pick = pending[Math.floor(Math.random() * pending.length)];
    setPref('lastToTryReminder', Date.now());
    const text = `¿Y si hoy pruebas «${pick.title}»? La tienes apuntada como «Por probar».`;
    // Sin limpieza a propósito: al guardar la fecha el efecto vuelve a pasar y no debe cancelarlo.
    window.setTimeout(() => {
      say(text, { voice: false });
      void notify('Una receta por probar', { body: text, tag: 'to-try' });
    }, 2500);
  }, [loaded, status, prefs.notifications.toTry, prefs.lastToTryReminder, recipes, say, setPref]);
}
