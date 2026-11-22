import { describe, expect, it } from 'vitest';
import { fillColumns, paginateIndex, paginateRecipe } from './paginate';
import type { RecipeMeasure } from './types';

const flow = { bodyHeight: 600, blockGap: 10, stepGap: 10 };

function measure(overrides: Partial<RecipeMeasure> = {}): RecipeMeasure {
  return {
    header: 100,
    ingredientsHeading: 30,
    ingredientLinesIntro: [25, 25, 25, 25],
    ingredientsHeadingFull: 30,
    ingredientsHeadingCont: 30,
    ingredientLinesFull: [25, 25, 25, 25],
    aside: 180,
    photoStacked: 0,
    methodHeading: 30,
    methodHeadingCont: 30,
    steps: [60, 60, 60],
    notes: 0,
    ...overrides,
  };
}

describe('paginateRecipe', () => {
  it('una receta corta cabe en una página', () => {
    const pages = paginateRecipe(measure(), flow, 1);
    expect(pages).toHaveLength(1);
    expect(pages[0].map((b) => b.type)).toEqual(['header', 'intro', 'method']);
  });

  it('los pasos no se parten y continúan en la página siguiente', () => {
    // 100 + 10 + 180 = 290 usados; quedan 300: caben encabezado + 3 pasos (30+200)
    const pages = paginateRecipe(measure({ steps: [90, 90, 90, 90, 90] }), flow, 1);
    expect(pages).toHaveLength(2);
    const first = pages[0].find((b) => b.type === 'method');
    const second = pages[1].find((b) => b.type === 'method');
    expect(first?.type === 'method' && first.columns[0]).toEqual([0, 1]);
    expect(second?.type === 'method' && second.continued).toBe(true);
    expect(second?.type === 'method' && second.columns[0]).toEqual([2, 3, 4]);
  });

  it('si no caben todos los ingredientes junto a la foto, siguen a todo el ancho', () => {
    const lines = Array.from({ length: 30 }, () => 25);
    const pages = paginateRecipe(
      measure({ ingredientLinesIntro: lines, ingredientLinesFull: lines, steps: [] }),
      flow,
      1,
    );
    const intro = pages[0].find((b) => b.type === 'intro');
    expect(intro?.type === 'intro' && intro.to).toBe(18); // (600-110-30)/25
    const rest = pages[1].find((b) => b.type === 'ingredients');
    expect(rest).toEqual({ type: 'ingredients', from: 18, to: 30, continued: true });
  });

  it('no deja el encabezado de ingredientes al pie con menos de tres líneas', () => {
    // Tras cabecera (100) y foto (420) quedan ~60 px: solo cabría una línea.
    const pages = paginateRecipe(measure({ photoStacked: 420, steps: [] }), { ...flow, introLayout: 'stacked' }, 1);
    expect(pages[0].map((b) => b.type)).toEqual(['header', 'photo']);
    expect(pages[1][0]).toEqual({ type: 'ingredients', from: 0, to: 4, continued: false });
  });

  it('en páginas estrechas pone la foto encima y los ingredientes a todo el ancho', () => {
    const pages = paginateRecipe(measure({ photoStacked: 200 }), { ...flow, introLayout: 'stacked' }, 1);
    expect(pages[0].map((b) => b.type).slice(0, 3)).toEqual(['header', 'photo', 'ingredients']);
    expect(pages[0][2]).toEqual({ type: 'ingredients', from: 0, to: 4, continued: false });
  });

  it('las notas van al final, en una página nueva si no caben', () => {
    const pages = paginateRecipe(measure({ steps: [120, 120], notes: 200 }), flow, 1);
    expect(pages.at(-1)?.at(-1)).toEqual({ type: 'notes' });
    expect(pages).toHaveLength(2);
  });

  it('en dos columnas reparte los pasos de forma equilibrada', () => {
    const pages = paginateRecipe(measure({ steps: [100, 100, 100, 100] }), flow, 2);
    const method = pages[0].find((b) => b.type === 'method');
    expect(method?.type === 'method' && method.columns).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });
});

describe('fillColumns', () => {
  it('prefiere la columna izquierda más llena cuando hay empate', () => {
    const fill = fillColumns([50, 50, 50], 0, 2, 500, 10);
    expect(fill.columns).toEqual([[0, 1], [2]]);
    expect(fill.next).toBe(3);
  });

  it('rellena columna a columna si no cabe todo', () => {
    const fill = fillColumns([200, 200, 200, 200, 200], 0, 2, 420, 10);
    expect(fill.columns).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(fill.next).toBe(4);
  });
});

describe('paginateIndex', () => {
  it('no deja un encabezado de sección solo al pie de página', () => {
    const entries = [
      { type: 'category' as const, categoryId: 'postres' },
      { type: 'recipe' as const, recipeId: 'a', categoryId: 'postres' },
      { type: 'category' as const, categoryId: 'bebidas' },
      { type: 'recipe' as const, recipeId: 'b', categoryId: 'bebidas' },
    ];
    // título 60 + 3 entradas de 170 = 570; la 4.ª no cabe (600) y la 3.ª es un encabezado
    const pages = paginateIndex(entries, { title: 60, titleCont: 40, entries: [170, 170, 170, 170] }, flow);
    expect(pages[0]).toHaveLength(2);
    expect(pages[1][0]).toEqual({ type: 'category', categoryId: 'bebidas' });
  });
});
