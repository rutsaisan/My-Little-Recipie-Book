/**
 * Cómo se lee un ingrediente en la página: «200 g de harina», «2 huevos»,
 * «una pizca de sal», «perejil al gusto»… y su recálculo por comensales.
 */
import { formatDecimal, formatFraction, roundKitchen, roundTo } from './quantities';
import { getUnit, type UnitDef } from './units';

export interface IngredientLike {
  name: string;
  quantity: number | null;
  unit: string;
}

export interface IngredientText {
  /** Cantidad con su unidad, p. ej. «200 g» o «1½ tazas». Vacío si no hay. */
  amount: string;
  /** Unión entre la cantidad y el nombre: «de» o vacío. */
  connector: string;
  name: string;
  /** Texto final, p. ej. «al gusto». */
  suffix: string;
}

/**
 * Describe un ingrediente. `factor` multiplica la cantidad (raciones):
 * con factor 1 se respeta lo que escribió la persona; al recalcular se
 * redondea con criterio de cocina y se pasa de g a kg o de ml a l.
 */
export function describeIngredient(ingredient: IngredientLike, factor = 1): IngredientText {
  const unit = getUnit(ingredient.unit);
  const name = stripLeadingDe(ingredient.name.trim());

  if (unit.noQuantity) {
    return { amount: '', connector: '', name, suffix: unit.singular };
  }

  if (ingredient.quantity === null) {
    if (!unit.id) return { amount: '', connector: '', name, suffix: '' };
    const lead = unit.article ? `${unit.article} ${unit.singular}` : unit.singular;
    return { amount: lead, connector: 'de', name, suffix: '' };
  }

  const scaled = ingredient.quantity * factor;
  const { value, unit: shown } = factor === 1 ? { value: scaled, unit } : convertForDisplay(scaled, unit);
  const number = formatNumber(value, shown, factor !== 1);
  const unitWord = value > 1 ? shown.plural : shown.singular;
  return {
    amount: unitWord ? `${number} ${unitWord}` : number,
    connector: unitWord ? 'de' : '',
    name,
    suffix: '',
  };
}

/** Texto completo en una línea (útil para leer en voz alta o buscar). */
export function ingredientToText(ingredient: IngredientLike, factor = 1): string {
  const t = describeIngredient(ingredient, factor);
  return [t.amount, t.connector, t.name, t.suffix].filter(Boolean).join(' ');
}

function formatNumber(value: number, unit: UnitDef, rounded: boolean): string {
  if (unit.fractions) return formatFraction(value);
  if (!rounded) return formatDecimal(value, 3);
  // kg y l admiten dos decimales (1,25 kg); g y ml se redondean «de cocina».
  if (unit.factor && unit.factor >= 1000) return formatDecimal(roundTo(value, 2), 2);
  return formatDecimal(roundKitchen(value), 1);
}

function convertForDisplay(value: number, unit: UnitDef): { value: number; unit: UnitDef } {
  if (!unit.metric || !unit.factor) return { value, unit };
  const base = value * unit.factor; // en g o ml
  const big = getUnit(unit.metric === 'mass' ? 'kg' : 'l');
  const small = getUnit(unit.metric === 'mass' ? 'g' : 'ml');
  if (base >= 1000) return { value: base / 1000, unit: big };
  if (unit.id === 'cl') return { value, unit };
  return { value: base, unit: small };
}

function stripLeadingDe(name: string): string {
  return name.replace(/^de\s+/i, '');
}
