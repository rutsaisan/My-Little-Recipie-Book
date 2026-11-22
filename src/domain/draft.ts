/**
 * Borrador de receta: lo que se va rellenando en el formulario.
 *
 * Los campos numéricos se guardan como texto mientras se escribe («1/2»,
 * «0,5»…) y solo se convierten al guardar. Las fotos nuevas viven en memoria
 * (Blob) hasta que la receta se guarda, así cancelar no deja basura guardada.
 */
import { DEFAULT_CATEGORY_ID, type CategoryId } from './categories';
import { createId } from './ids';
import { parseQuantity, quantityToInput } from './quantities';
import { getUnit } from './units';
import type { Difficulty, PhotoId, PhotoMode, Recipe, RecipeId, RecipeSource } from './recipe';

export type PhotoRef =
  | { kind: 'stored'; id: PhotoId }
  | { kind: 'new'; blob: Blob; url: string; width: number; height: number };

export interface IngredientDraft {
  key: string;
  quantity: string;
  unit: string;
  name: string;
  /**
   * «Pendiente de confirmar»: la importación no pudo asegurar este dato. Se
   * guarda el motivo y se borra al confirmarlo o al editar la fila.
   */
  pending?: string;
}

export interface StepDraft {
  key: string;
  text: string;
  photo: PhotoRef | null;
  /** «Pendiente de confirmar» (ver IngredientDraft.pending). */
  pending?: string;
}

export interface RecipeDraft {
  /** `null` si la receta es nueva. */
  id: RecipeId | null;
  title: string;
  /** `null` mientras no se ha respondido la pregunta de las fotos. */
  photoMode: PhotoMode | null;
  coverPhoto: PhotoRef | null;
  ingredients: IngredientDraft[];
  steps: StepDraft[];
  categoryId: CategoryId;
  prepMinutes: string;
  cookMinutes: string;
  servings: string;
  difficulty: Difficulty | null;
  notes: string;
  /** «Aún no la he probado». */
  toTry: boolean;
  /** Origen (si no se indica, se conserva el de la receta o «a mano»). */
  source?: RecipeSource;
  /** Datos generales que la importación no pudo confirmar. */
  pendingFields?: PendingField[];
  /** Avisos de la importación para mostrar en el formulario. */
  importWarnings?: string[];
}

export type PendingField = 'title' | 'servings' | 'prepMinutes' | 'cookMinutes';

/**
 * Límites de longitud: garantizan que cada paso y las notas quepan en una
 * página del libro incluso en la pantalla más pequeña.
 */
export const LIMITS = {
  title: 90,
  ingredientName: 120,
  stepText: 600,
  notes: 700,
  minutes: 2880,
  servings: 100,
} as const;

export function newIngredientRow(): IngredientDraft {
  return { key: createId(), quantity: '', unit: '', name: '' };
}

export function newStepRow(): StepDraft {
  return { key: createId(), text: '', photo: null };
}

export function createEmptyDraft(categoryId: CategoryId = DEFAULT_CATEGORY_ID): RecipeDraft {
  return {
    id: null,
    title: '',
    photoMode: null,
    coverPhoto: null,
    ingredients: [newIngredientRow()],
    steps: [newStepRow()],
    categoryId,
    prepMinutes: '',
    cookMinutes: '',
    servings: '',
    difficulty: null,
    notes: '',
    toTry: false,
  };
}

export function draftFromRecipe(recipe: Recipe): RecipeDraft {
  return {
    id: recipe.id,
    title: recipe.title,
    photoMode: recipe.photoMode,
    coverPhoto: recipe.coverPhotoId ? { kind: 'stored', id: recipe.coverPhotoId } : null,
    ingredients: recipe.ingredients.length
      ? recipe.ingredients.map((i) => ({
          key: i.id,
          quantity: quantityToInput(i.quantity),
          unit: i.unit,
          name: i.name,
        }))
      : [newIngredientRow()],
    steps: recipe.steps.length
      ? recipe.steps.map((s) => ({
          key: s.id,
          text: s.text,
          photo: s.photoId ? { kind: 'stored', id: s.photoId } : null,
        }))
      : [newStepRow()],
    categoryId: recipe.categoryId,
    prepMinutes: recipe.prepMinutes === null ? '' : String(recipe.prepMinutes),
    cookMinutes: recipe.cookMinutes === null ? '' : String(recipe.cookMinutes),
    servings: recipe.servings === null ? '' : String(recipe.servings),
    difficulty: recipe.difficulty,
    notes: recipe.notes,
    toTry: recipe.toTry,
  };
}

// ── Validación ─────────────────────────────────────────────────────────────

export interface DraftIssues {
  title?: string;
  ingredients: Record<string, { quantity?: string; name?: string; pending?: string }>;
  steps: Record<string, string>;
  prepMinutes?: string;
  cookMinutes?: string;
  servings?: string;
}

export interface DraftValidation {
  ok: boolean;
  issues: DraftIssues;
  /** Primer apartado con errores, para llevar allí a la persona. */
  firstSection: 'photos' | 'ingredients' | 'steps' | 'details' | null;
}

const isBlankIngredient = (i: IngredientDraft) => !i.name.trim() && !i.quantity.trim() && !i.unit;
const isBlankStep = (s: StepDraft) => !s.text.trim() && !s.photo;

function parseWhole(text: string, min: number, max: number): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n < min || n > max ? undefined : n;
}

export function validateDraft(draft: RecipeDraft): DraftValidation {
  const issues: DraftIssues = { ingredients: {}, steps: {} };

  if (!draft.title.trim()) issues.title = 'Ponle un nombre a la receta.';

  for (const row of draft.ingredients) {
    if (isBlankIngredient(row)) continue;
    const rowIssues: { quantity?: string; name?: string; pending?: string } = {};
    if (!row.name.trim()) rowIssues.name = '¿Qué ingrediente es?';
    const parsed = parseQuantity(row.quantity);
    if (!parsed.ok) rowIssues.quantity = 'Escribe un número: 200, 1,5 o 1/2.';
    if (row.pending) rowIssues.pending = 'Confirma o corrige este ingrediente.';
    if (rowIssues.name || rowIssues.quantity || rowIssues.pending) issues.ingredients[row.key] = rowIssues;
  }

  for (const step of draft.steps) {
    if (isBlankStep(step)) continue;
    if (!step.text.trim()) issues.steps[step.key] = 'Cuenta qué se hace en este paso.';
    else if (step.pending) issues.steps[step.key] = 'Confirma o corrige este paso.';
  }

  if (parseWhole(draft.prepMinutes, 0, LIMITS.minutes) === undefined)
    issues.prepMinutes = 'Minutos enteros, entre 0 y 2880.';
  if (parseWhole(draft.cookMinutes, 0, LIMITS.minutes) === undefined)
    issues.cookMinutes = 'Minutos enteros, entre 0 y 2880.';
  if (parseWhole(draft.servings, 1, LIMITS.servings) === undefined)
    issues.servings = 'Un número entre 1 y 100.';

  // Lo importado sin confirmar no se guarda sin que alguien lo mire.
  const pending = new Set(draft.pendingFields ?? []);
  if (pending.has('title') && !issues.title) issues.title = 'Confirma el nombre de la receta.';
  if (pending.has('prepMinutes') && !issues.prepMinutes) issues.prepMinutes = 'Confirma el tiempo de preparación.';
  if (pending.has('cookMinutes') && !issues.cookMinutes) issues.cookMinutes = 'Confirma el tiempo de cocción.';
  if (pending.has('servings') && !issues.servings) issues.servings = 'Confirma los comensales.';

  let firstSection: DraftValidation['firstSection'] = null;
  if (issues.title) firstSection = 'photos';
  else if (Object.keys(issues.ingredients).length) firstSection = 'ingredients';
  else if (Object.keys(issues.steps).length) firstSection = 'steps';
  else if (issues.prepMinutes || issues.cookMinutes || issues.servings) firstSection = 'details';

  return { ok: firstSection === null, issues, firstSection };
}

// ── Conversión a receta ────────────────────────────────────────────────────

/** Fotos ya resueltas: ids definitivos de la foto final y de cada paso. */
export interface ResolvedPhotos {
  cover: PhotoId | null;
  steps: Record<string, PhotoId | null>;
}

/** Fotos que se conservarán al guardar según el modo elegido. */
export function photosToKeep(draft: RecipeDraft): { cover: PhotoRef | null; steps: Map<string, PhotoRef> } {
  const mode = draft.photoMode ?? 'final';
  const steps = new Map<string, PhotoRef>();
  if (mode === 'process') {
    for (const s of draft.steps) if (s.photo && !isBlankStep(s)) steps.set(s.key, s.photo);
  }
  return { cover: mode === 'final' ? draft.coverPhoto : null, steps };
}

export function draftToRecipe(
  draft: RecipeDraft,
  photos: ResolvedPhotos,
  now: number,
  existing?: Recipe,
): Recipe {
  const ingredients = draft.ingredients
    .filter((i) => !isBlankIngredient(i))
    .map((i) => {
      const parsed = parseQuantity(i.quantity);
      const unit = getUnit(i.unit);
      return {
        id: i.key,
        name: i.name.trim(),
        quantity: parsed.ok && !unit.noQuantity ? parsed.value : null,
        unit: i.unit,
      };
    });

  const steps = draft.steps
    .filter((s) => !isBlankStep(s))
    .map((s) => ({ id: s.key, text: s.text.trim(), photoId: photos.steps[s.key] ?? null }));

  return {
    id: draft.id ?? existing?.id ?? createId(),
    title: draft.title.trim(),
    categoryId: draft.categoryId,
    photoMode: draft.photoMode ?? 'final',
    coverPhotoId: photos.cover,
    ingredients,
    steps,
    prepMinutes: parseWhole(draft.prepMinutes, 0, LIMITS.minutes) ?? null,
    cookMinutes: parseWhole(draft.cookMinutes, 0, LIMITS.minutes) ?? null,
    servings: parseWhole(draft.servings, 1, LIMITS.servings) ?? null,
    difficulty: draft.difficulty,
    notes: draft.notes.trim(),
    source: draft.source ?? existing?.source ?? { kind: 'manual' },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    // Lo que no se edita en el formulario se conserva tal cual.
    favorite: existing?.favorite ?? false,
    toTry: draft.toTry,
    cookedCount: existing?.cookedCount ?? 0,
    lastCookedAt: existing?.lastCookedAt ?? null,
  };
}

/** ¿Hay algo escrito? (para avisar antes de cerrar sin guardar). */
export function draftHasContent(draft: RecipeDraft): boolean {
  return Boolean(
    draft.title.trim() ||
      draft.coverPhoto ||
      draft.notes.trim() ||
      draft.ingredients.some((i) => !isBlankIngredient(i)) ||
      draft.steps.some((s) => !isBlankStep(s)),
  );
}
