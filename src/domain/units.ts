/**
 * Unidades de medida de los ingredientes.
 *
 * El `id` es lo que se guarda en la receta. Los ids desconocidos (por ejemplo
 * los que traiga en el futuro una importación) se muestran tal cual.
 */

export type UnitGroupId = 'none' | 'mass' | 'volume' | 'home' | 'pieces' | 'other';

export interface UnitDef {
  id: string;
  /** Texto en el desplegable del formulario. */
  label: string;
  singular: string;
  plural: string;
  group: UnitGroupId;
  /** Mostrar las cantidades como fracciones (½, ¼…) en vez de decimales. */
  fractions: boolean;
  /** Unidad métrica convertible (g ↔ kg, ml ↔ l) al recalcular raciones. */
  metric?: 'mass' | 'volume';
  /** Equivalencia con la unidad base (g o ml). */
  factor?: number;
  /** Artículo para leerla sin número: «una pizca de sal». */
  article?: 'un' | 'una';
  /** No lleva cantidad: «sal al gusto». */
  noQuantity?: boolean;
}

export const UNIT_GROUPS: { id: UnitGroupId; label: string }[] = [
  { id: 'none', label: 'Sin unidad' },
  { id: 'mass', label: 'Peso' },
  { id: 'volume', label: 'Volumen' },
  { id: 'home', label: 'Medidas caseras' },
  { id: 'pieces', label: 'Piezas' },
  { id: 'other', label: 'Otras' },
];

export const UNITS: readonly UnitDef[] = [
  { id: '', label: 'sin unidad', singular: '', plural: '', group: 'none', fractions: true },
  { id: 'g', label: 'gramos (g)', singular: 'g', plural: 'g', group: 'mass', fractions: false, metric: 'mass', factor: 1 },
  { id: 'kg', label: 'kilos (kg)', singular: 'kg', plural: 'kg', group: 'mass', fractions: false, metric: 'mass', factor: 1000 },
  { id: 'ml', label: 'mililitros (ml)', singular: 'ml', plural: 'ml', group: 'volume', fractions: false, metric: 'volume', factor: 1 },
  { id: 'cl', label: 'centilitros (cl)', singular: 'cl', plural: 'cl', group: 'volume', fractions: false, metric: 'volume', factor: 10 },
  { id: 'l', label: 'litros (l)', singular: 'l', plural: 'l', group: 'volume', fractions: false, metric: 'volume', factor: 1000 },
  { id: 'taza', label: 'tazas', singular: 'taza', plural: 'tazas', group: 'home', fractions: true, article: 'una' },
  { id: 'vaso', label: 'vasos', singular: 'vaso', plural: 'vasos', group: 'home', fractions: true, article: 'un' },
  { id: 'cda', label: 'cucharadas', singular: 'cucharada', plural: 'cucharadas', group: 'home', fractions: true, article: 'una' },
  { id: 'cdta', label: 'cucharaditas', singular: 'cucharadita', plural: 'cucharaditas', group: 'home', fractions: true, article: 'una' },
  { id: 'chorrito', label: 'chorritos', singular: 'chorrito', plural: 'chorritos', group: 'home', fractions: true, article: 'un' },
  { id: 'pizca', label: 'pizcas', singular: 'pizca', plural: 'pizcas', group: 'home', fractions: true, article: 'una' },
  { id: 'punado', label: 'puñados', singular: 'puñado', plural: 'puñados', group: 'home', fractions: true, article: 'un' },
  { id: 'unidad', label: 'unidades', singular: 'unidad', plural: 'unidades', group: 'pieces', fractions: true, article: 'una' },
  { id: 'diente', label: 'dientes', singular: 'diente', plural: 'dientes', group: 'pieces', fractions: true, article: 'un' },
  { id: 'rebanada', label: 'rebanadas', singular: 'rebanada', plural: 'rebanadas', group: 'pieces', fractions: true, article: 'una' },
  { id: 'loncha', label: 'lonchas', singular: 'loncha', plural: 'lonchas', group: 'pieces', fractions: true, article: 'una' },
  { id: 'hoja', label: 'hojas', singular: 'hoja', plural: 'hojas', group: 'pieces', fractions: true, article: 'una' },
  { id: 'ramita', label: 'ramitas', singular: 'ramita', plural: 'ramitas', group: 'pieces', fractions: true, article: 'una' },
  { id: 'lata', label: 'latas', singular: 'lata', plural: 'latas', group: 'pieces', fractions: true, article: 'una' },
  { id: 'sobre', label: 'sobres', singular: 'sobre', plural: 'sobres', group: 'pieces', fractions: true, article: 'un' },
  { id: 'paquete', label: 'paquetes', singular: 'paquete', plural: 'paquetes', group: 'pieces', fractions: true, article: 'un' },
  { id: 'al-gusto', label: 'al gusto', singular: 'al gusto', plural: 'al gusto', group: 'other', fractions: true, noQuantity: true },
];

const byId = new Map(UNITS.map((u) => [u.id, u]));

/** Devuelve la unidad; si no la conoce, crea una descripción literal. */
export function getUnit(id: string): UnitDef {
  return (
    byId.get(id) ?? {
      id,
      label: id,
      singular: id,
      plural: id,
      group: 'other',
      fractions: true,
    }
  );
}

export function isKnownUnit(id: string): boolean {
  return byId.has(id);
}
