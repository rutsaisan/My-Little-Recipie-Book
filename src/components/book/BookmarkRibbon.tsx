import type { PageGeometry } from '../../layout/geometry';
import styles from './BookmarkRibbon.module.css';

interface RibbonProps {
  geometry: PageGeometry;
  bookmarkIndex: number | null;
  /** Índices de las páginas visibles ([izquierda, derecha] o [única]). */
  visibleIndexes: (number | null)[];
  onJump: () => void;
}

/**
 * Cinta del marcapáginas. Si la página marcada está a la vista, la cinta cae
 * sobre ella; si no, asoma por arriba del lado del libro donde se quedó.
 */
export function BookmarkRibbon({ geometry: g, bookmarkIndex, visibleIndexes, onJump }: RibbonProps) {
  if (bookmarkIndex === null) return null;
  const spread = g.mode === 'spread';
  const position = visibleIndexes.indexOf(bookmarkIndex);

  if (position >= 0) {
    // Sobre la página, cerca de la espiral.
    const x = spread && position === 0 ? g.pageWidth * 0.7 : (spread ? g.pageWidth : 0) + g.pageWidth * 0.26;
    return (
      <button
        type="button"
        className={`${styles.ribbon} ${styles.onPage}`}
        style={{ left: x }}
        onClick={onJump}
        aria-label="Esta es la página marcada"
        title="Página marcada"
      />
    );
  }

  const first = visibleIndexes.find((i) => i !== null) ?? 0;
  const before = bookmarkIndex < first;
  const x = spread ? (before ? g.pageWidth * 0.34 : g.pageWidth * 1.62) : g.pageWidth * (before ? 0.18 : 0.74);
  return (
    <button
      type="button"
      className={`${styles.ribbon} ${styles.tail}`}
      style={{ left: x }}
      onClick={onJump}
      aria-label="Ir a la página marcada"
      title="Ir a la página marcada"
    />
  );
}
