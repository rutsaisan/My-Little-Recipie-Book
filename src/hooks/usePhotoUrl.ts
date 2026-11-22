import { useEffect, useState } from 'react';
import type { PhotoId } from '../domain/recipe';
import { loadPhotoUrl, peekPhotoUrl } from '../services/photoUrls';

/** URL de una foto guardada (o `null` mientras carga / si no existe). */
export function usePhotoUrl(id: PhotoId | null): string | null {
  const [state, setState] = useState<{ id: PhotoId | null; url: string | null }>(() => ({
    id,
    url: id ? (peekPhotoUrl(id) ?? null) : null,
  }));

  useEffect(() => {
    if (!id || peekPhotoUrl(id)) return;
    let alive = true;
    void loadPhotoUrl(id).then((url) => {
      if (alive) setState({ id, url });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (!id) return null;
  if (state.id === id && state.url) return state.url;
  return peekPhotoUrl(id) ?? null;
}
