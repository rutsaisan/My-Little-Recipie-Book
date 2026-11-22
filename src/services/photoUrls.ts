/**
 * Direcciones (object URL) de las fotos guardadas.
 *
 * Las fotos viven como Blob en la base de datos. Para pintarlas hace falta una
 * URL temporal; se crea una vez por foto y se reutiliza mientras la app está
 * abierta, así al pasar página no parpadean ni se vuelven a leer.
 */
import { dataSource } from '../data';
import type { PhotoId } from '../domain/recipe';

const pending = new Map<PhotoId, Promise<string | null>>();
const resolved = new Map<PhotoId, string>();

/** URL ya disponible (sin esperar), o `undefined`. */
export function peekPhotoUrl(id: PhotoId): string | undefined {
  return resolved.get(id);
}

export function loadPhotoUrl(id: PhotoId): Promise<string | null> {
  let promise = pending.get(id);
  if (!promise) {
    promise = dataSource.photos
      .get(id)
      .then((photo) => {
        if (!photo) return null;
        const url = URL.createObjectURL(photo.blob);
        resolved.set(id, url);
        return url;
      })
      .catch(() => {
        pending.delete(id);
        return null;
      });
    pending.set(id, promise);
  }
  return promise;
}

/** Libera las URL de fotos borradas o sustituidas. */
export function forgetPhotos(ids: Iterable<PhotoId>): void {
  for (const id of ids) {
    const url = resolved.get(id);
    if (url) URL.revokeObjectURL(url);
    resolved.delete(id);
    pending.delete(id);
  }
}
