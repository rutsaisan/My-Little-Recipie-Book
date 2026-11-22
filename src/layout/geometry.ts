/**
 * Medidas de las páginas del libro.
 *
 * Las páginas se maquetan en un tamaño «virtual» fijo (en px) y después todo
 * el libro se escala para caber en la pantalla. Así la paginación es estable:
 * lo que se mide es exactamente lo que se pinta. Hay varios tamaños por modo
 * para que el texto se lea cómodo tanto en un portátil bajito como en un
 * monitor grande o un móvil.
 */

export type BookMode = 'spread' | 'single';

export interface PageGeometry {
  key: string;
  mode: BookMode;
  pageWidth: number;
  pageHeight: number;
  padTop: number;
  padBottom: number;
  /** Margen del lado de la espiral (agujeros + anillas). */
  padInner: number;
  padOuter: number;
  /** Cabecera (sección / acciones) y pie (número de página). */
  headHeight: number;
  footHeight: number;
  bodyWidth: number;
  bodyHeight: number;
  /** Espacio entre bloques de una página. */
  blockGap: number;
  /** Espacio entre pasos dentro de una columna. */
  stepGap: number;
  columnGap: number;
  /** Columna derecha de la fila de ingredientes (foto o ilustración). */
  asideWidth: number;
  introGap: number;
  /**
   * `row`: ingredientes a la izquierda y foto a la derecha (páginas anchas).
   * `stacked`: foto arriba e ingredientes a todo el ancho (páginas estrechas).
   */
  introLayout: 'row' | 'stacked';
  /** Ancho de la foto del plato cuando va encima de los ingredientes. */
  stackedPhotoWidth: number;
  /** Columnas para los pasos con fotos del proceso. */
  processColumns: 1 | 2;
  /** Alto del hueco para la pegatina decorativa al pie de una receta. */
  stickerBlockHeight: number;
  /** Álbum de insignias: columnas, alto de cada casilla y de la cabecera. */
  albumColumns: 2 | 3;
  albumSlotHeight: number;
  albumHeaderHeight: number;
}

export interface BookChrome {
  /** Pestañas separadoras. */
  tabOut: number;
  /** Cantos de las hojas apiladas. */
  stack: number;
  /** Marcapáginas que asoma por arriba. */
  ribbonTop: number;
  bottom: number;
  /** Anillas que asoman por la izquierda en modo una página. */
  spiralOut: number;
}

/** Elementos del libro que sobresalen de las páginas (en px virtuales). */
export function bookChrome(mode: BookMode): BookChrome {
  return mode === 'spread'
    ? { tabOut: 34, stack: 9, ribbonTop: 26, bottom: 12, spiralOut: 18 }
    : { tabOut: 26, stack: 7, ribbonTop: 22, bottom: 10, spiralOut: 18 };
}

/** Tamaños de página del libro abierto, de mayor a menor. */
const SPREAD_SIZES: [number, number][] = [
  [560, 760],
  [530, 690],
  [500, 620],
  [470, 550],
];

export function makeGeometry(mode: BookMode, pageWidth: number, pageHeight: number): PageGeometry {
  const spread = mode === 'spread';
  const padInner = spread ? 60 : 42;
  const padOuter = spread ? 38 : 18;
  const padTop = 28;
  const padBottom = 22;
  const headHeight = 30;
  const footHeight = 26;
  const bodyWidth = pageWidth - padInner - padOuter;
  const bodyHeight = pageHeight - padTop - padBottom - headHeight - footHeight;
  return {
    key: `${mode}-${pageWidth}x${pageHeight}`,
    mode,
    pageWidth,
    pageHeight,
    padTop,
    padBottom,
    padInner,
    padOuter,
    headHeight,
    footHeight,
    bodyWidth,
    bodyHeight,
    blockGap: 14,
    stepGap: 12,
    columnGap: 22,
    asideWidth: Math.round(bodyWidth * (spread ? 0.4 : 0.43)),
    introGap: 18,
    introLayout: bodyWidth < 330 ? 'stacked' : 'row',
    stackedPhotoWidth: Math.min(250, Math.round(bodyWidth * 0.8)),
    processColumns: spread && bodyWidth >= 400 ? 2 : 1,
    stickerBlockHeight: 104,
    albumColumns: bodyWidth >= 380 ? 3 : 2,
    albumSlotHeight: 160,
    albumHeaderHeight: 122,
  };
}

/** Cuántas insignias caben en una página del álbum (la primera lleva cabecera). */
export function albumCapacity(g: PageGeometry, first: boolean): number {
  const height = g.bodyHeight - (first ? g.albumHeaderHeight : 0);
  return Math.max(1, Math.floor(height / g.albumSlotHeight)) * g.albumColumns;
}

/** Tamaño total del libro abierto (páginas + elementos que sobresalen). */
export function bookOuterSize(g: PageGeometry): { width: number; height: number } {
  const { tabOut, stack, ribbonTop, bottom, spiralOut } = bookChrome(g.mode);
  const width =
    g.mode === 'spread' ? g.pageWidth * 2 + 2 * (tabOut + stack) : g.pageWidth + spiralOut + tabOut + stack;
  return { width, height: g.pageHeight + ribbonTop + bottom };
}

export interface Viewport {
  width: number;
  height: number;
}

/** Espacio que queda para el libro una vez colocadas las barras. */
export function availableArea(viewport: Viewport, mode: BookMode): Viewport {
  const toolbar = viewport.width < 560 ? 58 : 66;
  if (mode === 'spread') {
    return { width: viewport.width - 2 * 64, height: viewport.height - toolbar - 18 };
  }
  // En modo una página hay una barra inferior con los botones de pasar.
  return { width: viewport.width - 12, height: viewport.height - toolbar - 58 };
}

export function chooseMode(viewport: Viewport): BookMode {
  return viewport.width >= 860 && viewport.width / viewport.height >= 1.12 ? 'spread' : 'single';
}

const COMFORT_SCALE = 0.93;
const MAX_SCALE = 1.4;

export interface Fit {
  geometry: PageGeometry;
  scale: number;
}

const scaleFor = (geometry: PageGeometry, area: Viewport) => {
  const outer = bookOuterSize(geometry);
  return Math.min(area.width / outer.width, area.height / outer.height, MAX_SCALE);
};

/**
 * Elige el tamaño de página que se lea cómodo en esta pantalla y la escala a
 * la que hay que pintar el libro.
 *
 * - Libro abierto: el mayor de unos tamaños fijos que quepa sin encoger mucho.
 * - Una página (móvil, tableta en vertical): la página se adapta a la
 *   pantalla para que el texto se vea a su tamaño real. Las medidas se
 *   redondean a saltos de 20/40 px para no re-maquetar con cada pequeño cambio
 *   (p. ej. cuando el navegador del móvil esconde su barra).
 */
export function fitBook(viewport: Viewport): Fit {
  const mode = chooseMode(viewport);
  const area = availableArea(viewport, mode);

  if (mode === 'single') {
    const chrome = bookChrome('single');
    const step = (value: number, by: number) => Math.floor(value / by) * by;
    const width = clamp(step(area.width - chrome.spiralOut - chrome.tabOut - chrome.stack, 20), 300, 520);
    const height = clamp(step(area.height - chrome.ribbonTop - chrome.bottom, 40), 520, 820);
    const geometry = makeGeometry('single', width, height);
    return { geometry, scale: Math.max(0.3, scaleFor(geometry, area)) };
  }

  let best: Fit | null = null;
  for (const [w, h] of SPREAD_SIZES) {
    const geometry = makeGeometry(mode, w, h);
    const scale = scaleFor(geometry, area);
    best = { geometry, scale: Math.max(0.3, scale) };
    if (scale >= COMFORT_SCALE) break;
  }
  return best!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
