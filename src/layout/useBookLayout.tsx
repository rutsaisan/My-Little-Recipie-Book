/**
 * Orquesta la maquetación: mide lo que haga falta (con caché por receta),
 * reparte cada receta en páginas y monta el libro completo.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { CategoryInfo } from '../components/decor/categoryArt';
import { ACHIEVEMENTS } from '../domain/achievements';
import { DEFAULT_CATEGORY_ID } from '../domain/categories';
import { compareByTitle, layoutSignature, type Recipe } from '../domain/recipe';
import { buildBook } from './buildBook';
import { albumCapacity, type PageGeometry } from './geometry';
import { Measurer, type IndexMeasureRequest, type MeasuredRecipe } from './Measurer';
import { paginateIndex, paginateRecipe } from './paginate';
import { ALBUM_LABEL } from './labels';
import type { BookLayout, BookSection, IndexEntry, IndexMeasure, RecipeBlock, RecipeMeasure } from './types';

interface RecipeCache {
  geometryKey: string;
  entries: Map<string, { stamp: string; measure: RecipeMeasure }>;
}

/** Recetas agrupadas por sección, en el orden del libro y por título. */
export function buildSections(recipes: Recipe[], categories: Pick<CategoryInfo, 'id'>[]): BookSection[] {
  const known = new Set(categories.map((c) => c.id));
  const byCategory = new Map<string, Recipe[]>();
  for (const recipe of recipes) {
    // Una receta de una sección que ya no existe se guarda en «Otras recetas».
    const id = known.has(recipe.categoryId) ? recipe.categoryId : DEFAULT_CATEGORY_ID;
    const list = byCategory.get(id) ?? [];
    list.push(recipe);
    byCategory.set(id, list);
  }
  return categories
    .filter((c) => byCategory.has(c.id))
    .map((c) => ({ categoryId: c.id, recipeIds: byCategory.get(c.id)!.sort(compareByTitle).map((r) => r.id) }));
}

export function buildIndexEntries(sections: BookSection[]): IndexEntry[] {
  return [
    ...sections.flatMap((s) => [
      { type: 'category' as const, categoryId: s.categoryId },
      ...s.recipeIds.map((recipeId) => ({ type: 'recipe' as const, recipeId, categoryId: s.categoryId })),
    ]),
    { type: 'album' as const },
  ];
}

/** Reparte las insignias del álbum en páginas según el tamaño de página. */
export function albumPagesFor(g: PageGeometry): string[][] {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  const pages: string[][] = [];
  let i = 0;
  while (i < ids.length) {
    const size = albumCapacity(g, pages.length === 0);
    pages.push(ids.slice(i, i + size));
    i += size;
  }
  return pages;
}

export function useBookLayout(
  recipes: Recipe[],
  categories: CategoryInfo[],
  geometry: PageGeometry,
  ready: boolean,
): { layout: BookLayout | null; measurer: ReactNode } {
  const [cache, setCache] = useState<RecipeCache>({ geometryKey: geometry.key, entries: new Map() });
  const [indexCache, setIndexCache] = useState<{ key: string; measure: IndexMeasure } | null>(null);

  // Las medidas solo valen para un tamaño de página: si cambia, se empieza de cero.
  const entries = useMemo(
    () =>
      cache.geometryKey === geometry.key ? cache.entries : new Map<string, { stamp: string; measure: RecipeMeasure }>(),
    [cache, geometry.key],
  );

  const pending = useMemo(
    () => (ready ? recipes.filter((r) => entries.get(r.id)?.stamp !== layoutSignature(r)) : []),
    [ready, recipes, entries],
  );

  const sections = useMemo(() => buildSections(recipes, categories), [recipes, categories]);
  const indexEntries = useMemo(() => buildIndexEntries(sections), [sections]);
  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const indexRequest = useMemo<IndexMeasureRequest | null>(() => {
    if (!ready) return null;
    const labels = indexEntries.map((e) =>
      e.type === 'category'
        ? (categoryNames.get(e.categoryId) ?? '')
        : e.type === 'recipe'
          ? (recipesById.get(e.recipeId)?.title ?? '')
          : ALBUM_LABEL,
    );
    const key = `${geometry.key}|${labels.join('\u0001')}`;
    return indexCache?.key === key ? null : { key, entries: indexEntries, labels };
  }, [ready, indexEntries, recipesById, categoryNames, geometry.key, indexCache]);

  const onRecipes = useCallback((geometryKey: string, measured: MeasuredRecipe[]) => {
    setCache((prev) => {
      const next = new Map(prev.geometryKey === geometryKey ? prev.entries : []);
      for (const m of measured) next.set(m.id, { stamp: m.stamp, measure: m.measure });
      return { geometryKey, entries: next };
    });
  }, []);

  const onIndex = useCallback((key: string, measure: IndexMeasure) => setIndexCache({ key, measure }), []);

  const layout = useMemo<BookLayout | null>(() => {
    if (!ready || pending.length || indexRequest || !indexCache) return null;
    const recipePages: Record<string, RecipeBlock[][]> = {};
    for (const recipe of recipes) {
      const cached = entries.get(recipe.id);
      if (!cached) return null;
      const columns = recipe.photoMode === 'process' ? geometry.processColumns : 1;
      recipePages[recipe.id] = paginateRecipe(cached.measure, geometry, columns);
    }
    const indexPages = paginateIndex(indexEntries, indexCache.measure, geometry);
    return buildBook({ mode: geometry.mode, sections, recipePages, indexPages, albumPages: albumPagesFor(geometry) });
  }, [ready, pending, entries, indexRequest, indexCache, recipes, geometry, indexEntries, sections]);

  // Mientras se vuelve a medir se sigue mostrando la última maqueta válida.
  const [shown, setShown] = useState<BookLayout | null>(null);
  if (layout && layout !== shown) setShown(layout);

  const measurer =
    pending.length || indexRequest ? (
      <Measurer geometry={geometry} recipes={pending} index={indexRequest} onRecipes={onRecipes} onIndex={onIndex} />
    ) : null;

  return { layout: layout ?? shown, measurer };
}
