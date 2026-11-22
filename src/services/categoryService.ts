/**
 * Secciones propias: crear, cambiar y borrar (sus recetas pasan a «Otras»).
 */
import { dataSource, type DataSource } from '../data';
import {
  CATEGORY_NAME_MAX,
  createCustomCategoryId,
  DEFAULT_CATEGORY_ID,
  shortNameFor,
  type CategoryId,
  type CustomCategory,
  type PaletteColorId,
} from '../domain/categories';

export interface CategoryInput {
  name: string;
  character: string;
  color: PaletteColorId;
  phrase: string;
}

export function validateCategoryName(name: string, taken: string[]): string | null {
  const clean = name.trim();
  if (!clean) return 'Ponle un nombre a la sección.';
  if (clean.length > CATEGORY_NAME_MAX) return `Como mucho ${CATEGORY_NAME_MAX} letras.`;
  if (taken.some((t) => t.toLowerCase() === clean.toLowerCase())) return 'Ya hay una sección con ese nombre.';
  return null;
}

export async function createCategory(input: CategoryInput, source: DataSource = dataSource): Promise<CustomCategory> {
  const name = input.name.trim().slice(0, CATEGORY_NAME_MAX);
  const category: CustomCategory = {
    id: createCustomCategoryId(),
    name,
    shortName: shortNameFor(name),
    character: input.character,
    color: input.color,
    phrase: input.phrase.trim().slice(0, 60),
    createdAt: Date.now(),
  };
  await source.categories.save(category);
  return category;
}

export async function updateCategory(
  category: CustomCategory,
  input: CategoryInput,
  source: DataSource = dataSource,
): Promise<CustomCategory> {
  const name = input.name.trim().slice(0, CATEGORY_NAME_MAX);
  const updated: CustomCategory = {
    ...category,
    name,
    shortName: shortNameFor(name),
    character: input.character,
    color: input.color,
    phrase: input.phrase.trim().slice(0, 60),
  };
  await source.categories.save(updated);
  return updated;
}

export async function deleteCategory(id: CategoryId, source: DataSource = dataSource): Promise<void> {
  await source.categories.remove(id, DEFAULT_CATEGORY_ID);
}
