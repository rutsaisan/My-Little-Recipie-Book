import { useCallback, useEffect, useState } from 'react';
import { dataSource, type Settings } from '../data';

/**
 * Lee y guarda una preferencia persistente.
 * Devuelve `[valor, guardar, cargado]`.
 */
export function useSetting<K extends keyof Settings>(
  key: K,
): [Settings[K] | undefined, (value: Settings[K]) => void, boolean] {
  const [state, setState] = useState<{ loaded: boolean; value: Settings[K] | undefined }>({
    loaded: false,
    value: undefined,
  });

  useEffect(() => {
    let alive = true;
    dataSource.settings
      .get(key)
      .then((value) => alive && setState({ loaded: true, value }))
      .catch(() => alive && setState({ loaded: true, value: undefined }));
    return () => {
      alive = false;
    };
  }, [key]);

  const save = useCallback(
    (value: Settings[K]) => {
      setState({ loaded: true, value });
      void dataSource.settings.set(key, value).catch((error: unknown) => {
        console.error(`[ajustes] No se pudo guardar «${key}»`, error);
      });
    },
    [key],
  );

  return [state.value, save, state.loaded];
}
