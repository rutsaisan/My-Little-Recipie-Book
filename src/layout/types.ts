/**
 * Tipos del maquetador del libro.
 */
import type { CategoryId } from '../domain/categories';
import type { RecipeId } from '../domain/recipe';

/** Trozo de receta que se coloca en una página. */
export type RecipeBlock =
  /** Título, datos (tiempos, comensales, dificultad). */
  | { type: 'header' }
  /** Ingredientes [0, to) en columna + foto del plato o ilustración al lado. */
  | { type: 'intro'; to: number }
  /** Foto del plato sola (páginas estrechas: va encima de los ingredientes). */
  | { type: 'photo' }
  /** Ingredientes a todo el ancho: los que no cupieron junto a la foto o, en
   *  páginas estrechas, todos (`continued` indica si siguen de otra página). */
  | { type: 'ingredients'; from: number; to: number; continued: boolean }
  /** Elaboración: encabezado y pasos repartidos en columnas (índices). */
  | { type: 'method'; continued: boolean; columns: number[][] }
  /** Notas personales. */
  | { type: 'notes' }
  /** Pegatina decorativa al pie, si queda sitio en la última página. */
  | { type: 'sticker' };

/** Alturas medidas (px virtuales) de cada pieza de una receta. */
export interface RecipeMeasure {
  header: number;
  /** Encabezado «Ingredientes» en la columna estrecha (incluye el aviso si no hay). */
  ingredientsHeading: number;
  ingredientLinesIntro: number[];
  /** Encabezado «Ingredientes» a todo el ancho (incluye el aviso si no hay). */
  ingredientsHeadingFull: number;
  ingredientsHeadingCont: number;
  ingredientLinesFull: number[];
  aside: number;
  /** Foto del plato apilada (páginas estrechas); 0 si no hay foto final. */
  photoStacked: number;
  methodHeading: number;
  methodHeadingCont: number;
  steps: number[];
  /** 0 si no hay notas. */
  notes: number;
}

export type IndexEntry =
  | { type: 'category'; categoryId: CategoryId }
  | { type: 'recipe'; recipeId: RecipeId; categoryId: CategoryId }
  /** Enlace al álbum de insignias, al final del índice. */
  | { type: 'album' };

export interface IndexMeasure {
  title: number;
  titleCont: number;
  /** Altura de cada entrada, en el mismo orden que las entradas. */
  entries: number[];
}

interface PageCommon {
  /** Clave estable: permite volver a la misma página tras re-maquetar. */
  key: string;
  /** Número impreso (null en las guardas). */
  number: number | null;
}

export type BookPage = PageCommon &
  (
    | { kind: 'endpaper-front' }
    | { kind: 'title' }
    | { kind: 'index'; entries: IndexEntry[]; part: number }
    | { kind: 'section'; categoryId: CategoryId }
    | { kind: 'art'; categoryId: CategoryId }
    | { kind: 'filler'; seed: number }
    | { kind: 'recipe'; recipeId: RecipeId; blocks: RecipeBlock[]; part: number; parts: number }
    | { kind: 'new-recipe' }
    /** Álbum de insignias: ids de las insignias que van en esta página. */
    | { kind: 'album'; items: string[]; part: number }
    | { kind: 'endpaper-back' }
  );

export type BookPageKind = BookPage['kind'];

export interface BookSection {
  categoryId: CategoryId;
  recipeIds: RecipeId[];
}

export interface BookLayout {
  pages: BookPage[];
  /** Índice de página donde empieza cada receta. */
  recipeStart: Record<RecipeId, number>;
  /** Índice de página del separador de cada sección. */
  sectionStart: Record<CategoryId, number>;
  /** Primera página del álbum de insignias. */
  albumStart: number;
  sections: BookSection[];
}
