import { ingredientToText } from '../../domain/ingredients';
import type { Recipe } from '../../domain/recipe';

/** Texto para leer en voz alta una receta completa. */
export function recipeToSpeech(recipe: Recipe): string {
  const parts = [recipe.title + '.'];
  if (recipe.ingredients.length) {
    parts.push('Ingredientes: ' + recipe.ingredients.map((i) => ingredientToText(i)).join('; ') + '.');
  }
  recipe.steps.forEach((s, i) => parts.push(`Paso ${i + 1}: ${s.text}`));
  if (recipe.notes) parts.push(`Notas: ${recipe.notes}`);
  return parts.join(' ');
}

export function ingredientsToSpeech(recipe: Recipe): string {
  if (!recipe.ingredients.length) return 'Esta receta no tiene ingredientes anotados.';
  return 'Necesitas: ' + recipe.ingredients.map((i) => ingredientToText(i)).join('; ') + '.';
}
