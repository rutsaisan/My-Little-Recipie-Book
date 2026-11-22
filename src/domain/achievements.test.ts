import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, computeStats, newlyUnlocked } from './achievements';
import { normalizeRecipe, type CookEntry, type Recipe } from './recipe';

const recipe = (id: string, categoryId: string, extra: Record<string, unknown> = {}): Recipe =>
  normalizeRecipe({ id, title: id, categoryId, ingredients: [], steps: [], ...extra })!;

const cook = (recipeId: string, categoryId: string, n: number): CookEntry => ({
  id: `${recipeId}-${n}`,
  recipeId,
  categoryId,
  at: n,
});

describe('insignias', () => {
  it('cada insignia tiene un animalito distinto (colección)', () => {
    const characters = ACHIEVEMENTS.map((a) => a.character);
    expect(new Set(characters).size).toBe(characters.length);
  });

  it('la primera receta escrita da «Primera página»', () => {
    const stats = computeStats([recipe('a', 'postres')], [], 0);
    expect(newlyUnlocked(stats, new Set()).map((a) => a.id)).toEqual(['primera-pagina']);
  });

  it('completar recetas da las insignias de cocina y de sección', () => {
    const cooks = [cook('a', 'panaderia', 1), cook('a', 'panaderia', 2), cook('a', 'panaderia', 3)];
    const stats = computeStats([recipe('a', 'panaderia')], cooks, 0);
    const ids = newlyUnlocked(stats, new Set(['primera-pagina'])).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['primer-plato', 'la-de-siempre', 'pasteleria']));
    expect(ids).not.toContain('cinco-platos');
  });

  it('no repite las ya conseguidas', () => {
    const stats = computeStats([recipe('a', 'postres')], [], 0);
    expect(newlyUnlocked(stats, new Set(['primera-pagina']))).toEqual([]);
  });

  it('cuenta favoritas, fotos y secciones propias', () => {
    const recipes = [1, 2, 3].map((n) => recipe(`r${n}`, 'cenas', { favorite: true, coverPhotoId: `p${n}` }));
    const stats = computeStats(recipes, [], 1);
    const ids = newlyUnlocked(stats, new Set()).map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['corazon-goloso', 'buen-ojo', 'toque-personal']));
  });
});
