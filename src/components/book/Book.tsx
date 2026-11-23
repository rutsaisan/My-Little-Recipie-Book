/**
 * El cuaderno: tapa, hojas, espiral, pestañas separadoras y marcapáginas.
 * Recibe qué vista mostrar y si hay un paso de página en curso; la lógica de
 * navegación vive en `useBookNavigation`.
 */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { viewPages } from '../../layout/buildBook';
import { bookChrome, bookOuterSize, type PageGeometry } from '../../layout/geometry';
import { geometryStyle } from '../../layout/geometryStyle';
import type { BookLayout, BookPage } from '../../layout/types';
import { BookCover } from '../cover/BookCover';
import { Spiral } from '../decor/Spiral';
import { EndpaperPage } from '../pages/SpecialPages';
import { PageView } from '../pages/PageView';
import type { PageSide } from '../pages/PageFrame';
import { BookmarkRibbon } from './BookmarkRibbon';
import { CategoryTabs } from './CategoryTabs';
import { FlipLeaf } from './FlipLeaf';
import type { DragFlipController } from './dragFlip';
import type { FlipState } from './useBookNavigation';
import styles from './Book.module.css';

export type CoverState = 'closed' | 'opening' | 'open' | 'closing';

interface BookProps {
  geometry: PageGeometry;
  layout: BookLayout;
  view: number;
  flip: FlipState | null;
  cover: CoverState;
  reducedMotion: boolean;
  bookmarkIndex: number | null;
  onFlipDone: () => void;
  /** Paso de página arrastrando en curso (si lo hay) y qué hacer si se suelta sin pasar. */
  dragFlip: DragFlipController | null;
  onFlipCancel: () => void;
  onCoverDone: () => void;
  onCoverClick: () => void;
  onTab: (pageIndex: number) => void;
  onBookmarkJump: () => void;
  onNext: () => void;
  onPrev: () => void;
  canNext: boolean;
  canPrev: boolean;
}

export function Book(props: BookProps) {
  const { geometry: g, layout, view, flip, cover, reducedMotion } = props;
  const spread = g.mode === 'spread';
  const pages = layout.pages;
  const outer = bookOuterSize(g);
  const shiftRef = useRef<HTMLDivElement>(null);
  const isOpen = cover === 'open';
  const closedLook = cover === 'closed' || cover === 'opening' || cover === 'closing';

  const page = (index: number | null): BookPage | null => (index === null ? null : (pages[index] ?? null));
  const slot = (index: number | null, side: PageSide, left: number) => {
    const p = page(index);
    if (!p) return null;
    return (
      <div className={styles.slot} style={{ left, width: g.pageWidth, height: g.pageHeight }}>
        <PageView page={p} side={side} />
      </div>
    );
  };

  // ── Qué página se ve en cada lado ─────────────────────────────────────────
  const flipping = flip && isOpen ? flip : null;
  const { left: leftIndex, right: rightIndex } = staticPages(g.mode, view, flipping);
  let leaf: ReactNode = null;
  const flipDuration = reducedMotion ? 1 : spread ? 780 : 620;

  if (spread) {
    if (flipping) {
      const [fl, fr] = viewPages('spread', flipping.from);
      const [tl, tr] = viewPages('spread', flipping.to);
      const forward = flipping.direction === 'forward';
      leaf = (
        <FlipLeaf
          key={flipping.id}
          placement={forward ? 'right' : 'left'}
          from={0}
          to={forward ? -180 : 180}
          front={renderPage(page(forward ? fr : fl), forward ? 'right' : 'left')}
          back={renderPage(page(forward ? tl : tr), forward ? 'left' : 'right')}
          pageWidth={g.pageWidth}
          pageHeight={g.pageHeight}
          duration={flipDuration}
          onDone={props.onFlipDone}
          drag={flipping.interactive ? (props.dragFlip ?? undefined) : undefined}
          onCancel={props.onFlipCancel}
        />
      );
    }
  } else if (flipping) {
    // Una sola página: la hoja gira sobre la espiral y desaparece por la izquierda
    // (o vuelve desde allí al ir hacia atrás).
    const forward = flipping.direction === 'forward';
    leaf = (
      <FlipLeaf
        key={flipping.id}
        placement="single"
        from={forward ? 0 : -180}
        to={forward ? -180 : 0}
        front={renderPage(page(forward ? flipping.from : flipping.to), 'single')}
        back={<div className={`${styles.leafBack} tex-paper`} />}
        pageWidth={g.pageWidth}
        pageHeight={g.pageHeight}
        duration={flipDuration}
        onDone={props.onFlipDone}
        drag={flipping.interactive ? (props.dragFlip ?? undefined) : undefined}
        onCancel={props.onFlipCancel}
      />
    );
  }

  // ── Tapa ──────────────────────────────────────────────────────────────────
  const coverPlacement = spread ? 'right' : 'single';
  const shiftClosed = spread ? `translateX(${-g.pageWidth / 2}px)` : 'none';
  let coverLeaf: ReactNode = null;
  if (cover === 'closed') {
    coverLeaf = (
      <button
        type="button"
        className={styles.coverButton}
        style={{ left: spread ? g.pageWidth : 0, width: g.pageWidth, height: g.pageHeight }}
        onClick={props.onCoverClick}
        aria-label="Abrir el recetario"
      >
        <BookCover compact={g.pageHeight < 650} />
      </button>
    );
  } else if (cover === 'opening' || cover === 'closing') {
    const opening = cover === 'opening';
    coverLeaf = (
      <FlipLeaf
        key={cover}
        placement={coverPlacement}
        from={opening ? 0 : -180}
        to={opening ? -180 : 0}
        front={<BookCover compact={g.pageHeight < 650} />}
        back={<EndpaperPage side={spread ? 'left' : 'single'} />}
        pageWidth={g.pageWidth}
        pageHeight={g.pageHeight}
        duration={reducedMotion ? 1 : 1100}
        onDone={props.onCoverDone}
        companion={
          spread
            ? {
                ref: shiftRef,
                keyframes: opening
                  ? [{ transform: shiftClosed }, { transform: 'none' }]
                  : [{ transform: 'none' }, { transform: shiftClosed }],
              }
            : undefined
        }
      />
    );
  }

  // Con la tapa cerrada (o moviéndose) no se ve la página izquierda.
  const showLeft = spread && isOpen;
  const pagesLeft = leftIndex ?? 0;
  const pagesRight = pages.length - 1 - (spread ? (rightIndex ?? 0) : (leftIndex ?? 0));

  const bookStyle = {
    width: outer.width,
    height: outer.height,
    ...geometryStyle(g),
  } as CSSProperties;

  const chrome = bookChrome(g.mode);
  const originX = spread ? chrome.tabOut + chrome.stack : chrome.spiralOut;
  const visibleIndexes = spread ? [leftIndex, rightIndex] : [leftIndex];

  return (
    <div className={`${styles.book} ${spread ? styles.spread : styles.single}`} style={bookStyle}>
      <div
        ref={shiftRef}
        className={styles.shift}
        style={{
          left: originX,
          top: chrome.ribbonTop,
          width: spread ? g.pageWidth * 2 : g.pageWidth,
          height: g.pageHeight,
          transform: cover === 'closed' ? shiftClosed : undefined,
        }}
      >
        <Stack side="right" layers={layersFor(pagesRight)} left={spread ? g.pageWidth : 0} g={g} />
        {showLeft && <Stack side="left" layers={layersFor(pagesLeft)} left={0} g={g} />}

        <CategoryTabs
          layout={layout}
          geometry={g}
          firstVisible={spread ? (isOpen ? (leftIndex ?? 0) : 0) : (leftIndex ?? 0)}
          closed={closedLook}
          onTab={props.onTab}
        />

        {showLeft && slot(leftIndex, 'left', 0)}
        {spread ? slot(rightIndex, 'right', g.pageWidth) : slot(leftIndex, 'single', 0)}

        {isOpen && (
          <PageCorners
            spread={spread}
            pageWidth={g.pageWidth}
            canNext={props.canNext}
            canPrev={props.canPrev}
            onNext={props.onNext}
            onPrev={props.onPrev}
          />
        )}

        {leaf}
        {coverLeaf}

        <Spiral
          variant={spread && !closedLook ? 'gutter' : 'edge'}
          height={g.pageHeight}
          className={styles.spiral}
          spineX={spread ? g.pageWidth : 0}
        />

        {isOpen && (
          <BookmarkRibbon
            geometry={g}
            bookmarkIndex={props.bookmarkIndex}
            visibleIndexes={visibleIndexes}
            onJump={props.onBookmarkJump}
          />
        )}
      </div>
    </div>
  );
}

/** Páginas fijas a cada lado; durante un paso de página, las que quedan debajo de la hoja. */
function staticPages(
  mode: PageGeometry['mode'],
  view: number,
  flip: FlipState | null,
): { left: number; right: number | null } {
  if (mode === 'spread') {
    if (!flip) {
      const [left, right] = viewPages('spread', view);
      return { left, right };
    }
    const [fromLeft, fromRight] = viewPages('spread', flip.from);
    const [toLeft, toRight] = viewPages('spread', flip.to);
    return flip.direction === 'forward' ? { left: fromLeft, right: toRight } : { left: toLeft, right: fromRight };
  }
  if (!flip) return { left: view, right: null };
  return { left: flip.direction === 'forward' ? flip.to : flip.from, right: null };
}

function renderPage(page: BookPage | null, side: PageSide) {
  return page ? <PageView page={page} side={side} /> : <div className="tex-paper" style={{ position: 'absolute', inset: 0 }} />;
}

function layersFor(pages: number): number {
  return pages <= 0 ? 0 : Math.min(6, 1 + Math.floor(pages / 3));
}

/** Cantos de las hojas apiladas bajo la página visible y la tapa de cartón. */
function Stack({ side, layers, left, g }: { side: 'left' | 'right'; layers: number; left: number; g: PageGeometry }) {
  const dir = side === 'right' ? 1 : -1;
  const shadows: string[] = [];
  for (let i = 1; i <= layers; i++) {
    const x = (dir * i * 1.4).toFixed(1);
    const y = (i * 1.3).toFixed(1);
    shadows.push(`${x}px ${y}px 0 ${i % 2 ? 'var(--paper-shade)' : 'var(--paper-deep)'}`);
  }
  const edge = layers * 1.4 + 5;
  return (
    <>
      <div
        className={`${styles.board} tex-gingham`}
        style={{
          left: side === 'right' ? left - 2 : left - edge,
          top: -3,
          width: g.pageWidth + edge + 2,
          height: g.pageHeight + layers * 1.3 + 7,
          borderRadius: side === 'right' ? '2px 10px 10px 2px' : '10px 2px 2px 10px',
        }}
      />
      <div
        className={styles.stack}
        style={{ left, width: g.pageWidth, height: g.pageHeight, boxShadow: shadows.join(', ') || undefined }}
      />
    </>
  );
}

/** Esquinas inferiores: al pasar el ratón se levantan un poco y al pulsar pasan página. */
function PageCorners({
  spread,
  pageWidth,
  canNext,
  canPrev,
  onNext,
  onPrev,
}: {
  spread: boolean;
  pageWidth: number;
  canNext: boolean;
  canPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <>
      {canPrev && (
        <button
          type="button"
          className={`${styles.corner} ${styles.cornerPrev}`}
          style={{ left: 0 }}
          onClick={onPrev}
          aria-label="Página anterior"
          tabIndex={-1}
        />
      )}
      {canNext && (
        <button
          type="button"
          className={`${styles.corner} ${styles.cornerNext}`}
          style={{ left: (spread ? pageWidth * 2 : pageWidth) - 74 }}
          onClick={onNext}
          aria-label="Página siguiente"
          tabIndex={-1}
        />
      )}
    </>
  );
}
