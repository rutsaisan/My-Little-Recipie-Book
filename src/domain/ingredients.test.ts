import { describe, expect, it } from 'vitest';
import { ingredientToText } from './ingredients';

const ing = (quantity: number | null, unit: string, name: string) => ({ quantity, unit, name });

describe('ingredientToText', () => {
  it('lee los ingredientes como en un recetario', () => {
    expect(ingredientToText(ing(200, 'g', 'harina'))).toBe('200 g de harina');
    expect(ingredientToText(ing(2, '', 'huevos'))).toBe('2 huevos');
    expect(ingredientToText(ing(1, 'cda', 'azúcar'))).toBe('1 cucharada de azúcar');
    expect(ingredientToText(ing(1.5, 'taza', 'leche'))).toBe('1½ tazas de leche');
    expect(ingredientToText(ing(null, 'pizca', 'sal'))).toBe('una pizca de sal');
    expect(ingredientToText(ing(null, 'al-gusto', 'pimienta'))).toBe('pimienta al gusto');
    expect(ingredientToText(ing(null, '', 'perejil'))).toBe('perejil');
  });

  it('no duplica el «de» si ya lo escribió la persona', () => {
    expect(ingredientToText(ing(100, 'ml', 'de leche entera'))).toBe('100 ml de leche entera');
  });

  it('recalcula para otro número de comensales', () => {
    // De 4 a 6 comensales: ×1,5
    expect(ingredientToText(ing(200, 'g', 'harina'), 1.5)).toBe('300 g de harina');
    expect(ingredientToText(ing(3, '', 'huevos'), 0.5)).toBe('1½ huevos');
    expect(ingredientToText(ing(1, 'cdta', 'canela'), 0.5)).toBe('½ cucharadita de canela');
  });

  it('pasa a kilos o litros cuando toca y redondea con sentido', () => {
    expect(ingredientToText(ing(750, 'g', 'patatas'), 2)).toBe('1,5 kg de patatas');
    expect(ingredientToText(ing(600, 'ml', 'caldo'), 2)).toBe('1,2 l de caldo');
    expect(ingredientToText(ing(250, 'g', 'mantequilla'), 1 / 3)).toBe('83 g de mantequilla');
    expect(ingredientToText(ing(400, 'g', 'harina'), 5 / 4)).toBe('500 g de harina');
    expect(ingredientToText(ing(330, 'g', 'arroz'), 1.5)).toBe('495 g de arroz');
  });
});
