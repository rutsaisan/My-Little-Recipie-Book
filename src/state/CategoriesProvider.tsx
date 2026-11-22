import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  customCategoryInfo,
  DEFAULT_CATEGORY_INFOS,
  FALLBACK_CATEGORY_INFO,
  type CategoryInfo,
} from '../components/decor/categoryArt';
import { dataSource } from '../data';
import type { CategoryId, CustomCategory } from '../domain/categories';
import { createCategory, deleteCategory, updateCategory, type CategoryInput } from '../services/categoryService';
import { CategoriesContext, type CategoriesContextValue } from './categoriesContext';
import { useRecipes } from './recipesContext';

/** Secciones fijas + las creadas por la persona. */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { reload } = useRecipes();
  const [custom, setCustom] = useState<CustomCategory[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    dataSource.categories
      .list()
      .then((list) => alive && setCustom(list))
      .catch((error: unknown) => console.error('[secciones] No se pudieron cargar', error))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const categories = useMemo<CategoryInfo[]>(
    () => [...DEFAULT_CATEGORY_INFOS, ...[...custom].sort((a, b) => a.createdAt - b.createdAt).map(customCategoryInfo)],
    [custom],
  );

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const getInfo = useCallback((id: CategoryId) => byId.get(id) ?? FALLBACK_CATEGORY_INFO, [byId]);

  const create = useCallback(async (input: CategoryInput) => {
    const category = await createCategory(input);
    setCustom((list) => [...list, category]);
    return category;
  }, []);

  const update = useCallback(
    async (id: CategoryId, input: CategoryInput) => {
      const current = custom.find((c) => c.id === id);
      if (!current) return;
      const updated = await updateCategory(current, input);
      setCustom((list) => list.map((c) => (c.id === id ? updated : c)));
    },
    [custom],
  );

  const remove = useCallback(
    async (id: CategoryId) => {
      await deleteCategory(id);
      setCustom((list) => list.filter((c) => c.id !== id));
      reload(); // sus recetas han pasado a «Otras recetas»
    },
    [reload],
  );

  const value = useMemo<CategoriesContextValue>(
    () => ({ loaded, categories, custom, getInfo, create, update, remove }),
    [loaded, categories, custom, getInfo, create, update, remove],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}
