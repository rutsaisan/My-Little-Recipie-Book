import { describe, expect, it } from 'vitest';
import type { ImportedRecipe } from '../src/domain/importTypes.ts';
import { sanitizeRecipe } from './analyze.ts';
import { nameAppears, quantityFromText, verifyAgainstSources } from './verify.ts';

const recipe = (ingredients: ImportedRecipe['ingredients']): ImportedRecipe => ({
  title: null, servings: null, prepMinutes: null, cookMinutes: null, ingredients, steps: [], notes: null, coverFrame: null, warnings: [],
});

describe('quantityFromText', () => {
  it('lee cantidades dichas con palabras justo antes del ingrediente', () => {
    expect(quantityFromText('huevos', 'echamos dos huevos y leche')).toEqual({ quantity: '2', unit: null });
    expect(quantityFromText('harina', 'añade ciento cincuenta gramos de harina')).toEqual({ quantity: '150', unit: 'gramos' });
    expect(quantityFromText('sal', 'y una pizca de sal')).toEqual({ quantity: '1', unit: 'pizca' });
    expect(quantityFromText('leche', '250 ml de leche')).toEqual({ quantity: '250', unit: 'ml' });
  });

  it('no devuelve nada si no se dice', () => {
    expect(quantityFromText('mantequilla', 'un poco de mantequilla')).toBeNull();
    expect(quantityFromText('azúcar', 'añade la leche')).toBeNull();
  });
});

describe('verifyAgainstSources', () => {
  it('borra una cantidad que no aparece en ninguna fuente', () => {
    const out = verifyAgainstSources(recipe([{ name: 'leche', quantity: '300', unit: 'ml', certain: true, source: 'audio' }]), {
      spoken: 'echa leche hasta que se cubra', seen: '',
    });
    expect(out.ingredients[0].quantity).toBeNull();
    expect(out.ingredients[0].certain).toBe(false);
    expect(out.warnings.join(' ')).toMatch(/leche/);
  });

  it('mantiene la cantidad dicha y marca lo que no se nombra', () => {
    const out = verifyAgainstSources(
      recipe([
        { name: 'harina', quantity: '200', unit: 'gramos', certain: true, source: 'audio' },
        { name: 'vainilla', quantity: null, unit: null, certain: true, source: 'audio' },
      ]),
      { spoken: 'doscientos gramos de harina', seen: '' },
    );
    expect(out.ingredients[0]).toMatchObject({ quantity: '200', certain: true });
    expect(out.ingredients[1].certain).toBe(false);
  });

  it('lo que solo se ve en la imagen no es seguro', () => {
    const out = verifyAgainstSources(recipe([{ name: 'fresas', quantity: null, unit: null, certain: true, source: 'audio' }]), {
      spoken: 'decoramos al gusto', seen: 'Se ven fresas cortadas encima.',
    });
    expect(out.ingredients[0]).toMatchObject({ certain: false, source: 'imagen' });
  });

  it('reconoce plurales', () => {
    expect(nameAppears('tomate', 'dos tomates maduros')).toBe(true);
  });
});

describe('sanitizeRecipe', () => {
  it('descarta tipos incorrectos y fotogramas fuera de rango', () => {
    const out = sanitizeRecipe(
      { title: '  ', servings: 'cuatro', ingredients: [{ name: 'sal', quantity: 1, certain: true, source: 'imagen' }, { name: '' }], steps: [{ text: 'Mezcla', certain: true, frame: 7 }], coverFrame: 1 },
      2,
    );
    expect(out.title).toBeNull();
    expect(out.servings).toBeNull();
    expect(out.ingredients).toHaveLength(1);
    expect(out.ingredients[0]).toMatchObject({ quantity: '1', certain: false });
    expect(out.steps[0].frame).toBeNull();
    expect(out.coverFrame).toBe(1);
  });
});
