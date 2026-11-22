import { describe, expect, it } from 'vitest';
import { buildBook } from './buildBook';
import type { RecipeBlock } from './types';

const parts = (n: number): RecipeBlock[][] => Array.from({ length: n }, () => [{ type: 'header' }]);

describe('buildBook (libro abierto, dos páginas)', () => {
  const layout = buildBook({
    mode: 'spread',
    sections: [
      { categoryId: 'desayunos', recipeIds: ['tortitas', 'gofres'] },
      { categoryId: 'postres', recipeIds: ['flan'] },
    ],
    recipePages: { tortitas: parts(1), gofres: parts(2), flan: parts(3) },
    indexPages: [[]],
  });
  const kinds = layout.pages.map((p) => p.kind);

  it('empieza con la guarda y la portadilla, y el índice en página izquierda', () => {
    expect(kinds.slice(0, 3)).toEqual(['endpaper-front', 'title', 'index']);
  });

  it('cada separador de sección va en página derecha', () => {
    for (const index of Object.values(layout.sectionStart)) expect(index % 2).toBe(1);
  });

  it('las recetas de 2 o más páginas empiezan en página izquierda', () => {
    expect(layout.recipeStart.gofres % 2).toBe(0);
    expect(layout.recipeStart.flan % 2).toBe(0);
  });

  it('el número de páginas es par y termina con la página de «nueva receta»', () => {
    expect(layout.pages.length % 2).toBe(0);
    expect(kinds).toContain('new-recipe');
  });

  it('numera todas las páginas menos las guardas', () => {
    expect(layout.pages[0].number).toBeNull();
    expect(layout.pages[1].number).toBe(1);
    const numbers = layout.pages.map((p) => p.number).filter((n): n is number => n !== null);
    expect(numbers).toEqual(numbers.map((_, i) => i + 1));
  });

  it('las claves de página son únicas (sirven para volver al mismo sitio)', () => {
    const keys = layout.pages.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('buildBook (una página, móvil)', () => {
  it('no añade guardas ni páginas de relleno', () => {
    const layout = buildBook({
      mode: 'single',
      sections: [{ categoryId: 'cenas', recipeIds: ['sopa'] }],
      recipePages: { sopa: parts(2) },
      indexPages: [[]],
    });
    expect(layout.pages.map((p) => p.kind)).toEqual(['title', 'index', 'section', 'recipe', 'recipe', 'new-recipe']);
  });
});
