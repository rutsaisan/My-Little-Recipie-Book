/**
 * Reparto del contenido en páginas (funciones puras, sin DOM).
 *
 * Reciben alturas ya medidas y deciden qué cabe en cada página, como haría
 * quien maqueta un recetario: los ingredientes junto a la foto, los pasos sin
 * partir por la mitad y el encabezado de una sección nunca solo al final.
 */
import type { IndexEntry, IndexMeasure, RecipeBlock, RecipeMeasure } from './types';

export interface FlowGeometry {
  bodyHeight: number;
  blockGap: number;
  stepGap: number;
  /** Ver `PageGeometry.introLayout` (por defecto, fila). */
  introLayout?: 'row' | 'stacked';
  /** Alto de la pegatina decorativa final (0 o ausente = sin pegatina). */
  stickerBlockHeight?: number;
}

/** Pequeño margen de seguridad contra redondeos de subpíxel. */
const EPSILON = 0.5;

class PageFlow<T> {
  readonly pages: T[][] = [[]];
  private used = 0;

  constructor(
    private readonly height: number,
    private readonly gap: number,
  ) {}

  get current(): T[] {
    return this.pages[this.pages.length - 1];
  }

  get isEmpty(): boolean {
    return this.current.length === 0;
  }

  /** Espacio libre para el siguiente bloque (descontando el hueco). */
  get room(): number {
    return this.height - this.used - (this.isEmpty ? 0 : this.gap) + EPSILON;
  }

  add(block: T, height: number): void {
    this.used += (this.isEmpty ? 0 : this.gap) + height;
    this.current.push(block);
  }

  newPage(): void {
    if (this.isEmpty) return;
    this.pages.push([]);
    this.used = 0;
  }

  full(): number {
    return this.height + EPSILON;
  }
}

function sum(values: number[], from = 0, to = values.length): number {
  let total = 0;
  for (let i = from; i < to; i++) total += values[i];
  return total;
}

export function paginateRecipe(m: RecipeMeasure, g: FlowGeometry, stepColumns: 1 | 2): RecipeBlock[][] {
  const flow = new PageFlow<RecipeBlock>(g.bodyHeight, g.blockGap);

  // 1) Título y datos.
  flow.add({ type: 'header' }, m.header);

  const n = m.ingredientLinesFull.length;
  let i = 0; // primer ingrediente aún sin colocar
  let fromIntro = false;

  if (g.introLayout === 'stacked') {
    // 2a) Página estrecha: la foto del plato encima, si la hay.
    if (m.photoStacked > 0) {
      if (m.photoStacked > flow.room) flow.newPage();
      flow.add({ type: 'photo' }, m.photoStacked);
    }
    if (n === 0) {
      if (m.ingredientsHeadingFull > flow.room) flow.newPage();
      flow.add({ type: 'ingredients', from: 0, to: 0, continued: false }, m.ingredientsHeadingFull);
    }
  } else {
    // 2b) Ingredientes en columna junto a la foto (o ilustración).
    const rowHeight = (k: number) => Math.max(m.ingredientsHeading + sum(m.ingredientLinesIntro, 0, k), m.aside);
    const fitIntro = (room: number) => {
      let k = n;
      while (k > 0 && rowHeight(k) > room) k--;
      return k;
    };
    let k = fitIntro(flow.room);
    if (rowHeight(k) > flow.room || (k === 0 && n > 0)) {
      flow.newPage();
      k = Math.max(fitIntro(flow.room), Math.min(1, n));
    }
    flow.add({ type: 'intro', to: k }, rowHeight(k));
    i = k;
    fromIntro = true;
  }

  // 3) Ingredientes a todo el ancho (los que no cupieron junto a la foto o,
  //    en páginas estrechas, todos), sin dejar el encabezado solo.
  while (i < n) {
    const continued = fromIntro || i > 0;
    const heading = continued ? m.ingredientsHeadingCont : m.ingredientsHeadingFull;
    const room = flow.room - heading;
    let j = i;
    let acc = 0;
    while (j < n && acc + m.ingredientLinesFull[j] <= room) acc += m.ingredientLinesFull[j++];
    // Como en un libro: el encabezado no se queda al pie con una o dos líneas.
    const minLines = Math.min(3, n - i);
    if (j - i < minLines && !flow.isEmpty) {
      flow.newPage();
      continue;
    }
    if (j === i) {
      acc = m.ingredientLinesFull[i];
      j = i + 1; // una línea más alta que la página: se coloca igualmente
    }
    flow.add({ type: 'ingredients', from: i, to: j, continued }, heading + acc);
    i = j;
    if (i < n) flow.newPage();
  }

  // 4) Elaboración, sin partir ningún paso.
  let s = 0;
  let first = true;
  while (s < m.steps.length) {
    const heading = first ? m.methodHeading : m.methodHeadingCont;
    let fill = fillColumns(m.steps, s, stepColumns, flow.room - heading, g.stepGap);
    if (fill.next === s) {
      if (!flow.isEmpty) {
        flow.newPage();
        continue;
      }
      fill = { columns: [[s]], next: s + 1, height: m.steps[s] };
    }
    flow.add({ type: 'method', continued: !first, columns: fill.columns }, heading + fill.height);
    s = fill.next;
    first = false;
    if (s < m.steps.length) flow.newPage();
  }

  // 5) Notas personales.
  if (m.notes > 0) {
    if (m.notes > flow.room) flow.newPage();
    flow.add({ type: 'notes' }, m.notes);
  }

  // 6) Si sobra sitio al final, un animalito decora el pie de la página.
  const sticker = g.stickerBlockHeight ?? 0;
  if (sticker > 0 && flow.room >= sticker) flow.add({ type: 'sticker' }, sticker);

  return flow.pages;
}

export interface ColumnFill {
  columns: number[][];
  next: number;
  height: number;
}

/**
 * Coloca pasos (por índice) en 1 o 2 columnas dentro de una altura dada.
 * Si caben todos los que quedan, equilibra las dos columnas.
 */
export function fillColumns(heights: number[], start: number, columns: 1 | 2, room: number, gap: number): ColumnFill {
  const colHeight = (from: number, to: number) => (to > from ? sum(heights, from, to) + (to - from - 1) * gap : 0);
  const range = (from: number, to: number) => Array.from({ length: to - from }, (_, x) => from + x);
  const take = (from: number) => {
    let to = from;
    while (to < heights.length && colHeight(from, to + 1) <= room) to++;
    return to;
  };

  if (columns === 1) {
    const to = take(start);
    return { columns: [range(start, to)], next: to, height: colHeight(start, to) };
  }

  // ¿Caben todos los restantes repartidos en dos columnas?
  const end = heights.length;
  let best: { split: number; height: number } | null = null;
  for (let split = start + 1; split <= end; split++) {
    const left = colHeight(start, split);
    const right = colHeight(split, end);
    if (left > room || right > room) continue;
    const height = Math.max(left, right);
    if (!best || height < best.height || (height === best.height && split > best.split)) best = { split, height };
  }
  if (best) {
    return { columns: [range(start, best.split), range(best.split, end)], next: end, height: best.height };
  }

  // Si no, se llena la primera columna y después la segunda.
  const mid = take(start);
  const to = take(mid);
  return {
    columns: [range(start, mid), range(mid, to)],
    next: to,
    height: Math.max(colHeight(start, mid), colHeight(mid, to)),
  };
}

/** Reparte el índice; un encabezado de sección nunca queda solo al pie. */
export function paginateIndex(entries: IndexEntry[], m: IndexMeasure, g: FlowGeometry): IndexEntry[][] {
  const pages: IndexEntry[][] = [[]];
  let used = m.title;
  const newPage = () => {
    pages.push([]);
    used = m.titleCont;
  };
  for (let i = 0; i < entries.length; i++) {
    const h = m.entries[i];
    const page = pages[pages.length - 1];
    const keepWithNext = entries[i].type === 'category' && i + 1 < entries.length ? m.entries[i + 1] : 0;
    if (used + h + keepWithNext > g.bodyHeight + EPSILON && page.length > 0) newPage();
    pages[pages.length - 1].push(entries[i]);
    used += h;
  }
  return pages;
}
