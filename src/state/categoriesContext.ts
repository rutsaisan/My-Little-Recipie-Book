import { createContext, useContext } from 'react';
import type { CategoryInfo } from '../components/decor/categoryArt';
import type { CategoryId, CustomCategory } from '../domain/categories';
import type { CategoryInput } from '../services/categoryService';

export interface CategoriesContextValue {
  /** Ya se han leído las secciones propias guardadas. */
  loaded: boolean;
  /** Todas las secciones, en el orden del libro. */
  categories: CategoryInfo[];
  custom: CustomCategory[];
  /** Información de una sección (si ya no existe, la de «Otras recetas»). */
  getInfo: (id: CategoryId) => CategoryInfo;
  create: (input: CategoryInput) => Promise<CustomCategory>;
  update: (id: CategoryId, input: CategoryInput) => Promise<void>;
  remove: (id: CategoryId) => Promise<void>;
}

export const CategoriesContext = createContext<CategoriesContextValue | null>(null);

export function useCategories(): CategoriesContextValue {
  const value = useContext(CategoriesContext);
  if (!value) throw new Error('useCategories debe usarse dentro de <CategoriesProvider>');
  return value;
}
