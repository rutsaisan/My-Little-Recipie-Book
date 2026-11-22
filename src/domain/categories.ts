/**
 * Secciones del recetario.
 *
 * Hay ocho secciones fijas (en el orden del libro) y la persona puede crear
 * las suyas. Todo el código trabaja con `CategoryId` (texto) para que las
 * secciones propias funcionen igual que las fijas.
 */
import { createId } from './ids';

export type CategoryId = string;

export interface Category {
  id: CategoryId;
  /** Nombre completo, para títulos e índice. */
  name: string;
  /** Nombre corto para las pestañas separadoras. */
  shortName: string;
}

/** Colores de la paleta corporativa que puede llevar una pestaña. */
export const PALETTE_COLORS = [
  { id: 'choco', label: 'Chocolate', dark: true },
  { id: 'cacao', label: 'Cacao', dark: true },
  { id: 'tostado', label: 'Tostado', dark: true },
  { id: 'avellana', label: 'Avellana', dark: true },
  { id: 'caramelo', label: 'Caramelo', dark: true },
  { id: 'topo', label: 'Topo', dark: true },
  { id: 'beige-tostado', label: 'Beige tostado', dark: false },
  { id: 'beige-rosado', label: 'Beige rosado', dark: false },
] as const;

export type PaletteColorId = (typeof PALETTE_COLORS)[number]['id'];

/** Sección creada por la persona. */
export interface CustomCategory extends Category {
  /** Ilustración del separador (id del catálogo de personajes). */
  character: string;
  color: PaletteColorId;
  /** Frase del separador (opcional). */
  phrase: string;
  createdAt: number;
}

export const DEFAULT_CATEGORY_ID: CategoryId = 'otras';

export const CATEGORIES: readonly Category[] = [
  { id: 'desayunos', name: 'Desayunos', shortName: 'Desayunos' },
  { id: 'comidas', name: 'Comidas', shortName: 'Comidas' },
  { id: 'cenas', name: 'Cenas', shortName: 'Cenas' },
  { id: 'aperitivos', name: 'Aperitivos', shortName: 'Aperitivos' },
  { id: 'postres', name: 'Postres', shortName: 'Postres' },
  { id: 'panaderia', name: 'Panadería y repostería', shortName: 'Panadería' },
  { id: 'bebidas', name: 'Bebidas', shortName: 'Bebidas' },
  { id: 'otras', name: 'Otras recetas', shortName: 'Otras' },
];

export const CATEGORY_NAME_MAX = 32;

const defaults = new Map(CATEGORIES.map((c) => [c.id, c]));

export function isDefaultCategory(id: CategoryId): boolean {
  return defaults.has(id);
}

/** Ids admitidos: letras, números y guiones (incluye los de secciones propias). */
export function isValidCategoryId(id: unknown): id is CategoryId {
  return typeof id === 'string' && /^[a-z0-9-]{1,80}$/i.test(id);
}

export function createCustomCategoryId(): CategoryId {
  return `c-${createId()}`;
}

/** Nombre para la pestaña: el nombre si es corto; si no, su primera palabra. */
export function shortNameFor(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (clean.length <= 12) return clean;
  const first = clean.split(' ')[0];
  return first.length <= 12 ? first : `${clean.slice(0, 11)}…`;
}

export function isPaletteColor(id: unknown): id is PaletteColorId {
  return PALETTE_COLORS.some((c) => c.id === id);
}

/** Lectura defensiva de una sección propia guardada. */
export function normalizeCustomCategory(raw: unknown): CustomCategory | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isValidCategoryId(r.id) || isDefaultCategory(r.id)) return null;
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, CATEGORY_NAME_MAX) : null;
  if (!name) return null;
  return {
    id: r.id,
    name,
    shortName: shortNameFor(name),
    character: typeof r.character === 'string' ? r.character : 'patito-naranja',
    color: isPaletteColor(r.color) ? r.color : 'caramelo',
    phrase: typeof r.phrase === 'string' ? r.phrase.slice(0, 60) : '',
    createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
  };
}

/** Orden del libro: las secciones fijas y después las propias, por antigüedad. */
export function orderedCategories(custom: CustomCategory[]): Category[] {
  return [...CATEGORIES, ...[...custom].sort((a, b) => a.createdAt - b.createdAt)];
}
