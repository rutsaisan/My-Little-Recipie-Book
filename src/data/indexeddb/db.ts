/**
 * Esquema de la base de datos local (IndexedDB) y sus migraciones.
 *
 * Para cambiar el esquema: sube `DB_VERSION` y añade un bloque
 * `if (oldVersion < N) { … }` en `upgrade`. Nunca borres bloques antiguos:
 * así cualquier navegador se actualiza paso a paso sin perder recetas.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { UnlockedAchievement } from '../../domain/achievements';
import type { CustomCategory } from '../../domain/categories';
import type { CookEntry, Recipe } from '../../domain/recipe';
import type { StoredPhoto } from '../types';

export const DB_NAME = 'my-little-recipe-book';
export const DB_VERSION = 2;

export interface CookbookDB extends DBSchema {
  recipes: {
    key: string;
    value: Recipe;
    indexes: { 'by-category': string; 'by-updated': number };
  };
  photos: {
    key: string;
    value: StoredPhoto;
  };
  settings: {
    key: string;
    value: unknown;
  };
  // ── Versión 2 (fase 2) ──
  categories: {
    key: string;
    value: CustomCategory;
  };
  cooks: {
    key: string;
    value: CookEntry;
    indexes: { 'by-recipe': string };
  };
  achievements: {
    key: string;
    value: UnlockedAchievement;
  };
}

let dbPromise: Promise<IDBPDatabase<CookbookDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<CookbookDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CookbookDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const recipes = db.createObjectStore('recipes', { keyPath: 'id' });
          recipes.createIndex('by-category', 'categoryId');
          recipes.createIndex('by-updated', 'updatedAt');
          db.createObjectStore('photos', { keyPath: 'id' });
          db.createObjectStore('settings');
        }
        if (oldVersion < 2) {
          // Secciones propias, historial de recetas cocinadas e insignias.
          // Las recetas antiguas no cambian: los campos nuevos se rellenan al leer.
          db.createObjectStore('categories', { keyPath: 'id' });
          const cooks = db.createObjectStore('cooks', { keyPath: 'id' });
          cooks.createIndex('by-recipe', 'recipeId');
          db.createObjectStore('achievements', { keyPath: 'id' });
        }
      },
      blocking() {
        // Otra pestaña necesita una versión nueva: cerramos para no bloquearla.
        void dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
      terminated() {
        dbPromise = null;
      },
    }).catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

/** Solo para pruebas: cierra y olvida la conexión abierta. */
export async function resetDbConnection(): Promise<void> {
  const pending = dbPromise;
  dbPromise = null;
  if (pending) (await pending.catch(() => null))?.close();
}
