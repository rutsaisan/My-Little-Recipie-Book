import { describe, expect, it } from 'vitest';
import { createEmptyDraft, draftFromRecipe, draftToRecipe, photosToKeep, validateDraft, type RecipeDraft } from './draft';

function filledDraft(): RecipeDraft {
  const draft = createEmptyDraft('postres');
  draft.title = '  Natillas  ';
  draft.photoMode = 'final';
  draft.ingredients = [
    { key: 'a', quantity: '1/2', unit: 'l', name: 'leche' },
    { key: 'b', quantity: '', unit: '', name: '' }, // fila vacía: se ignora
    { key: 'c', quantity: '', unit: 'al-gusto', name: 'canela' },
  ];
  draft.steps = [
    { key: 's1', text: 'Calienta la leche.', photo: null },
    { key: 's2', text: '   ', photo: null },
  ];
  draft.servings = '4';
  return draft;
}

describe('validateDraft', () => {
  it('exige un nombre', () => {
    const v = validateDraft(createEmptyDraft());
    expect(v.ok).toBe(false);
    expect(v.issues.title).toBeTruthy();
    expect(v.firstSection).toBe('photos');
  });

  it('marca ingredientes con cantidad pero sin nombre y cantidades mal escritas', () => {
    const draft = filledDraft();
    draft.ingredients.push({ key: 'd', quantity: '200', unit: 'g', name: '' });
    draft.ingredients.push({ key: 'e', quantity: 'mucho', unit: '', name: 'azúcar' });
    const v = validateDraft(draft);
    expect(v.ok).toBe(false);
    expect(v.issues.ingredients.d?.name).toBeTruthy();
    expect(v.issues.ingredients.e?.quantity).toBeTruthy();
    expect(v.firstSection).toBe('ingredients');
  });

  it('pide texto en un paso que solo tiene foto', () => {
    const draft = filledDraft();
    draft.steps.push({ key: 's3', text: '', photo: { kind: 'stored', id: 'p1' } });
    expect(validateDraft(draft).issues.steps.s3).toBeTruthy();
  });

  it('acepta un borrador correcto', () => {
    expect(validateDraft(filledDraft()).ok).toBe(true);
  });
});

describe('draftToRecipe', () => {
  it('limpia filas vacías, recorta textos y convierte números', () => {
    const recipe = draftToRecipe(filledDraft(), { cover: null, steps: {} }, 1000);
    expect(recipe.title).toBe('Natillas');
    expect(recipe.ingredients).toEqual([
      { id: 'a', name: 'leche', quantity: 0.5, unit: 'l' },
      { id: 'c', name: 'canela', quantity: null, unit: 'al-gusto' },
    ]);
    expect(recipe.steps).toHaveLength(1);
    expect(recipe.servings).toBe(4);
    expect(recipe.createdAt).toBe(1000);
  });

  it('al editar conserva id y fecha de creación', () => {
    const original = draftToRecipe(filledDraft(), { cover: null, steps: {} }, 1000);
    const edited = draftToRecipe(draftFromRecipe(original), { cover: null, steps: {} }, 5000, original);
    expect(edited.id).toBe(original.id);
    expect(edited.createdAt).toBe(1000);
    expect(edited.updatedAt).toBe(5000);
  });
});

describe('photosToKeep', () => {
  it('en modo «foto final» descarta las fotos de los pasos y al revés', () => {
    const draft = filledDraft();
    draft.coverPhoto = { kind: 'stored', id: 'cover' };
    draft.steps[0].photo = { kind: 'stored', id: 'step' };

    const final = photosToKeep(draft);
    expect(final.cover).toEqual({ kind: 'stored', id: 'cover' });
    expect(final.steps.size).toBe(0);

    draft.photoMode = 'process';
    const process = photosToKeep(draft);
    expect(process.cover).toBeNull();
    expect(process.steps.get('s1')).toEqual({ kind: 'stored', id: 'step' });
  });
});
