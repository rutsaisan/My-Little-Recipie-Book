/**
 * Navegación por el libro: vista actual (pliego o página), paso de página
 * animado en curso y cola de un salto pendiente si se pulsa muy rápido.
 */
import { useCallback, useState } from 'react';
import { viewCount, viewOfPage, viewPages } from '../../layout/buildBook';
import type { BookMode } from '../../layout/geometry';
import type { BookLayout, BookPage } from '../../layout/types';

export interface FlipState {
  id: number;
  from: number;
  to: number;
  direction: 'forward' | 'backward';
  /** La hoja la mueve el dedo o el ratón (ver dragFlip.ts). */
  interactive?: boolean;
}

interface NavState {
  view: number;
  flip: FlipState | null;
  queued: number | null;
  /** Clave de la página principal visible: permite reubicarse al re-maquetar. */
  anchor: string | null;
  layout: BookLayout | null;
  mode: BookMode;
}

const DECORATIVE: BookPage['kind'][] = ['endpaper-front', 'filler', 'art'];

function primaryPage(mode: BookMode, view: number, pages: BookPage[]): BookPage | undefined {
  const [left, right] = viewPages(mode, view);
  const page = pages[left];
  if (right !== null && pages[right] && (!page || DECORATIVE.includes(page.kind))) return pages[right];
  return page;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
let flipCounter = 0;

export function useBookNavigation(layout: BookLayout | null, mode: BookMode) {
  const [nav, setNav] = useState<NavState>({ view: 0, flip: null, queued: null, anchor: null, layout, mode });

  // Al cambiar la maqueta (receta nueva, otra pantalla…) se vuelve a la misma página.
  if (layout && (layout !== nav.layout || mode !== nav.mode)) {
    let view = nav.layout ? nav.view : 0;
    if (nav.anchor) {
      const index = layout.pages.findIndex((p) => p.key === nav.anchor);
      if (index >= 0) view = viewOfPage(mode, index);
    } else if (nav.layout && nav.mode !== mode) {
      view = viewOfPage(mode, viewPages(nav.mode, nav.view)[0]);
    }
    view = clamp(view, 0, viewCount(mode, layout.pages.length) - 1);
    setNav({ ...nav, view, flip: null, queued: null, layout, mode });
  }

  const views = layout ? viewCount(mode, layout.pages.length) : 0;

  const goToView = useCallback((target: number, animate = true) => {
    setNav((prev) => {
      if (!prev.layout) return prev;
      const max = viewCount(prev.mode, prev.layout.pages.length) - 1;
      const to = clamp(target, 0, max);
      if (prev.flip) return to === prev.flip.to ? { ...prev, queued: null } : { ...prev, queued: to };
      if (to === prev.view) return prev;
      const anchor = primaryPage(prev.mode, to, prev.layout.pages)?.key ?? null;
      if (!animate) return { ...prev, view: to, anchor };
      return {
        ...prev,
        anchor,
        flip: { id: ++flipCounter, from: prev.view, to, direction: to > prev.view ? 'forward' : 'backward' },
      };
    });
  }, []);

  const finishFlip = useCallback(() => {
    setNav((prev) => {
      if (!prev.flip || !prev.layout) return prev;
      const view = prev.flip.to;
      if (prev.queued !== null && prev.queued !== view) {
        const to = prev.queued;
        return {
          ...prev,
          view,
          queued: null,
          anchor: primaryPage(prev.mode, to, prev.layout.pages)?.key ?? null,
          flip: { id: ++flipCounter, from: view, to, direction: to > view ? 'forward' : 'backward' },
        };
      }
      return { ...prev, view, flip: null, queued: null, anchor: primaryPage(prev.mode, view, prev.layout.pages)?.key ?? prev.anchor };
    });
  }, []);

  /** Empieza a pasar página arrastrando. Devuelve false si no se puede. */
  const startDrag = useCallback(
    (direction: 'forward' | 'backward'): boolean => {
      if (nav.flip || !nav.layout) return false;
      const to = nav.view + (direction === 'forward' ? 1 : -1);
      if (to < 0 || to > viewCount(nav.mode, nav.layout.pages.length) - 1) return false;
      setNav((prev) =>
        prev.flip ? prev : { ...prev, flip: { id: ++flipCounter, from: prev.view, to, direction, interactive: true } },
      );
      return true;
    },
    [nav.flip, nav.layout, nav.view, nav.mode],
  );

  /** La hoja arrastrada vuelve a su sitio: el libro se queda donde estaba. */
  const cancelFlip = useCallback(() => {
    setNav((prev) => (prev.flip ? { ...prev, flip: null, queued: null } : prev));
  }, []);

  /** Vista a la que se dirige el libro (la de destino si hay un paso en curso). */
  const target = nav.flip ? (nav.queued ?? nav.flip.to) : nav.view;

  const next = useCallback(() => goToView(target + 1), [goToView, target]);
  const prev = useCallback(() => goToView(target - 1), [goToView, target]);
  const goToPage = useCallback(
    (pageIndex: number, animate = true) => goToView(viewOfPage(mode, pageIndex), animate),
    [goToView, mode],
  );

  return {
    view: nav.view,
    flip: nav.flip,
    views,
    target,
    canPrev: target > 0,
    canNext: target < views - 1,
    goToView,
    goToPage,
    next,
    prev,
    finishFlip,
    startDrag,
    cancelFlip,
  };
}
