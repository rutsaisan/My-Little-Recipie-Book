import { createContext, useContext } from 'react';
import type { RecipeDraft } from '../domain/draft';
import type { CookEntry, Recipe, RecipeId } from '../domain/recipe';

export interface CookedResult {
  recipe: Recipe;
  /** Deshace el «cocinada» recién apuntado. */
  undo: () => Promise<void>;
}

export interface RecipesContextValue {
  status: 'loading' | 'ready' | 'error';
  recipes: Recipe[];
  /** Historial de recetas cocinadas (para insignias y contadores). */
  cooks: CookEntry[];
  error: string | null;
  getRecipe: (id: RecipeId) => Recipe | undefined;
  /** Guarda un borrador (nuevo o edición) y devuelve la receta guardada. */
  saveDraft: (draft: RecipeDraft) => Promise<Recipe>;
  removeRecipe: (id: RecipeId) => Promise<void>;
  toggleFavorite: (id: RecipeId) => Promise<Recipe | undefined>;
  markCooked: (id: RecipeId) => Promise<CookedResult | undefined>;
  reload: () => void;
}

export const RecipesContext = createContext<RecipesContextValue | null>(null);

export function useRecipes(): RecipesContextValue {
  const value = useContext(RecipesContext);
  if (!value) throw new Error('useRecipes debe usarse dentro de <RecipesProvider>');
  return value;
}
