/**
 * Contratos de la capa de datos.
 *
 * La interfaz no sabe dónde se guardan las cosas. Hoy la implementación es
 * IndexedDB (en el propio navegador); cuando haya backend con base de datos y
 * cuentas de usuario bastará con escribir otra implementación de estas mismas
 * interfaces (p. ej. `api/`) y elegirla en `data/index.ts`.
 */
import type { UnlockedAchievement } from '../domain/achievements';
import type { CategoryId, CustomCategory } from '../domain/categories';
import type { RibbonColorId, TableclothId } from '../domain/decorations';
import type { CookEntry, PhotoId, Recipe, RecipeId } from '../domain/recipe';

export interface PhotoInput {
  id: PhotoId;
  blob: Blob;
  width: number;
  height: number;
}

export interface StoredPhoto extends PhotoInput {
  createdAt: number;
}

export interface PhotoChanges {
  /** Fotos nuevas que hay que guardar. */
  add: PhotoInput[];
  /** Fotos que la receta ya no usa y se pueden borrar. */
  remove: PhotoId[];
}

export interface RecipeRepository {
  list(): Promise<Recipe[]>;
  get(id: RecipeId): Promise<Recipe | undefined>;
  /** Guarda la receta y sus cambios de fotos en una sola operación atómica. */
  save(recipe: Recipe, photos: PhotoChanges): Promise<void>;
  /** Actualiza datos de la receta que no tocan las fotos (favorita, etc.). */
  update(recipe: Recipe): Promise<void>;
  /** Borra la receta y todas sus fotos. */
  remove(id: RecipeId): Promise<void>;
  /** Historial de recetas cocinadas. */
  listCooks(): Promise<CookEntry[]>;
  /** Apunta que se cocinó (receta actualizada + entrada del historial, a la vez). */
  recordCook(recipe: Recipe, entry: CookEntry): Promise<void>;
  /** Deshace un «cocinada» recién apuntado. */
  undoCook(recipe: Recipe, entryId: string): Promise<void>;
}

export interface PhotoRepository {
  get(id: PhotoId): Promise<StoredPhoto | undefined>;
}

export interface CategoryRepository {
  list(): Promise<CustomCategory[]>;
  save(category: CustomCategory): Promise<void>;
  /** Borra la sección y pasa sus recetas a `moveTo`, en una sola operación. */
  remove(id: CategoryId, moveTo: CategoryId): Promise<void>;
}

export interface AchievementRepository {
  list(): Promise<UnlockedAchievement[]>;
  unlock(entries: UnlockedAchievement[]): Promise<void>;
}

/** Preferencias y estado del libro que deben sobrevivir al cerrar la app. */
export interface Settings {
  /** Clave de la página marcada con el marcapáginas. */
  bookmark: string | null;
  /** Fecha en que se empezó el recetario (se muestra en la portadilla). */
  bookStartedAt: number;
  /** «Este recetario pertenece a…». */
  ownerName: string;
  /** Frase de la etiqueta de la portada. */
  dedication: string;
  /** Pegatinas de la portada (ids de personaje o vacío), una por hueco. */
  coverStickers: (string | null)[];
  tablecloth: TableclothId;
  ribbonColor: RibbonColorId;
  music: { enabled: boolean; volume: number };
  /** Mostrar las celebraciones al conseguir una insignia. */
  celebrations: boolean;
  /** Recetas vistas hace poco (de la más reciente a la más antigua). */
  recentRecipes: RecipeId[];
  /** El asistente lee en voz alta lo que dice. */
  assistantVoice: boolean;
  /** Temporizadores en marcha (sobreviven a recargar la página). */
  timers: { id: string; label: string; endsAt: number; seconds: number }[];
}

export interface SettingsRepository {
  getAll(): Promise<Partial<Settings>>;
  get<K extends keyof Settings>(key: K): Promise<Settings[K] | undefined>;
  set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
}

export interface DataSource {
  recipes: RecipeRepository;
  photos: PhotoRepository;
  categories: CategoryRepository;
  achievements: AchievementRepository;
  settings: SettingsRepository;
}
