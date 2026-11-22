/**
 * Aspecto de cada sección: su animalito, el color de la pestaña separadora
 * (uno de los ocho tonos de la paleta) y una frase para el separador.
 */
import { CHARACTERS, type CharacterId } from '../../assets/characters';
import {
  CATEGORIES,
  DEFAULT_CATEGORY_ID,
  PALETTE_COLORS,
  type CategoryId,
  type CustomCategory,
  type PaletteColorId,
} from '../../domain/categories';

/** Toda la información de una sección lista para pintarla. */
export interface CategoryInfo {
  id: CategoryId;
  name: string;
  shortName: string;
  character: CharacterId;
  /** Color de la pestaña (variable CSS). */
  color: string;
  /** Color del texto sobre la pestaña. */
  ink: string;
  phrase: string;
  custom: boolean;
}

const LIGHT_INK = 'var(--cream)';
const DARK_INK = 'var(--choco)';

const DEFAULT_ART: Record<string, { character: CharacterId; color: PaletteColorId; phrase: string }> = {
  desayunos: { character: 'raya-pila-tortitas', color: 'beige-rosado', phrase: 'Para empezar el día con calma' },
  comidas: { character: 'gato-calico-chef', color: 'caramelo', phrase: 'Guisos, cucharas y sobremesas largas' },
  cenas: { character: 'raton-pizza', color: 'cacao', phrase: 'Para las noches tranquilas' },
  aperitivos: { character: 'perrito-hotdog', color: 'beige-tostado', phrase: 'Pequeños bocados para picar' },
  postres: { character: 'tortuga-smore', color: 'avellana', phrase: 'Un capricho dulce siempre cabe' },
  panaderia: { character: 'gato-siames-bizcocho', color: 'topo', phrase: 'Masas, horno y olor a bizcocho' },
  bebidas: { character: 'raya-cafetera', color: 'tostado', phrase: 'Cafés, batidos y tazas calentitas' },
  otras: { character: 'patito-naranja', color: 'choco', phrase: 'Todo lo que no cabe en otro sitio' },
};

export function paletteVar(id: PaletteColorId): string {
  return `var(--${id})`;
}

function inkFor(id: PaletteColorId): string {
  return PALETTE_COLORS.find((c) => c.id === id)?.dark === false ? DARK_INK : LIGHT_INK;
}

function isCharacter(id: string): id is CharacterId {
  return id in CHARACTERS;
}

export const DEFAULT_CATEGORY_INFOS: CategoryInfo[] = CATEGORIES.map((c) => {
  const art = DEFAULT_ART[c.id];
  return {
    ...c,
    character: art.character,
    color: paletteVar(art.color),
    ink: inkFor(art.color),
    phrase: art.phrase,
    custom: false,
  };
});

export function customCategoryInfo(c: CustomCategory): CategoryInfo {
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    character: isCharacter(c.character) ? c.character : 'patito-naranja',
    color: paletteVar(c.color),
    ink: inkFor(c.color),
    phrase: c.phrase || 'Una sección con mi toque',
    custom: true,
  };
}

export const FALLBACK_CATEGORY_INFO: CategoryInfo = DEFAULT_CATEGORY_INFOS.find((c) => c.id === DEFAULT_CATEGORY_ID)!;
