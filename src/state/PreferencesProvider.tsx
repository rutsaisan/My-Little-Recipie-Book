import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dataSource, type Settings } from '../data';
import {
  DEFAULT_PREFERENCES,
  PreferencesContext,
  readPreferences,
  type Preferences,
  type PreferencesContextValue,
} from './preferencesContext';

/** Carga las preferencias guardadas una vez y las mantiene sincronizadas. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ loaded: boolean; prefs: Preferences }>({
    loaded: false,
    prefs: DEFAULT_PREFERENCES,
  });

  useEffect(() => {
    let alive = true;
    dataSource.settings
      .getAll()
      .then((raw) => {
        if (!alive) return;
        const prefs = readPreferences(raw);
        // Primera vez que se abre la app: se apunta la fecha para la portadilla.
        if (prefs.bookStartedAt === null) {
          prefs.bookStartedAt = Date.now();
          void dataSource.settings.set('bookStartedAt', prefs.bookStartedAt);
        }
        setState({ loaded: true, prefs });
      })
      .catch((error: unknown) => {
        console.error('[ajustes] No se pudieron leer', error);
        if (alive) setState((s) => ({ ...s, loaded: true }));
      });
    return () => {
      alive = false;
    };
  }, []);

  const setPref = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setState((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));
    void dataSource.settings.set(key as keyof Settings, value as Settings[keyof Settings]).catch((error: unknown) => {
      console.error(`[ajustes] No se pudo guardar «${String(key)}»`, error);
    });
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ prefs: state.prefs, loaded: state.loaded, setPref }),
    [state.prefs, state.loaded, setPref],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
