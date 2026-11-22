import { useCallback, useEffect } from 'react';
import { ambientMusic } from '../../services/music/ambientMusic';
import { usePreferences } from '../../state/preferencesContext';

/**
 * Conecta la música con las preferencias guardadas (usar una sola vez, en la
 * raíz de la app). Si la última vez estaba activada, empieza al primer toque
 * o tecla: los navegadores no dejan que suene sola al abrir la página.
 */
export function useMusicAutostart(): void {
  const { prefs, loaded } = usePreferences();
  const { enabled, volume } = prefs.music;

  useEffect(() => {
    if (!loaded || !enabled || ambientMusic.isPlaying) return;
    const events = ['pointerdown', 'keydown'] as const;
    const start = () => {
      cleanup();
      void ambientMusic.start(volume);
    };
    const cleanup = () => events.forEach((e) => window.removeEventListener(e, start, true));
    events.forEach((e) => window.addEventListener(e, start, true));
    return cleanup;
    // El volumen se aplica aparte; no hace falta volver a esperar un gesto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, enabled]);

  useEffect(() => {
    ambientMusic.setVolume(volume);
  }, [volume]);
}

/** Controles de la música (botón, volumen). */
export function useAmbientMusic() {
  const { prefs, setPref } = usePreferences();
  const { enabled, volume } = prefs.music;

  const toggle = useCallback(() => {
    if (enabled) {
      setPref('music', { enabled: false, volume });
      ambientMusic.stop();
    } else {
      setPref('music', { enabled: true, volume });
      void ambientMusic.start(volume);
    }
  }, [enabled, volume, setPref]);

  const setVolume = useCallback((value: number) => setPref('music', { enabled, volume: value }), [enabled, setPref]);

  return { enabled, volume, toggle, setVolume };
}
