/**
 * Implementación de los repositorios sobre IndexedDB.
 */
import { normalizeCustomCategory, type CustomCategory } from '../../domain/categories';
import { normalizeCookEntry, normalizeRecipe, recipePhotoIds, type CookEntry, type Recipe } from '../../domain/recipe';
import type {
  AchievementRepository,
  CategoryRepository,
  DataSource,
  PhotoChanges,
  PhotoRepository,
  RecipeRepository,
  Settings,
  SettingsRepository,
} from '../types';
import { getDb } from './db';

const recipes: RecipeRepository = {
  async list() {
    const db = await getDb();
    const raw = await db.getAll('recipes');
    return raw.map(normalizeRecipe).filter((r): r is Recipe => r !== null);
  },

  async get(id) {
    const db = await getDb();
    return normalizeRecipe(await db.get('recipes', id)) ?? undefined;
  },

  async save(recipe: Recipe, photos: PhotoChanges) {
    const db = await getDb();
    // Una sola transacción: o se guarda todo (receta + fotos) o nada.
    const tx = db.transaction(['recipes', 'photos'], 'readwrite');
    const now = Date.now();
    const writes: Promise<unknown>[] = [];
    for (const photo of photos.add) {
      writes.push(tx.objectStore('photos').put({ ...photo, createdAt: now }));
    }
    for (const id of photos.remove) {
      writes.push(tx.objectStore('photos').delete(id));
    }
    writes.push(tx.objectStore('recipes').put(recipe));
    await Promise.all([...writes, tx.done]);
  },

  async update(recipe) {
    const db = await getDb();
    await db.put('recipes', recipe);
  },

  async remove(id) {
    const db = await getDb();
    const tx = db.transaction(['recipes', 'photos'], 'readwrite');
    const stored = normalizeRecipe(await tx.objectStore('recipes').get(id));
    const writes: Promise<unknown>[] = [tx.objectStore('recipes').delete(id)];
    if (stored) {
      for (const photoId of recipePhotoIds(stored)) writes.push(tx.objectStore('photos').delete(photoId));
    }
    // El historial de recetas cocinadas se conserva: cuenta para las insignias.
    await Promise.all([...writes, tx.done]);
  },

  async listCooks() {
    const db = await getDb();
    const raw = await db.getAll('cooks');
    return raw.map(normalizeCookEntry).filter((c): c is CookEntry => c !== null);
  },

  async recordCook(recipe, entry) {
    const db = await getDb();
    const tx = db.transaction(['recipes', 'cooks'], 'readwrite');
    await Promise.all([tx.objectStore('recipes').put(recipe), tx.objectStore('cooks').put(entry), tx.done]);
  },

  async undoCook(recipe, entryId) {
    const db = await getDb();
    const tx = db.transaction(['recipes', 'cooks'], 'readwrite');
    await Promise.all([tx.objectStore('recipes').put(recipe), tx.objectStore('cooks').delete(entryId), tx.done]);
  },
};

const photos: PhotoRepository = {
  async get(id) {
    const db = await getDb();
    return db.get('photos', id);
  },
};

const categories: CategoryRepository = {
  async list() {
    const db = await getDb();
    const raw = await db.getAll('categories');
    return raw.map(normalizeCustomCategory).filter((c): c is CustomCategory => c !== null);
  },

  async save(category) {
    const db = await getDb();
    await db.put('categories', category);
  },

  async remove(id, moveTo) {
    const db = await getDb();
    const tx = db.transaction(['categories', 'recipes'], 'readwrite');
    const recipesStore = tx.objectStore('recipes');
    const affected = await recipesStore.index('by-category').getAll(id);
    const writes: Promise<unknown>[] = [tx.objectStore('categories').delete(id)];
    for (const raw of affected) {
      const recipe = normalizeRecipe(raw);
      if (recipe) writes.push(recipesStore.put({ ...recipe, categoryId: moveTo, updatedAt: Date.now() }));
    }
    await Promise.all([...writes, tx.done]);
  },
};

const achievements: AchievementRepository = {
  async list() {
    const db = await getDb();
    return db.getAll('achievements');
  },

  async unlock(entries) {
    const db = await getDb();
    const tx = db.transaction('achievements', 'readwrite');
    await Promise.all([...entries.map((e) => tx.store.put(e)), tx.done]);
  },
};

const settings: SettingsRepository = {
  async getAll() {
    const db = await getDb();
    const tx = db.transaction('settings');
    const [keys, values] = await Promise.all([tx.store.getAllKeys(), tx.store.getAll()]);
    const result: Record<string, unknown> = {};
    keys.forEach((key, index) => (result[String(key)] = values[index]));
    return result as Partial<Settings>;
  },
  async get<K extends keyof Settings>(key: K) {
    const db = await getDb();
    return (await db.get('settings', key)) as Settings[K] | undefined;
  },
  async set<K extends keyof Settings>(key: K, value: Settings[K]) {
    const db = await getDb();
    await db.put('settings', value, key);
  },
};

export const indexedDbDataSource: DataSource = { recipes, photos, categories, achievements, settings };
