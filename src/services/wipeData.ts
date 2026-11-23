/**
 * Borra todo lo que la app guarda en este navegador: recetas, fotos, ajustes
 * (IndexedDB) y la copia de la app para usarla sin conexión. No se puede
 * deshacer; la interfaz lo pregunta antes.
 */
import { DB_NAME, resetDbConnection } from '../data/indexeddb/db';

export async function wipeAllData(): Promise<void> {
  await resetDbConnection();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
  if ('caches' in window) {
    for (const key of await caches.keys()) await caches.delete(key);
  }
  if ('serviceWorker' in navigator) {
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
  }
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // modo privado: no hay nada que borrar
  }
}
