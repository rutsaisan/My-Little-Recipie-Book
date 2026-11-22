import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { normalizeRecipe, type Recipe } from '../../domain/recipe';
import { DB_NAME, resetDbConnection } from './db';
import { indexedDbDataSource } from './repositories';

const { recipes, photos, settings } = indexedDbDataSource;

function recipe(id: string, photoIds: { cover?: string; step?: string } = {}): Recipe {
  return normalizeRecipe({
    id,
    title: `Receta ${id}`,
    categoryId: 'comidas',
    photoMode: photoIds.step ? 'process' : 'final',
    coverPhotoId: photoIds.cover ?? null,
    ingredients: [{ id: 'i1', name: 'arroz', quantity: 300, unit: 'g' }],
    steps: [{ id: 's1', text: 'Cocer.', photoId: photoIds.step ?? null }],
    createdAt: 1,
    updatedAt: 1,
  })!;
}

// fake-indexeddb no sabe guardar Blob en Node; el repositorio no mira dentro de
// la foto, así que basta con un dato clonable que haga de imagen.
const photo = (id: string) => ({ id, blob: new Uint8Array([1, 2, 3]) as unknown as Blob, width: 10, height: 10 });

beforeEach(async () => {
  await resetDbConnection();
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
});

describe('repositorio de recetas (IndexedDB)', () => {
  it('guarda y vuelve a leer recetas', async () => {
    await recipes.save(recipe('a'), { add: [], remove: [] });
    await recipes.save(recipe('b'), { add: [], remove: [] });
    const all = await recipes.list();
    expect(all.map((r) => r.id).sort()).toEqual(['a', 'b']);
    expect((await recipes.get('a'))?.ingredients[0].name).toBe('arroz');
  });

  it('guarda las fotos junto a la receta y borra las que ya no usa', async () => {
    await recipes.save(recipe('a', { cover: 'p1' }), { add: [photo('p1')], remove: [] });
    expect(await photos.get('p1')).toBeTruthy();

    await recipes.save(recipe('a', { cover: 'p2' }), { add: [photo('p2')], remove: ['p1'] });
    expect(await photos.get('p1')).toBeUndefined();
    expect(await photos.get('p2')).toBeTruthy();
  });

  it('al borrar una receta borra también sus fotos', async () => {
    await recipes.save(recipe('a', { step: 'p3' }), { add: [photo('p3')], remove: [] });
    await recipes.remove('a');
    expect(await recipes.get('a')).toBeUndefined();
    expect(await photos.get('p3')).toBeUndefined();
  });
});

describe('fase 2', () => {
  it('apunta y deshace recetas cocinadas a la vez que actualiza la receta', async () => {
    const base = recipe('a');
    await recipes.save(base, { add: [], remove: [] });
    const cooked = { ...base, cookedCount: 1, lastCookedAt: 5 };
    await recipes.recordCook(cooked, { id: 'c1', recipeId: 'a', categoryId: 'comidas', at: 5 });
    expect((await recipes.get('a'))?.cookedCount).toBe(1);
    expect(await recipes.listCooks()).toHaveLength(1);
    await recipes.undoCook(base, 'c1');
    expect((await recipes.get('a'))?.cookedCount).toBe(0);
    expect(await recipes.listCooks()).toHaveLength(0);
  });

  it('al borrar una sección propia sus recetas pasan a «Otras»', async () => {
    await indexedDbDataSource.categories.save({
      id: 'c-abc',
      name: 'De la abuela',
      shortName: 'De la abuela',
      character: 'patito-naranja',
      color: 'caramelo',
      phrase: '',
      createdAt: 1,
    });
    await recipes.save({ ...recipe('a'), categoryId: 'c-abc' }, { add: [], remove: [] });
    expect((await recipes.get('a'))?.categoryId).toBe('c-abc');
    await indexedDbDataSource.categories.remove('c-abc', 'otras');
    expect((await recipes.get('a'))?.categoryId).toBe('otras');
    expect(await indexedDbDataSource.categories.list()).toEqual([]);
  });

  it('migra una base de datos de la versión 1 sin perder recetas', async () => {
    await resetDbConnection();
    await new Promise<void>((resolve) => {
      const del = indexedDB.deleteDatabase(DB_NAME);
      del.onsuccess = del.onerror = () => resolve();
    });
    await new Promise<void>((resolve) => {
      const open = indexedDB.open(DB_NAME, 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore('recipes', { keyPath: 'id' }).createIndex('by-category', 'categoryId');
        db.createObjectStore('photos', { keyPath: 'id' });
        db.createObjectStore('settings');
        open.transaction!.objectStore('recipes').put({ id: 'vieja', title: 'Receta antigua', categoryId: 'cenas' });
      };
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
    });
    const old = await recipes.get('vieja');
    expect(old?.title).toBe('Receta antigua');
    expect(old?.favorite).toBe(false);
    expect(old?.cookedCount).toBe(0);
    expect(await indexedDbDataSource.achievements.list()).toEqual([]);
  });
});

describe('ajustes', () => {
  it('recuerdan el marcapáginas', async () => {
    expect(await settings.get('bookmark')).toBeUndefined();
    await settings.set('bookmark', 'recipe:a:0');
    expect(await settings.get('bookmark')).toBe('recipe:a:0');
  });
});
