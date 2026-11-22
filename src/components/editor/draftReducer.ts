/**
 * Cambios del borrador de receta (estado del formulario).
 */
import type { CategoryId } from '../../domain/categories';
import {
  newIngredientRow,
  newStepRow,
  type IngredientDraft,
  type PhotoRef,
  type RecipeDraft,
  type StepDraft,
} from '../../domain/draft';
import type { Difficulty, PhotoMode } from '../../domain/recipe';

type TextField = 'title' | 'notes' | 'prepMinutes' | 'cookMinutes' | 'servings';

export type DraftAction =
  | { type: 'setText'; field: TextField; value: string }
  | { type: 'setCategory'; value: CategoryId }
  | { type: 'setDifficulty'; value: Difficulty | null }
  | { type: 'setToTry'; value: boolean }
  | { type: 'setPhotoMode'; value: PhotoMode }
  | { type: 'setCover'; value: PhotoRef | null }
  | { type: 'addIngredient'; row: IngredientDraft; afterKey?: string }
  | { type: 'updateIngredient'; key: string; patch: Partial<Omit<IngredientDraft, 'key'>> }
  | { type: 'removeIngredient'; key: string }
  | { type: 'moveIngredient'; from: number; to: number }
  | { type: 'addStep'; row: StepDraft; afterKey?: string }
  | { type: 'updateStep'; key: string; patch: Partial<Omit<StepDraft, 'key'>> }
  | { type: 'removeStep'; key: string }
  | { type: 'moveStep'; from: number; to: number };

function insertAfter<T extends { key: string }>(list: T[], item: T, afterKey?: string): T[] {
  const index = afterKey ? list.findIndex((x) => x.key === afterKey) : -1;
  if (index === -1) return [...list, item];
  return [...list.slice(0, index + 1), item, ...list.slice(index + 1)];
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Editar una fila importada «pendiente de confirmar» la da por revisada; el
 * botón «Confirmar» manda `{ pending: undefined }` sin tocar nada más.
 */
function withReview<T extends { pending?: string }>(patch: Partial<T>): Partial<T> {
  return 'pending' in patch ? patch : { ...patch, pending: undefined };
}

export function draftReducer(draft: RecipeDraft, action: DraftAction): RecipeDraft {
  switch (action.type) {
    case 'setText':
      return {
        ...draft,
        [action.field]: action.value,
        // Escribir en un dato importado sin confirmar cuenta como revisarlo.
        pendingFields: draft.pendingFields?.filter((f) => f !== action.field),
      };
    case 'setCategory':
      return { ...draft, categoryId: action.value };
    case 'setDifficulty':
      return { ...draft, difficulty: action.value };
    case 'setToTry':
      return { ...draft, toTry: action.value };
    case 'setPhotoMode':
      return { ...draft, photoMode: action.value };
    case 'setCover':
      return { ...draft, coverPhoto: action.value };

    case 'addIngredient':
      return { ...draft, ingredients: insertAfter(draft.ingredients, action.row, action.afterKey) };
    case 'updateIngredient':
      return {
        ...draft,
        ingredients: draft.ingredients.map((i) => (i.key === action.key ? { ...i, ...withReview(action.patch) } : i)),
      };
    case 'removeIngredient': {
      const rest = draft.ingredients.filter((i) => i.key !== action.key);
      return { ...draft, ingredients: rest.length ? rest : [newIngredientRow()] };
    }
    case 'moveIngredient':
      return { ...draft, ingredients: move(draft.ingredients, action.from, action.to) };

    case 'addStep':
      return { ...draft, steps: insertAfter(draft.steps, action.row, action.afterKey) };
    case 'updateStep':
      return { ...draft, steps: draft.steps.map((s) => (s.key === action.key ? { ...s, ...withReview(action.patch) } : s)) };
    case 'removeStep': {
      const rest = draft.steps.filter((s) => s.key !== action.key);
      return { ...draft, steps: rest.length ? rest : [newStepRow()] };
    }
    case 'moveStep':
      return { ...draft, steps: move(draft.steps, action.from, action.to) };
  }
}
