/**
 * Punto único de acceso a los datos de la aplicación.
 *
 * Se elige la implementación según `VITE_DATA_SOURCE` (ver `.env.example`).
 * Hoy solo existe «local» (IndexedDB). Para añadir un backend: crea
 * `data/api/repositories.ts` con un `DataSource` que hable con el servidor y
 * regístralo en `SOURCES`. El resto de la app no necesita cambiar.
 */
import { indexedDbDataSource } from './indexeddb/repositories';
import type { DataSource } from './types';

const SOURCES: Record<string, DataSource> = {
  local: indexedDbDataSource,
};

function pickSource(): DataSource {
  const wanted = (import.meta.env.VITE_DATA_SOURCE as string | undefined) ?? 'local';
  const source = SOURCES[wanted];
  if (!source) {
    console.warn(`[datos] Fuente «${wanted}» no disponible todavía; se usa «local».`);
    return SOURCES.local;
  }
  return source;
}

export const dataSource: DataSource = pickSource();

export type { DataSource, PhotoChanges, PhotoInput, Settings, StoredPhoto } from './types';
