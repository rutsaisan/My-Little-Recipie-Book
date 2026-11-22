/**
 * Búsqueda y filtros del recetario (sin tildes ni mayúsculas: «limon»
 * encuentra «Limón»). Busca en el título, los ingredientes y las notas.
 */
import { compareByTitle, type Recipe, type RecipeId } from './recipe';

export type RecipeView = 'all' | 'favorites' | 'recent' | 'toTry' | 'cooked';

export const RECIPE_VIEWS: { id: RecipeView; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'favorites', label: 'Favoritas' },
  { id: 'recent', label: 'Recientes' },
  { id: 'toTry', label: 'Por probar' },
  { id: 'cooked', label: 'Cocinadas' },
];

export interface SearchOptions {
  query: string;
  view: RecipeView;
  categoryId: string | null;
  /** Ids de las recetas vistas hace poco, de la más reciente a la más antigua. */
  recent: RecipeId[];
}

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function score(recipe: Recipe, tokens: string[]): number {
  const title = normalizeText(recipe.title);
  const ingredients = recipe.ingredients.map((i) => normalizeText(i.name));
  const notes = normalizeText(recipe.notes);
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    if (title.startsWith(token)) best = 4;
    else if (title.includes(token)) best = 3;
    else if (ingredients.some((name) => name.includes(token))) best = 2;
    else if (notes.includes(token)) best = 1;
    if (best === 0) return 0; // todas las palabras deben aparecer en algún sitio
    total += best;
  }
  return total;
}

export function searchRecipes(recipes: Recipe[], options: SearchOptions): Recipe[] {
  const recentRank = new Map(options.recent.map((id, index) => [id, index]));
  let list = recipes.filter((r) => {
    if (options.categoryId && r.categoryId !== options.categoryId) return false;
    switch (options.view) {
      case 'favorites':
        return r.favorite;
      case 'recent':
        return recentRank.has(r.id);
      case 'toTry':
        return r.toTry;
      case 'cooked':
        return r.cookedCount > 0;
      default:
        return true;
    }
  });

  const tokens = normalizeText(options.query).split(' ').filter(Boolean);
  if (tokens.length) {
    const scored = list.map((r) => ({ r, s: score(r, tokens) })).filter((x) => x.s > 0);
    scored.sort((a, b) => b.s - a.s || compareByTitle(a.r, b.r));
    return scored.map((x) => x.r);
  }

  if (options.view === 'recent') {
    list = [...list].sort((a, b) => recentRank.get(a.id)! - recentRank.get(b.id)!);
  } else if (options.view === 'cooked') {
    list = [...list].sort((a, b) => b.cookedCount - a.cookedCount || compareByTitle(a, b));
  } else {
    list = [...list].sort(compareByTitle);
  }
  return list;
}

/** Añade una receta al principio de «recientes» (sin repetir, máx. `limit`). */
export function pushRecent(recent: RecipeId[], id: RecipeId, limit = 12): RecipeId[] {
  return [id, ...recent.filter((x) => x !== id)].slice(0, limit);
}
