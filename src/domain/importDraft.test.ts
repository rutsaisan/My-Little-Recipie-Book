import { describe, expect, it } from 'vitest';
import { validateDraft } from './draft';
import { countPending, importedIngredientToRow, importedToDraft } from './importDraft';
import type { ImportedRecipe } from './importTypes';

const base: ImportedRecipe = {
  title: 'Bizcocho de yogur',
  servings: 8,
  prepMinutes: 15,
  cookMinutes: 40,
  ingredients: [],
  steps: [],
  notes: null,
  coverFrame: null,
  warnings: [],
};

describe('importedIngredientToRow', () => {
  it('convierte cantidades y unidades claras sin marcarlas', () => {
    const row = importedIngredientToRow({ name: 'harina', quantity: '200', unit: 'gramos', certain: true, source: 'audio' });
    expect(row).toMatchObject({ name: 'harina', quantity: '200', unit: 'g' });
    expect(row.pending).toBeUndefined();
  });

  it('acepta fracciones y medidas caseras', () => {
    const row = importedIngredientToRow({ name: 'azúcar', quantity: '1/2', unit: 'taza', certain: true, source: 'texto' });
    expect(row.unit).toBe('taza');
    expect(row.quantity).not.toBe('');
    expect(row.pending).toBeUndefined();
  });

  it('no inventa la cantidad que falta: la deja vacía y pendiente', () => {
    const row = importedIngredientToRow({ name: 'sal', quantity: null, unit: null, certain: true, source: 'audio' });
    expect(row.quantity).toBe('');
    expect(row.pending).toMatch(/cantidad/);
  });

  it('«al gusto» no necesita cantidad', () => {
    const row = importedIngredientToRow({ name: 'pimienta', quantity: null, unit: 'al gusto', certain: true, source: 'audio' });
    expect(row.unit).toBe('al-gusto');
    expect(row.pending).toBeUndefined();
  });

  it('marca lo que solo se ha visto en la imagen', () => {
    const row = importedIngredientToRow({ name: 'huevos', quantity: '3', unit: null, certain: false, source: 'imagen' });
    expect(row.pending).toMatch(/imagen/);
  });

  it('conserva una unidad desconocida en el nombre y la marca', () => {
    const row = importedIngredientToRow({ name: 'canela', quantity: '1', unit: 'rama', certain: true, source: 'audio' });
    expect(row.name).toBe('canela (rama)');
    expect(row.unit).toBe('');
    expect(row.pending).toMatch(/rama/);
  });
});

describe('importedToDraft', () => {
  it('monta el borrador con fotos por paso y origen de vídeo', () => {
    const photo = { kind: 'new', blob: new Blob(), url: 'blob:x', width: 10, height: 10 } as const;
    const draft = importedToDraft(
      {
        ...base,
        ingredients: [{ name: 'yogur', quantity: '1', unit: null, certain: true, source: 'audio' }],
        steps: [
          { text: 'Mezcla todo.', certain: true, frame: 0 },
          { text: 'Hornea.', certain: false, frame: null },
        ],
      },
      { cover: null, steps: [photo, null] },
      { url: 'https://www.tiktok.com/@a/video/1' },
    );
    expect(draft.photoMode).toBe('process');
    expect(draft.steps[0].photo).toBe(photo);
    expect(draft.steps[1].pending).toBeTruthy();
    expect(draft.source).toEqual({ kind: 'video', url: 'https://www.tiktok.com/@a/video/1' });
    expect(draft.servings).toBe('8');
    expect(countPending(draft)).toBe(1);
  });

  it('avisa de lo que no se ha podido saber en vez de rellenarlo', () => {
    const draft = importedToDraft({ ...base, title: null, servings: null, prepMinutes: null, cookMinutes: null }, { cover: null, steps: [] });
    expect(draft.title).toBe('');
    expect(draft.servings).toBe('');
    expect(draft.importWarnings?.join(' ')).toMatch(/nombre.*comensales.*tiempos/);
  });

  it('no deja guardar mientras haya datos pendientes', () => {
    const draft = importedToDraft(
      { ...base, ingredients: [{ name: 'sal', quantity: null, unit: null, certain: true, source: 'audio' }], steps: [{ text: 'Sala.', certain: true, frame: null }] },
      { cover: null, steps: [] },
    );
    expect(validateDraft(draft).ok).toBe(false);
    draft.ingredients[0].pending = undefined;
    expect(validateDraft(draft).ok).toBe(true);
  });
});
