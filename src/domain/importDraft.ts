/**
 * Convierte lo que devuelve la IA en un borrador para el formulario.
 *
 * Nada se da por bueno sin pruebas: todo lo que la IA no ha oído o leído de
 * forma explícita, las cantidades que faltan y las unidades raras quedan
 * marcadas como «pendientes de confirmar», y el formulario no deja guardar
 * hasta que alguien las revisa.
 */
import { unitFromWord } from './dictation';
import {
  createEmptyDraft,
  LIMITS,
  newIngredientRow,
  newStepRow,
  type IngredientDraft,
  type PhotoRef,
  type RecipeDraft,
  type StepDraft,
} from './draft';
import type { ImportedIngredient, ImportedRecipe, ImportedStep } from './importTypes';
import { parseQuantity, quantityToInput } from './quantities';
import { normalizeText } from './search';
import { getUnit } from './units';

export interface ImportPhotos {
  cover: PhotoRef | null;
  /** Foto elegida para cada paso (mismo orden que `recipe.steps`). */
  steps: (PhotoRef | null)[];
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

function cleanNumber(value: number | null, min: number, max: number): string {
  if (value === null || !Number.isFinite(value)) return '';
  const n = Math.round(value);
  return n < min || n > max ? '' : String(n);
}

export function importedIngredientToRow(item: ImportedIngredient): IngredientDraft {
  const row = newIngredientRow();
  const reasons: string[] = [];
  let name = item.name.trim();

  const rawUnit = (item.unit ?? '').trim();
  const normalizedUnit = normalizeText(rawUnit);
  let unit = '';
  if (/^(al|a) gusto$/.test(normalizedUnit)) unit = 'al-gusto';
  else if (rawUnit) {
    unit = unitFromWord(rawUnit);
    if (!unit) {
      // Unidad sin equivalencia: se conserva en el nombre para no perderla.
      name = `${name} (${rawUnit})`;
      reasons.push(`la unidad «${rawUnit}» no está en la lista`);
    }
  }

  const noQuantity = getUnit(unit).noQuantity === true;
  const rawQuantity = (item.quantity ?? '').trim();
  if (!noQuantity) {
    const parsed = parseQuantity(rawQuantity);
    if (rawQuantity && parsed.ok && parsed.value !== null) {
      row.quantity = quantityToInput(parsed.value);
    } else {
      reasons.push(rawQuantity ? `no se entiende la cantidad «${rawQuantity}»` : 'no se dice la cantidad');
    }
  }

  if (!item.certain) {
    reasons.unshift(item.source === 'imagen' ? 'solo se ha visto en la imagen' : 'no se dice con claridad');
  }

  row.unit = unit;
  row.name = clip(name, LIMITS.ingredientName);
  if (reasons.length) row.pending = capitalize(reasons.join('; '));
  return row;
}

export function importedStepToRow(step: ImportedStep, photo: PhotoRef | null): StepDraft {
  const row = newStepRow();
  row.text = clip(step.text.trim(), LIMITS.stepText);
  row.photo = photo;
  if (!step.certain) row.pending = 'Deducido de lo que se ve en el vídeo';
  return row;
}

export function importedToDraft(
  recipe: ImportedRecipe,
  photos: ImportPhotos,
  options: { url?: string | null; categoryId?: string } = {},
): RecipeDraft {
  const draft = createEmptyDraft(options.categoryId);
  draft.title = recipe.title ? clip(recipe.title.trim(), LIMITS.title) : '';
  draft.source = { kind: 'video', url: options.url ?? null };

  const ingredients = recipe.ingredients.filter((i) => i.name.trim()).map(importedIngredientToRow);
  const steps = recipe.steps
    .filter((s) => s.text.trim())
    .map((s) => importedStepToRow(s, photos.steps[recipe.steps.indexOf(s)] ?? null));
  draft.ingredients = ingredients.length ? ingredients : [newIngredientRow()];
  draft.steps = steps.length ? steps : [newStepRow()];

  const hasStepPhotos = steps.some((s) => s.photo);
  draft.photoMode = hasStepPhotos ? 'process' : 'final';
  draft.coverPhoto = photos.cover;

  draft.servings = cleanNumber(recipe.servings, 1, LIMITS.servings);
  draft.prepMinutes = cleanNumber(recipe.prepMinutes, 0, LIMITS.minutes);
  draft.cookMinutes = cleanNumber(recipe.cookMinutes, 0, LIMITS.minutes);
  draft.notes = recipe.notes ? clip(recipe.notes.trim(), LIMITS.notes) : '';
  draft.toTry = true;

  // Lo que no se ha podido determinar se dice, no se rellena.
  const warnings = [...new Set(recipe.warnings.map((w) => w.trim()).filter(Boolean))];
  // Lo que la IA ya ha avisado no se repite con otras palabras.
  const said = (pattern: RegExp) => warnings.some((w) => pattern.test(normalizeText(w)));
  const unknown: string[] = [];
  if (!draft.title && !said(/nombre|titulo/)) unknown.push('el nombre');
  if (!draft.servings && !said(/racion|comensal|personas/)) unknown.push('los comensales');
  if (!draft.prepMinutes && !draft.cookMinutes && !said(/tiempo|minutos|dura/)) unknown.push('los tiempos');
  if (!ingredients.length) unknown.push('los ingredientes');
  if (!steps.length) unknown.push('los pasos');
  if (unknown.length) warnings.push(`No se ha podido saber ${joinList(unknown)}.`);
  draft.importWarnings = warnings;
  return draft;
}

/** Cuántos datos quedan por confirmar en un borrador. */
export function countPending(draft: RecipeDraft): number {
  return (
    draft.ingredients.filter((i) => i.pending).length +
    draft.steps.filter((s) => s.pending).length +
    (draft.pendingFields?.length ?? 0)
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function joinList(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ni ${items[items.length - 1]}`;
}
