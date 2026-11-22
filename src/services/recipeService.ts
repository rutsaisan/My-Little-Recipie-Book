/**
 * Casos de uso de las recetas: guardar un borrador y borrar una receta.
 *
 * Aquí se decide qué fotos nuevas hay que guardar y cuáles antiguas sobran,
 * para que la base de datos no acumule fotos huérfanas.
 */
import { dataSource, type DataSource, type PhotoInput } from '../data';
import { draftToRecipe, photosToKeep, validateDraft, type PhotoRef, type RecipeDraft } from '../domain/draft';
import { createId } from '../domain/ids';
import { recipePhotoIds, type CookEntry, type PhotoId, type Recipe } from '../domain/recipe';
import { forgetPhotos } from './photoUrls';

export class InvalidDraftError extends Error {
  constructor() {
    super('A la receta le falta algún dato.');
    this.name = 'InvalidDraftError';
  }
}

export async function saveRecipeDraft(
  draft: RecipeDraft,
  existing: Recipe | undefined,
  source: DataSource = dataSource,
): Promise<Recipe> {
  if (!validateDraft(draft).ok) throw new InvalidDraftError();

  const keep = photosToKeep(draft);
  const add: PhotoInput[] = [];
  const resolve = (ref: PhotoRef): PhotoId => {
    if (ref.kind === 'stored') return ref.id;
    const id = createId();
    add.push({ id, blob: ref.blob, width: ref.width, height: ref.height });
    return id;
  };

  const cover = keep.cover ? resolve(keep.cover) : null;
  const steps: Record<string, PhotoId | null> = {};
  for (const [key, ref] of keep.steps) steps[key] = resolve(ref);

  const recipe = draftToRecipe(draft, { cover, steps }, Date.now(), existing);
  const used = new Set(recipePhotoIds(recipe));
  const remove = existing ? recipePhotoIds(existing).filter((id) => !used.has(id)) : [];

  await source.recipes.save(recipe, { add, remove });
  forgetPhotos(remove);
  return recipe;
}

export async function deleteRecipe(recipe: Recipe, source: DataSource = dataSource): Promise<void> {
  await source.recipes.remove(recipe.id);
  forgetPhotos(recipePhotoIds(recipe));
}

export async function setFavorite(recipe: Recipe, favorite: boolean, source: DataSource = dataSource): Promise<Recipe> {
  const updated = { ...recipe, favorite };
  await source.recipes.update(updated);
  return updated;
}

export interface CookResult {
  recipe: Recipe;
  entry: CookEntry;
  /** Deshace este «cocinada» (por si se pulsó sin querer). */
  undo: () => Promise<Recipe>;
}

/** «¡La he cocinado!»: suma una vez, apunta la fecha y quita «por probar». */
export async function markCooked(recipe: Recipe, source: DataSource = dataSource): Promise<CookResult> {
  const now = Date.now();
  const entry: CookEntry = { id: createId(), recipeId: recipe.id, categoryId: recipe.categoryId, at: now };
  const updated: Recipe = { ...recipe, cookedCount: recipe.cookedCount + 1, lastCookedAt: now, toTry: false };
  await source.recipes.recordCook(updated, entry);
  return {
    recipe: updated,
    entry,
    undo: async () => {
      const restored: Recipe = {
        ...updated,
        cookedCount: Math.max(0, updated.cookedCount - 1),
        lastCookedAt: recipe.lastCookedAt,
        toTry: recipe.toTry,
      };
      await source.recipes.undoCook(restored, entry.id);
      return restored;
    },
  };
}

/**
 * Pide al navegador que no borre los datos aunque le falte espacio.
 * Se llama tras guardar la primera receta (algunos navegadores preguntan).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
