import { describe, expect, it } from 'vitest';
import { formatFraction, parseQuantity, quantityToInput, roundKitchen } from './quantities';

describe('parseQuantity', () => {
  it('acepta enteros, decimales con coma o punto y fracciones', () => {
    expect(parseQuantity('200')).toEqual({ ok: true, value: 200 });
    expect(parseQuantity('1,5')).toEqual({ ok: true, value: 1.5 });
    expect(parseQuantity('0.25')).toEqual({ ok: true, value: 0.25 });
    expect(parseQuantity('1/2')).toEqual({ ok: true, value: 0.5 });
    expect(parseQuantity('1 1/2')).toEqual({ ok: true, value: 1.5 });
    expect(parseQuantity('½')).toEqual({ ok: true, value: 0.5 });
    expect(parseQuantity('2½')).toEqual({ ok: true, value: 2.5 });
  });

  it('vacío significa «sin cantidad»', () => {
    expect(parseQuantity('   ')).toEqual({ ok: true, value: null });
  });

  it('rechaza textos que no son una cantidad', () => {
    for (const bad of ['dos', '2-3', '1 2', '0', '-1', '1/0', '200 g']) {
      expect(parseQuantity(bad).ok, bad).toBe(false);
    }
  });
});

describe('formatFraction', () => {
  it('usa los glifos de fracción habituales en cocina', () => {
    expect(formatFraction(0.5)).toBe('½');
    expect(formatFraction(1.5)).toBe('1½');
    expect(formatFraction(0.33)).toBe('⅓');
    expect(formatFraction(2.75)).toBe('2¾');
    expect(formatFraction(3)).toBe('3');
  });

  it('si no se parece a una fracción, usa decimales con coma', () => {
    expect(formatFraction(1.15)).toBe('1,15');
  });
});

describe('roundKitchen', () => {
  it('redondea como se mide en la cocina', () => {
    expect(roundKitchen(333.3)).toBe(335);
    expect(roundKitchen(62.4)).toBe(62);
    expect(roundKitchen(7.46)).toBe(7.5);
  });
});

describe('quantityToInput', () => {
  it('devuelve un texto editable en español', () => {
    expect(quantityToInput(1.5)).toBe('1,5');
    expect(quantityToInput(null)).toBe('');
  });
});
