/**
 * Modelo de datos de una receta.
 *
 * Es la forma en que se guarda en la base de datos. Cualquier dato leído del
 * almacenamiento pasa por `normalizeRecipe`, que rellena valores por defecto:
 * así se pueden añadir campos nuevos en el futuro sin migraciones complicadas.
 */
import { DEFAULT_CATEGORY_ID, isValidCategoryId, type CategoryId } from './categories';

export type RecipeId = string;
export type PhotoId = string;

/** Cómo se presentan las fotos: una del plato terminado o una por paso. */
export type PhotoMode = 'final' | 'process';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Ingredient {
  id: string;
  name: string;
  /** `null` cuando no hay cantidad («sal al gusto»). */
  quantity: number | null;
  /** Id de unidad (ver `units.ts`); vacío = sin unidad. */
  unit: string;
}

export interface RecipeStep {
  id: string;
  text: string;
  photoId: PhotoId | null;
}

/** De dónde viene la receta (fases 3 y 4: dictado por voz e importación). */
export type RecipeSource =
  | { kind: 'manual' }
  | { kind: 'dictated' }
  /** Importada de un vídeo (fase 4): enlace original si lo había. */
  | { kind: 'video'; url: string | null };

function normalizeSource(raw: unknown): RecipeSource {
  if (!isObject(raw)) return { kind: 'manual' };
  if (raw.kind === 'dictated') return { kind: 'dictated' };
  if (raw.kind === 'video') return { kind: 'video', url: typeof raw.url === 'string' ? raw.url : null };
  return { kind: 'manual' };
}

export interface Recipe {
  id: RecipeId;
  title: string;
  categoryId: CategoryId;
  photoMode: PhotoMode;
  /** Foto del plato terminado (solo en modo «final»). */
  coverPhotoId: PhotoId | null;
  ingredients: Ingredient[];
  steps: RecipeStep[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  difficulty: Difficulty | null;
  notes: string;
  source: RecipeSource;
  createdAt: number;
  updatedAt: number;
  // ── Organización (fase 2) ──
  /** Marcada con el corazón. */
  favorite: boolean;
  /** «Pendiente de probar»: se quita sola al marcarla como cocinada. */
  toTry: boolean;
  /** Veces que se ha marcado como cocinada (receta completada). */
  cookedCount: number;
  lastCookedAt: number | null;
}

/** Una vez que se cocinó una receta (historial para insignias y estadísticas). */
export interface CookEntry {
  id: string;
  recipeId: RecipeId;
  categoryId: CategoryId;
  at: number;
}

export const DIFFICULTIES: { id: Difficulty; label: string; level: 1 | 2 | 3 }[] = [
  { id: 'easy', label: 'Fácil', level: 1 },
  { id: 'medium', label: 'Media', level: 2 },
  { id: 'hard', label: 'Difícil', level: 3 },
];

export function difficultyInfo(id: Difficulty) {
  return DIFFICULTIES.find((d) => d.id === id)!;
}

/** Todas las fotos que usa la receta (para borrarlas con ella). */
export function recipePhotoIds(recipe: Recipe): PhotoId[] {
  const ids: PhotoId[] = [];
  if (recipe.coverPhotoId) ids.push(recipe.coverPhotoId);
  for (const step of recipe.steps) if (step.photoId) ids.push(step.photoId);
  return ids;
}

/** La foto que mejor representa el plato: la final o la del último paso. */
export function representativePhotoId(recipe: Recipe): PhotoId | null {
  if (recipe.coverPhotoId) return recipe.coverPhotoId;
  for (let i = recipe.steps.length - 1; i >= 0; i--) {
    const photo = recipe.steps[i].photoId;
    if (photo) return photo;
  }
  return null;
}

/** 75 → «1 h 15 min». */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export function compareByTitle(a: Recipe, b: Recipe): number {
  return collator.compare(a.title, b.title) || a.createdAt - b.createdAt;
}

// ── Lectura defensiva desde el almacenamiento ──────────────────────────────

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null;
const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function normalizeRecipe(raw: unknown): Recipe | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null;
  const now = Date.now();
  const photoMode: PhotoMode = raw.photoMode === 'process' ? 'process' : 'final';
  const difficulty = DIFFICULTIES.some((d) => d.id === raw.difficulty) ? (raw.difficulty as Difficulty) : null;

  const cooked = num(raw.cookedCount);
  return {
    id: raw.id,
    title: str(raw.title, 'Receta sin título'),
    // Se conserva cualquier sección (también las personalizadas); si una
    // sección ya no existe, la interfaz la muestra dentro de «Otras recetas».
    categoryId: isValidCategoryId(raw.categoryId) ? raw.categoryId : DEFAULT_CATEGORY_ID,
    photoMode,
    coverPhotoId: typeof raw.coverPhotoId === 'string' ? raw.coverPhotoId : null,
    ingredients: Array.isArray(raw.ingredients)
      ? raw.ingredients.filter(isObject).map((i, index) => ({
          id: str(i.id, `ing-${index}`),
          name: str(i.name),
          quantity: num(i.quantity),
          unit: str(i.unit),
        }))
      : [],
    steps: Array.isArray(raw.steps)
      ? raw.steps.filter(isObject).map((s, index) => ({
          id: str(s.id, `step-${index}`),
          text: str(s.text),
          photoId: typeof s.photoId === 'string' ? s.photoId : null,
        }))
      : [],
    prepMinutes: num(raw.prepMinutes),
    cookMinutes: num(raw.cookMinutes),
    servings: num(raw.servings),
    difficulty,
    notes: str(raw.notes),
    source: normalizeSource(raw.source),
    createdAt: num(raw.createdAt) ?? now,
    updatedAt: num(raw.updatedAt) ?? now,
    favorite: raw.favorite === true,
    toTry: raw.toTry === true,
    cookedCount: cooked !== null && cooked > 0 ? Math.floor(cooked) : 0,
    lastCookedAt: num(raw.lastCookedAt),
  };
}

export function normalizeCookEntry(raw: unknown): CookEntry | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.recipeId !== 'string') return null;
  const at = num(raw.at);
  if (at === null) return null;
  return {
    id: raw.id,
    recipeId: raw.recipeId,
    categoryId: isValidCategoryId(raw.categoryId) ? raw.categoryId : DEFAULT_CATEGORY_ID,
    at,
  };
}

/**
 * Lo que cambia la maqueta de una receta: si esta firma cambia, hay que
 * volver a medirla (editar, marcar favorita, cocinarla…).
 */
export function layoutSignature(recipe: Recipe): string {
  return `${recipe.updatedAt}|${recipe.favorite ? 1 : 0}|${recipe.toTry ? 1 : 0}|${recipe.cookedCount}`;
}
