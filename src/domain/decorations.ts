/**
 * Personalización del libro: manteles, color del marcapáginas y pegatinas de
 * la portada. Algunos manteles son recompensas de insignias especiales.
 */

export const TABLECLOTHS = [
  { id: 'vichy', label: 'Vichy de la cocina', unlockedBy: null },
  { id: 'vichy-claro', label: 'Vichy claro', unlockedBy: 'diez-platos' },
  { id: 'lino', label: 'Mantel de lino', unlockedBy: 'libro-gordito' },
  { id: 'madera', label: 'Mesa de madera', unlockedBy: 'chef-de-casa' },
] as const;

export type TableclothId = (typeof TABLECLOTHS)[number]['id'];

export const RIBBON_COLORS = [
  { id: 'caramelo', label: 'Caramelo' },
  { id: 'cacao', label: 'Cacao' },
  { id: 'avellana', label: 'Avellana' },
  { id: 'beige-rosado', label: 'Beige rosado' },
] as const;

export type RibbonColorId = (typeof RIBBON_COLORS)[number]['id'];

/** Huecos para pegatinas en la portada. */
export const COVER_SLOTS = 4;

export function isTablecloth(id: unknown): id is TableclothId {
  return TABLECLOTHS.some((t) => t.id === id);
}

export function isRibbonColor(id: unknown): id is RibbonColorId {
  return RIBBON_COLORS.some((r) => r.id === id);
}

/** ¿Está disponible este mantel con las insignias conseguidas? */
export function tableclothAvailable(id: TableclothId, unlocked: ReadonlySet<string>): boolean {
  const def = TABLECLOTHS.find((t) => t.id === id);
  return !def?.unlockedBy || unlocked.has(def.unlockedBy);
}
