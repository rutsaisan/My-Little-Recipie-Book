/**
 * Insignias y logros (gamificación suave y opcional).
 *
 * Cada insignia es un animalito de la colección: al conseguirla, su pegatina
 * queda en el álbum y se puede pegar en la portada. Algunas desbloquean además
 * una decoración para el libro (un mantel nuevo).
 *
 * «Completar una receta» = marcarla como cocinada desde su página.
 */
import type { CharacterId } from '../assets/characters';
import { CATEGORIES } from './categories';
import type { CookEntry, Recipe } from './recipe';

export interface BookStats {
  recipes: number;
  recipesWithPhotos: number;
  processRecipes: number;
  sectionsUsed: number;
  customSections: number;
  favorites: number;
  /** Veces que se ha completado (cocinado) una receta, en total. */
  cooked: number;
  maxCooksOneRecipe: number;
  cookedByCategory: Record<string, number>;
}

export interface AchievementDef {
  id: string;
  title: string;
  /** Lo que se consiguió (se muestra al desbloquearla). */
  description: string;
  /** Cómo conseguirla (se muestra mientras está bloqueada). */
  goal: string;
  character: CharacterId;
  kind: 'insignia' | 'pegatina' | 'decoracion';
  /** Recompensa extra, en palabras. */
  reward?: string;
  progress: (stats: BookStats) => { value: number; target: number };
}

export interface UnlockedAchievement {
  id: string;
  unlockedAt: number;
}

export function computeStats(recipes: Recipe[], cooks: CookEntry[], customSections: number): BookStats {
  const cookedByCategory: Record<string, number> = {};
  const byRecipe = new Map<string, number>();
  for (const c of cooks) {
    cookedByCategory[c.categoryId] = (cookedByCategory[c.categoryId] ?? 0) + 1;
    byRecipe.set(c.recipeId, (byRecipe.get(c.recipeId) ?? 0) + 1);
  }
  return {
    recipes: recipes.length,
    recipesWithPhotos: recipes.filter((r) => r.coverPhotoId || r.steps.some((s) => s.photoId)).length,
    processRecipes: recipes.filter((r) => r.photoMode === 'process' && r.steps.some((s) => s.photoId)).length,
    sectionsUsed: new Set(recipes.map((r) => r.categoryId)).size,
    customSections,
    favorites: recipes.filter((r) => r.favorite).length,
    cooked: cooks.length,
    maxCooksOneRecipe: Math.max(0, ...byRecipe.values()),
    cookedByCategory,
  };
}

const count = (target: number, pick: (s: BookStats) => number) => (s: BookStats) => ({
  value: Math.min(pick(s), target),
  target,
});

/** Primera receta completada en cada sección fija. */
const SECTION_BADGES: { category: string; id: string; title: string; character: CharacterId }[] = [
  { category: 'desayunos', id: 'buenos-dias', title: 'Buenos días', character: 'raya-mantequilla' },
  { category: 'comidas', id: 'cuchara-de-madera', title: 'Cuchara de madera', character: 'raya-sarten' },
  { category: 'cenas', id: 'noche-tranquila', title: 'Noche tranquila', character: 'raton-pizza' },
  { category: 'aperitivos', id: 'hora-del-picoteo', title: 'Hora del picoteo', character: 'perrito-hotdog' },
  { category: 'postres', id: 'diente-dulce', title: 'Diente dulce', character: 'tortuga-smore' },
  { category: 'panaderia', id: 'pasteleria', title: 'Insignia de pastelería', character: 'gato-siames-bizcocho' },
  { category: 'bebidas', id: 'barista', title: 'Barista de casa', character: 'raya-cafetera' },
  { category: 'otras', id: 'cajon-de-sorpresas', title: 'Cajón de sorpresas', character: 'raya-chocolate-frutos' },
];

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // ── Escribir el libro ──
  {
    id: 'primera-pagina',
    title: 'Primera página',
    description: 'Escribiste tu primera receta en el libro.',
    goal: 'Escribe tu primera receta.',
    character: 'raton-chef',
    kind: 'insignia',
    progress: count(1, (s) => s.recipes),
  },
  {
    id: 'cuaderno-con-vida',
    title: 'Cuaderno con vida',
    description: 'Ya hay cinco recetas en tu libro.',
    goal: 'Escribe cinco recetas.',
    character: 'nutria-croissant',
    kind: 'insignia',
    progress: count(5, (s) => s.recipes),
  },
  {
    id: 'libro-gordito',
    title: 'Libro gordito',
    description: 'Quince recetas: el cuaderno ya pesa.',
    goal: 'Escribe quince recetas.',
    character: 'serpiente-canela',
    kind: 'decoracion',
    reward: 'Nuevo mantel: lino',
    progress: count(15, (s) => s.recipes),
  },
  {
    id: 'buen-ojo',
    title: 'Buen ojo',
    description: 'Tres recetas con sus fotos.',
    goal: 'Pon fotos en tres recetas.',
    character: 'raya-plancha',
    kind: 'insignia',
    progress: count(3, (s) => s.recipesWithPhotos),
  },
  {
    id: 'paso-a-paso',
    title: 'Paso a paso',
    description: 'Contaste una receta con fotos del proceso.',
    goal: 'Escribe una receta con fotos del proceso.',
    character: 'raya-platano',
    kind: 'insignia',
    progress: count(1, (s) => s.processRecipes),
  },
  {
    id: 'libro-ordenado',
    title: 'Libro ordenado',
    description: 'Tienes recetas en cuatro secciones distintas.',
    goal: 'Ten recetas en cuatro secciones.',
    character: 'patito-naranja',
    kind: 'insignia',
    progress: count(4, (s) => s.sectionsUsed),
  },
  {
    id: 'toque-personal',
    title: 'Toque personal',
    description: 'Creaste una sección propia.',
    goal: 'Crea una sección propia.',
    character: 'raya-mini-mantequilla',
    kind: 'pegatina',
    reward: 'Pegatina para la portada',
    progress: count(1, (s) => s.customSections),
  },
  {
    id: 'corazon-goloso',
    title: 'Corazón goloso',
    description: 'Tres recetas favoritas.',
    goal: 'Marca tres recetas con el corazón.',
    character: 'raya-corazon',
    kind: 'insignia',
    progress: count(3, (s) => s.favorites),
  },
  // ── Cocinar (recetas completadas) ──
  {
    id: 'primer-plato',
    title: '¡Primera receta completada!',
    description: 'Cocinaste tu primera receta del libro.',
    goal: 'Marca una receta como cocinada.',
    character: 'gato-calico-chef',
    kind: 'insignia',
    progress: count(1, (s) => s.cooked),
  },
  {
    id: 'cinco-platos',
    title: 'Cinco recetas completadas',
    description: 'Cinco veces a los fogones.',
    goal: 'Completa cinco recetas.',
    character: 'raya-mini-chocolate',
    kind: 'pegatina',
    reward: 'Nueva pegatina para la portada',
    progress: count(5, (s) => s.cooked),
  },
  {
    id: 'diez-platos',
    title: 'Diez recetas completadas',
    description: 'Diez platos salidos de tu libro.',
    goal: 'Completa diez recetas.',
    character: 'raya-tortita',
    kind: 'decoracion',
    reward: 'Nuevo mantel: vichy claro',
    progress: count(10, (s) => s.cooked),
  },
  {
    id: 'la-de-siempre',
    title: 'La de siempre',
    description: 'Cocinaste la misma receta tres veces.',
    goal: 'Cocina una misma receta tres veces.',
    character: 'raya-nata-fresa',
    kind: 'insignia',
    progress: count(3, (s) => s.maxCooksOneRecipe),
  },
  ...SECTION_BADGES.map<AchievementDef>((b) => {
    const name = CATEGORIES.find((c) => c.id === b.category)!.name;
    return {
      id: b.id,
      title: b.title,
      description: `Completaste tu primera receta de ${name.toLowerCase()}.`,
      goal: `Cocina una receta de ${name.toLowerCase()}.`,
      character: b.character,
      kind: 'insignia',
      progress: count(1, (s) => s.cookedByCategory[b.category] ?? 0),
    };
  }),
  {
    id: 'chef-de-casa',
    title: 'Chef de la casa',
    description: 'Cocinaste recetas de todas las secciones.',
    goal: 'Cocina una receta de cada sección fija.',
    character: 'gorro-chef',
    kind: 'decoracion',
    reward: 'Nuevo mantel: mesa de madera',
    progress: count(SECTION_BADGES.length, (s) => SECTION_BADGES.filter((b) => (s.cookedByCategory[b.category] ?? 0) > 0).length),
  },
];

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function isMet(def: AchievementDef, stats: BookStats): boolean {
  const { value, target } = def.progress(stats);
  return value >= target;
}

/** Insignias que se cumplen ahora y aún no estaban conseguidas. */
export function newlyUnlocked(stats: BookStats, unlocked: ReadonlySet<string>): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && isMet(a, stats));
}
