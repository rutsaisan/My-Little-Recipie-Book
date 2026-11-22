import { describe, expect, it } from 'vitest';
import { buildDictatedDraft, parseDictatedIngredient, splitIngredientUtterance, splitStepUtterance } from './dictation';
import { answerQuestion } from './kitchenHelp';
import { firstNumber } from './spanishNumbers';
import { formatClock, parseCommand, parseDuration, suggestTimer } from './voiceCommands';

const ing = (text: string) => {
  const { quantity, unit, name } = parseDictatedIngredient(text);
  return { quantity, unit, name };
};

describe('números dichos', () => {
  it('entiende palabras y cifras', () => {
    expect(firstNumber('doscientos cincuenta gramos')).toBe(250);
    expect(firstNumber('treinta y cinco minutos')).toBe(35);
    expect(firstNumber('dos y medio')).toBe(2.5);
    expect(firstNumber('medio litro')).toBe(0.5);
    expect(firstNumber('mil doscientos')).toBe(1200);
    expect(firstNumber('hornea 40 minutos')).toBe(40);
  });
});

describe('dictado de ingredientes', () => {
  it('separa cantidad, unidad y nombre', () => {
    expect(ing('doscientos gramos de harina de trigo')).toEqual({ quantity: '200', unit: 'g', name: 'harina de trigo' });
    expect(ing('dos huevos')).toEqual({ quantity: '2', unit: '', name: 'huevos' });
    expect(ing('medio litro de leche')).toEqual({ quantity: '0,5', unit: 'l', name: 'leche' });
    expect(ing('una pizca de sal')).toEqual({ quantity: '1', unit: 'pizca', name: 'sal' });
    expect(ing('pimienta al gusto')).toEqual({ quantity: '', unit: 'al-gusto', name: 'pimienta' });
    expect(ing('una cucharada y media de azúcar')).toEqual({ quantity: '1,5', unit: 'cda', name: 'azúcar' });
  });

  it('no inventa: lo que no entiende queda como nombre para revisar', () => {
    expect(ing('un poquito de perejil fresco')).toEqual({ quantity: '1', unit: '', name: 'poquito de perejil fresco' });
  });

  it('separa varios ingredientes dichos seguidos sin romper «sal y pimienta»', () => {
    expect(splitIngredientUtterance('2 huevos, 100 gramos de azúcar y una pizca de sal')).toEqual([
      '2 huevos',
      '100 gramos de azúcar',
      'una pizca de sal',
    ]);
    expect(splitIngredientUtterance('sal y pimienta')).toEqual(['sal y pimienta']);
  });

  it('separa y ordena los pasos', () => {
    expect(splitStepUtterance('bate los huevos siguiente paso añade la harina')).toEqual([
      'Bate los huevos.',
      'Añade la harina.',
    ]);
  });

  it('monta un borrador listo para revisar', () => {
    const draft = buildDictatedDraft({ title: 'tortilla de patatas', ingredients: ['cuatro huevos'], steps: ['pela las patatas'] });
    expect(draft.title).toBe('Tortilla de patatas');
    expect(draft.ingredients[0]).toMatchObject({ quantity: '4', name: 'huevos' });
    expect(draft.steps[0].text).toBe('Pela las patatas.');
  });
});

describe('órdenes de voz', () => {
  it('entiende las órdenes al cocinar', () => {
    expect(parseCommand('siguiente').type).toBe('next');
    expect(parseCommand('vuelve atrás').type).toBe('previous');
    expect(parseCommand('¿me lo repites?').type).toBe('repeat');
    expect(parseCommand('repite').type).toBe('repeat');
    expect(parseCommand('lee los ingredientes').type).toBe('ingredients');
    expect(parseCommand('pon un temporizador de diez minutos')).toEqual({ type: 'timer', seconds: 600 });
    expect(parseCommand('cancela el temporizador').type).toBe('cancelTimer');
    expect(parseCommand('¿cuánto queda?').type).toBe('timeLeft');
    expect(parseCommand('ya he terminado').type).toBe('finish');
  });

  it('lee duraciones', () => {
    expect(parseDuration('una hora y media')).toBe(5400);
    expect(parseDuration('30 segundos')).toBe(30);
  });

  it('propone el tiempo que aparece en un paso', () => {
    expect(suggestTimer('Hornea 35-40 minutos a 180 °C')).toBe(2100);
    expect(suggestTimer('Deja reposar una hora')).toBe(3600);
    expect(suggestTimer('Bate los huevos')).toBeNull();
    expect(formatClock(95)).toBe('1:35');
  });
});

describe('dudas de cocina', () => {
  it('responde lo que sabe y reconoce lo que no', () => {
    expect(answerQuestion('¿Cómo sustituyo el huevo?').known).toBe(true);
    expect(answerQuestion('¿Cuántos gramos son una taza de harina?').answer).toMatch(/120/);
    expect(answerQuestion('¿Quién ganó el mundial?').known).toBe(false);
  });
});
