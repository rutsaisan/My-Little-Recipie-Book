import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { dataSource } from '../data';
import type { RecipeDraft } from '../domain/draft';
import type { CookEntry, Recipe, RecipeId } from '../domain/recipe';
import {
  deleteRecipe,
  markCooked as markCookedService,
  requestPersistentStorage,
  saveRecipeDraft,
  setFavorite,
} from '../services/recipeService';
import { RecipesContext, type RecipesContextValue } from './recipesContext';

interface State {
  status: 'loading' | 'ready' | 'error';
  recipes: Recipe[];
  cooks: CookEntry[];
  error: string | null;
  loadToken: number;
}

type Action =
  | { type: 'load' }
  | { type: 'loaded'; recipes: Recipe[]; cooks: CookEntry[] }
  | { type: 'failed'; error: string }
  | { type: 'saved'; recipe: Recipe }
  | { type: 'removed'; id: RecipeId }
  | { type: 'cookAdded'; recipe: Recipe; entry: CookEntry }
  | { type: 'cookRemoved'; recipe: Recipe; entryId: string };

function upsert(list: Recipe[], recipe: Recipe): Recipe[] {
  return list.some((r) => r.id === recipe.id) ? list.map((r) => (r.id === recipe.id ? recipe : r)) : [...list, recipe];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'load':
      return { ...state, status: 'loading', error: null, loadToken: state.loadToken + 1 };
    case 'loaded':
      return { ...state, status: 'ready', recipes: action.recipes, cooks: action.cooks };
    case 'failed':
      return { ...state, status: 'error', error: action.error };
    case 'saved':
      return { ...state, recipes: upsert(state.recipes, action.recipe) };
    case 'removed':
      return { ...state, recipes: state.recipes.filter((r) => r.id !== action.id) };
    case 'cookAdded':
      return { ...state, recipes: upsert(state.recipes, action.recipe), cooks: [...state.cooks, action.entry] };
    case 'cookRemoved':
      return {
        ...state,
        recipes: upsert(state.recipes, action.recipe),
        cooks: state.cooks.filter((c) => c.id !== action.entryId),
      };
  }
}

/** Mantiene en memoria las recetas guardadas y expone las acciones. */
export function RecipesProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    status: 'loading',
    recipes: [],
    cooks: [],
    error: null,
    loadToken: 0,
  });
  // Última lista conocida, para que las acciones no dependan de cada render.
  const recipesRef = useRef(state.recipes);
  useEffect(() => {
    recipesRef.current = state.recipes;
  }, [state.recipes]);

  useEffect(() => {
    let alive = true;
    Promise.all([dataSource.recipes.list(), dataSource.recipes.listCooks()])
      .then(([recipes, cooks]) => alive && dispatch({ type: 'loaded', recipes, cooks }))
      .catch((error: unknown) => {
        console.error('[recetas] No se pudieron cargar', error);
        if (alive) {
          dispatch({
            type: 'failed',
            error: 'No he podido abrir tu recetario. Si estás en modo incógnito, el navegador puede no permitir guardar datos.',
          });
        }
      });
    return () => {
      alive = false;
    };
  }, [state.loadToken]);

  const find = (id: RecipeId) => recipesRef.current.find((r) => r.id === id);

  const getRecipe = useCallback((id: RecipeId) => state.recipes.find((r) => r.id === id), [state.recipes]);

  const saveDraft = useCallback(async (draft: RecipeDraft) => {
    const existing = draft.id ? find(draft.id) : undefined;
    const isFirst = recipesRef.current.length === 0;
    const recipe = await saveRecipeDraft(draft, existing);
    dispatch({ type: 'saved', recipe });
    if (!existing && isFirst) void requestPersistentStorage();
    return recipe;
  }, []);

  const removeRecipe = useCallback(async (id: RecipeId) => {
    const recipe = find(id);
    if (!recipe) return;
    await deleteRecipe(recipe);
    dispatch({ type: 'removed', id });
  }, []);

  const toggleFavorite = useCallback(async (id: RecipeId) => {
    const recipe = find(id);
    if (!recipe) return undefined;
    const updated = await setFavorite(recipe, !recipe.favorite);
    dispatch({ type: 'saved', recipe: updated });
    return updated;
  }, []);

  const markCooked = useCallback(async (id: RecipeId) => {
    const recipe = find(id);
    if (!recipe) return undefined;
    const result = await markCookedService(recipe);
    dispatch({ type: 'cookAdded', recipe: result.recipe, entry: result.entry });
    return {
      recipe: result.recipe,
      undo: async () => {
        const restored = await result.undo();
        dispatch({ type: 'cookRemoved', recipe: restored, entryId: result.entry.id });
      },
    };
  }, []);

  const reload = useCallback(() => dispatch({ type: 'load' }), []);

  const value = useMemo<RecipesContextValue>(
    () => ({
      status: state.status,
      recipes: state.recipes,
      cooks: state.cooks,
      error: state.error,
      getRecipe,
      saveDraft,
      removeRecipe,
      toggleFavorite,
      markCooked,
      reload,
    }),
    [state.status, state.recipes, state.cooks, state.error, getRecipe, saveDraft, removeRecipe, toggleFavorite, markCooked, reload],
  );

  return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>;
}
