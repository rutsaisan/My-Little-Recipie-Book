import { describe, expect, it } from 'vitest';
import { normalizeRecipe, type Recipe } from './recipe';
import { pushRecent, searchRecipes } from './search';

const r = (id: string, title: string, extra: Record<string, unknown> = {}): Recipe =>
  normalizeRecipe({ id, title, categoryId: 'postres', ingredients: [], steps: [], ...extra })!;

const book = [
  r('a', 'Tarta de limón', { favorite: true }),
  r('b', 'Bizcocho de yogur', { ingredients: [{ id: 'i', name: 'Ralladura de limón', quantity: null, unit: '' }] }),
  r('c', 'Flan de huevo', { toTry: true, categoryId: 'otras' }),
  r('d', 'Natillas', { cookedCount: 2 }),
];

const base = { query: '', view: 'all' as const, categoryId: null, recent: [] };

describe('searchRecipes', () => {
  it('busca sin tildes y prioriza el título frente a los ingredientes', () => {
    expect(searchRecipes(book, { ...base, query: 'limon' }).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('filtra favoritas, por probar, cocinadas y sección', () => {
    expect(searchRecipes(book, { ...base, view: 'favorites' }).map((x) => x.id)).toEqual(['a']);
    expect(searchRecipes(book, { ...base, view: 'toTry' }).map((x) => x.id)).toEqual(['c']);
    expect(searchRecipes(book, { ...base, view: 'cooked' }).map((x) => x.id)).toEqual(['d']);
    expect(searchRecipes(book, { ...base, categoryId: 'otras' }).map((x) => x.id)).toEqual(['c']);
  });

  it('las recientes salen en el orden en que se vieron', () => {
    expect(searchRecipes(book, { ...base, view: 'recent', recent: ['d', 'a'] }).map((x) => x.id)).toEqual(['d', 'a']);
  });
});

describe('pushRecent', () => {
  it('pone delante sin repetir y respeta el límite', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b', 3)).toEqual(['b', 'a', 'c']);
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });
});
