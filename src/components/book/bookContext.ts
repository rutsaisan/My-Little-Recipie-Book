import { createContext, useContext } from 'react';
import type { CategoryId } from '../../domain/categories';
import type { Recipe, RecipeId } from '../../domain/recipe';
import type { PageGeometry } from '../../layout/geometry';
import type { BookLayout } from '../../layout/types';

/** Lo que necesitan las páginas para pintarse y para navegar por el libro. */
export interface BookContextValue {
  geometry: PageGeometry;
  layout: BookLayout;
  recipesById: Map<RecipeId, Recipe>;
  bookStartedAt: number | undefined;
  goToPage: (pageIndex: number) => void;
  onCreate: (categoryId?: CategoryId) => void;
  onEdit: (recipeId: RecipeId) => void;
  onDelete: (recipeId: RecipeId) => void;
  onToggleFavorite: (recipeId: RecipeId) => void;
  /** «¡La he cocinado!» (receta completada). */
  onCooked: (recipeId: RecipeId) => void;
  /** Abrir el modo «cocinar paso a paso». */
  onCook: (recipeId: RecipeId) => void;
  servingsFor: (recipe: Recipe) => number | null;
  setServings: (recipeId: RecipeId, value: number) => void;
  /** Receta recién guardada, para destacarla un momento. */
  highlightRecipeId: RecipeId | null;
}

export const BookContext = createContext<BookContextValue | null>(null);

export function useBook(): BookContextValue {
  const value = useContext(BookContext);
  if (!value) throw new Error('useBook debe usarse dentro del libro');
  return value;
}
