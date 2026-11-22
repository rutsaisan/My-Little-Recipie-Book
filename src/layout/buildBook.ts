/**
 * Monta la secuencia completa de páginas del libro.
 *
 * Reglas de maquetación (modo libro abierto, dos páginas):
 *  - Las guardas (interior de la tapa) quedan fuera de la numeración.
 *  - Cada separador de sección va en página derecha; si toca en izquierda,
 *    se pone delante una lámina ilustrada de esa sección.
 *  - Una receta de dos o más páginas empieza en página izquierda, para verla
 *    entera de un vistazo; si hace falta se añade una página decorativa.
 *  - Al final, una página para escribir una receta nueva y el álbum de
 *    insignias.
 * En modo una página (móvil) las páginas simplemente se suceden.
 */
import type { CategoryId } from '../domain/categories';
import type { RecipeId } from '../domain/recipe';
import type { BookMode } from './geometry';
import type { BookLayout, BookPage, BookSection, IndexEntry, RecipeBlock } from './types';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type PageDraft = DistributiveOmit<BookPage, 'number'>;

export interface BuildInput {
  mode: BookMode;
  sections: BookSection[];
  recipePages: Record<RecipeId, RecipeBlock[][]>;
  indexPages: IndexEntry[][];
  /** Insignias de cada página del álbum (al final del libro). */
  albumPages?: string[][];
}

export function buildBook({ mode, sections, recipePages, indexPages, albumPages = [] }: BuildInput): BookLayout {
  const spread = mode === 'spread';
  const drafts: PageDraft[] = [];
  const recipeStart: Record<RecipeId, number> = {};
  const sectionStart: Record<CategoryId, number> = {};
  const nextIsLeft = () => drafts.length % 2 === 0;
  let fillers = 0;
  const pushFiller = () => drafts.push({ kind: 'filler', key: `filler:${fillers}`, seed: fillers++ });

  if (spread) drafts.push({ kind: 'endpaper-front', key: 'endpaper-front' });
  drafts.push({ kind: 'title', key: 'title' });

  const index = indexPages.length ? indexPages : [[]];
  index.forEach((entries, part) => drafts.push({ kind: 'index', key: `index:${part}`, entries, part }));

  for (const section of sections) {
    if (spread && nextIsLeft()) {
      drafts.push({ kind: 'art', key: `art:${section.categoryId}`, categoryId: section.categoryId });
    }
    sectionStart[section.categoryId] = drafts.length;
    drafts.push({ kind: 'section', key: `section:${section.categoryId}`, categoryId: section.categoryId });

    for (const recipeId of section.recipeIds) {
      const parts = recipePages[recipeId] ?? [[{ type: 'header' }]];
      if (spread && parts.length >= 2 && !nextIsLeft()) pushFiller();
      recipeStart[recipeId] = drafts.length;
      parts.forEach((blocks, part) =>
        drafts.push({ kind: 'recipe', key: `recipe:${recipeId}:${part}`, recipeId, blocks, part, parts: parts.length }),
      );
    }
  }

  drafts.push({ kind: 'new-recipe', key: 'new-recipe' });

  // Álbum de insignias, como las hojas de pegatinas al final de un cuaderno.
  const albumStart = drafts.length;
  albumPages.forEach((items, part) => drafts.push({ kind: 'album', key: `album:${part}`, items, part }));

  if (spread && !nextIsLeft()) drafts.push({ kind: 'endpaper-back', key: 'endpaper-back' });

  let number = 0;
  const pages = drafts.map((page) => {
    const isEndpaper = page.kind === 'endpaper-front' || page.kind === 'endpaper-back';
    return { ...page, number: isEndpaper ? null : ++number } as BookPage;
  });

  return { pages, recipeStart, sectionStart, albumStart, sections };
}

/** Páginas que se ven a la vez en una «vista» (pliego o página suelta). */
export function viewPages(mode: BookMode, view: number): [number, number | null] {
  return mode === 'spread' ? [view * 2, view * 2 + 1] : [view, null];
}

export function viewCount(mode: BookMode, pageCount: number): number {
  return mode === 'spread' ? Math.ceil(pageCount / 2) : pageCount;
}

export function viewOfPage(mode: BookMode, pageIndex: number): number {
  return mode === 'spread' ? Math.floor(pageIndex / 2) : pageIndex;
}
