/**
 * Escena principal: la mesa con el cuaderno, la barra de herramientas y la
 * navegación (botones, teclado y gestos). Conecta datos, maqueta y libro.
 */
import {
  Award,
  Bookmark,
  BookmarkCheck,
  BookOpen,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Palette,
  PenLine,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { CategoryId } from '../../domain/categories';
import type { Recipe, RecipeId } from '../../domain/recipe';
import { pushRecent } from '../../domain/search';
import { useFontsReady } from '../../hooks/useFontsReady';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useViewport } from '../../hooks/useViewport';
import { viewPages } from '../../layout/buildBook';
import { bookOuterSize, fitBook, makeGeometry } from '../../layout/geometry';
import { geometryStyle } from '../../layout/geometryStyle';
import type { BookPage } from '../../layout/types';
import { useBookLayout } from '../../layout/useBookLayout';
import { useCategories } from '../../state/categoriesContext';
import { usePreferences } from '../../state/preferencesContext';
import { useRecipes } from '../../state/recipesContext';
import { SearchDrawer } from '../search/SearchDrawer';
import { Celebration } from '../celebrate/Celebration';
import { OptionsMenu } from './OptionsMenu';
import { MusicToggle } from '../music/MusicToggle';
import { BookCover } from '../cover/BookCover';
import { Button, IconButton } from '../ui/Button';
import { Book, type CoverState } from './Book';
import { BookContext, type BookContextValue } from './bookContext';
import { useBookNavigation } from './useBookNavigation';
import styles from './BookScene.module.css';

export interface FocusRequest {
  recipeId: RecipeId;
  nonce: number;
}

interface BookSceneProps {
  onToggleFavorite: (recipeId: RecipeId) => void;
  onCooked: (recipeId: RecipeId) => void;
  onCook: (recipeId: RecipeId) => void;
  /** Avisa de la receta que se está viendo (para el asistente). */
  onViewRecipe: (recipeId: RecipeId | null) => void;
  onCreate: (categoryId?: CategoryId) => void;
  onEdit: (recipeId: RecipeId) => void;
  onDelete: (recipeId: RecipeId) => void;
  /** Abre el panel «Personalizar el libro». */
  onPersonalize: () => void;
  /** Receta a la que ir (p. ej. recién guardada). */
  focus: FocusRequest | null;
  /** Hay un formulario o diálogo abierto: el teclado no pasa páginas. */
  busy: boolean;
}

const DECORATIVE: BookPage['kind'][] = ['endpaper-front', 'endpaper-back', 'filler', 'art'];

export function BookScene({ onCreate, onEdit, onDelete, onToggleFavorite, onCooked, onCook, onViewRecipe, onPersonalize, focus, busy }: BookSceneProps) {
  const { recipes, status, error, reload } = useRecipes();
  const { categories } = useCategories();
  const viewport = useViewport();
  const { geometry, scale } = useMemo(() => fitBook(viewport), [viewport]);
  const fontsReady = useFontsReady();
  const { layout, measurer } = useBookLayout(recipes, categories, geometry, fontsReady && status === 'ready');
  const nav = useBookNavigation(layout, geometry.mode);
  const reducedMotion = useReducedMotion();
  const [cover, setCover] = useState<CoverState>('closed');
  const { prefs, setPref } = usePreferences();
  const bookmarkKey = prefs.bookmark;
  const setBookmarkKey = (key: string | null) => setPref('bookmark', key);
  const startedAt = prefs.bookStartedAt ?? undefined;
  const [searchOpen, setSearchOpen] = useState(false);
  const [servingsMap, setServingsMap] = useState<Record<RecipeId, number>>({});
  const [highlight, setHighlight] = useState<RecipeId | null>(null);
  const [handledFocus, setHandledFocus] = useState<number | null>(null);
  const swipe = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const spread = geometry.mode === 'spread';
  const isOpen = cover === 'open';
  const compactToolbar = viewport.width < 720;

  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);
  const pages = useMemo(() => layout?.pages ?? [], [layout]);
  const [leftIndex, rightIndex] = viewPages(geometry.mode, nav.target);
  const visible = [leftIndex, rightIndex].filter((i): i is number => i !== null && i < pages.length);
  const primary = visible.map((i) => pages[i]).find((p) => !DECORATIVE.includes(p.kind)) ?? pages[visible[0]];
  const bookmarkIndex = useMemo(() => {
    if (!layout || !bookmarkKey) return null;
    const index = layout.pages.findIndex((p) => p.key === bookmarkKey);
    return index >= 0 ? index : null;
  }, [layout, bookmarkKey]);
  const bookmarkHere = bookmarkIndex !== null && visible.includes(bookmarkIndex);

  // Sección que se está viendo (para proponerla al crear una receta).
  const currentCategory = useMemo<CategoryId | undefined>(() => {
    for (const i of visible) {
      const p = pages[i];
      if (p.kind === 'recipe') return recipesById.get(p.recipeId)?.categoryId;
      if (p.kind === 'section' || p.kind === 'art') return p.categoryId;
    }
    return undefined;
  }, [visible, pages, recipesById]);

  // ── Tapa ─────────────────────────────────────────────────────────────────
  const openBook = useCallback(() => setCover((c) => (c === 'closed' ? 'opening' : c)), []);
  const closeBook = useCallback(() => setCover((c) => (c === 'open' ? 'closing' : c)), []);
  const { goToView, goToPage, next, prev, finishFlip } = nav;
  const onCoverDone = useCallback(() => {
    if (cover === 'closing') goToView(0, false);
    setCover((c) => (c === 'opening' ? 'open' : c === 'closing' ? 'closed' : c));
  }, [cover, goToView]);

  // ── Ir a una receta recién guardada ──────────────────────────────────────
  // Se hace durante el render (estado derivado) en cuanto la maqueta ya la incluye.
  if (focus && layout && handledFocus !== focus.nonce && layout.recipeStart[focus.recipeId] !== undefined) {
    const start = layout.recipeStart[focus.recipeId];
    setHandledFocus(focus.nonce);
    setHighlight(focus.recipeId);
    if (cover !== 'open') {
      setCover('open');
      goToPage(start, false);
    } else {
      goToPage(start);
    }
  }

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 2600);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  // ── Teclado ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (busy || !isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const actions: Record<string, () => void> = {
        ArrowRight: next,
        PageDown: next,
        ArrowLeft: prev,
        PageUp: prev,
        Home: () => goToView(0),
        End: () => goToView(nav.views - 1),
      };
      const action = actions[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, isOpen, next, prev, goToView, nav.views]);

  // ── Gestos (deslizar en pantallas táctiles) ──────────────────────────────
  const onPointerDown = (event: PointerEvent) => {
    if (!isOpen || event.pointerType === 'mouse') return;
    if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return;
    swipe.current = { x: event.clientX, y: event.clientY, t: performance.now(), id: event.pointerId };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4 && performance.now() - start.t < 800) {
      if (dx < 0) next();
      else prev();
    }
  };

  // ── Marcapáginas ─────────────────────────────────────────────────────────
  const toggleBookmark = () => {
    if (bookmarkHere) setBookmarkKey(null);
    else if (primary) setBookmarkKey(primary.key);
  };
  const jumpToBookmark = () => {
    if (bookmarkIndex !== null && !bookmarkHere) goToPage(bookmarkIndex);
  };

  const indexPage = pages.findIndex((p) => p.kind === 'index');

  // «Recientes»: cada receta que se abre (cuando la página ya está quieta).
  const viewedRecipe = isOpen && !nav.flip && primary?.kind === 'recipe' ? primary.recipeId : null;
  const { recentRecipes } = prefs;
  useEffect(() => onViewRecipe(viewedRecipe), [viewedRecipe, onViewRecipe]);
  useEffect(() => {
    if (!viewedRecipe || recentRecipes[0] === viewedRecipe) return;
    const timer = window.setTimeout(() => setPref('recentRecipes', pushRecent(recentRecipes, viewedRecipe)), 1200);
    return () => window.clearTimeout(timer);
  }, [viewedRecipe, recentRecipes, setPref]);

  const goTo = (index: number) => {
    if (index < 0) return;
    if (isOpen) goToPage(index);
    else {
      openBook();
      goToPage(index, false);
    }
  };
  const menuItems = [
    { label: 'Mi álbum de insignias', icon: <Award />, onSelect: () => layout && goTo(layout.albumStart) },
    { label: 'Personalizar el libro', icon: <Palette />, onSelect: onPersonalize },
    ...(isOpen ? [{ label: 'Cerrar el libro', icon: <X />, onSelect: closeBook }] : []),
  ];

  const context = useMemo<BookContextValue | null>(
    () =>
      layout && {
        geometry,
        layout,
        recipesById,
        bookStartedAt: startedAt,
        goToPage: (index: number) => goToPage(index),
        onCreate,
        onEdit,
        onDelete,
        onToggleFavorite,
        onCooked,
        onCook,
        servingsFor: (recipe: Recipe) => servingsMap[recipe.id] ?? recipe.servings,
        setServings: (id: RecipeId, value: number) => setServingsMap((m) => ({ ...m, [id]: value })),
        highlightRecipeId: highlight,
      },
    [layout, geometry, recipesById, startedAt, goToPage, onCreate, onEdit, onDelete, onToggleFavorite, onCooked, onCook, servingsMap, highlight],
  );

  const outer = bookOuterSize(geometry);
  const pageLabel = primary?.number ? `Página ${primary.number} de ${pages[pages.length - 1]?.number ?? '—'}` : '';

  return (
    <div className={styles.scene} onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={() => (swipe.current = null)}>
      <header className={styles.toolbar}>
        <div className={styles.brand}>
          <BookOpenText aria-hidden="true" />
          <span>My Little Recipe Book</span>
        </div>
        {!isOpen && (
          <nav className={styles.actions} aria-label="Opciones">
            <MusicToggle compact={compactToolbar} />
            <OptionsMenu items={menuItems} />
          </nav>
        )}
        {isOpen && (
          <nav className={styles.actions} aria-label="Acciones del libro">
            <Button
              size="sm"
              icon={<BookOpen />}
              onClick={() => indexPage >= 0 && goToPage(indexPage)}
              aria-label="Ir al índice"
              title="Índice"
            >
              {!compactToolbar && 'Índice'}
            </Button>
            <Button
              size="sm"
              icon={bookmarkHere ? <BookmarkCheck /> : <Bookmark />}
              onClick={toggleBookmark}
              aria-pressed={bookmarkHere}
              aria-label={bookmarkHere ? 'Quitar el marcapáginas' : 'Marcar esta página'}
              title={bookmarkHere ? 'Quitar el marcapáginas' : 'Marcar esta página'}
            >
              {!compactToolbar && (bookmarkHere ? 'Marcada' : 'Marcar página')}
            </Button>
            <Button size="sm" icon={<Search />} onClick={() => setSearchOpen(true)} aria-label="Buscar recetas" title="Buscar">
              {!compactToolbar && 'Buscar'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<PenLine />}
              onClick={() => onCreate(currentCategory)}
              aria-label="Escribir una receta nueva"
            >
              Nueva receta
            </Button>
            <MusicToggle compact />
            <OptionsMenu items={menuItems} />
          </nav>
        )}
      </header>

      <main className={styles.stage}>
        {status === 'error' ? (
          <div className={`${styles.message} tex-paper`} role="alert">
            <p>{error}</p>
            <Button icon={<RotateCcw />} onClick={reload}>
              Reintentar
            </Button>
          </div>
        ) : layout && context ? (
          <>
            {spread && isOpen && (
              <IconButton label="Página anterior" className={styles.arrowPrev} onClick={prev} disabled={!nav.canPrev}>
                <ChevronLeft />
              </IconButton>
            )}
            <div
              className={styles.bookBox}
              style={{ width: outer.width * scale, height: outer.height * scale, '--ribbon': `var(--${prefs.ribbonColor})` } as CSSProperties}
            >
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <BookContext.Provider value={context}>
                  <Book
                    geometry={geometry}
                    layout={layout}
                    view={nav.view}
                    flip={nav.flip}
                    cover={cover}
                    reducedMotion={reducedMotion}
                    bookmarkIndex={bookmarkIndex}
                    onFlipDone={finishFlip}
                    onCoverDone={onCoverDone}
                    onCoverClick={openBook}
                    onTab={(index) => (isOpen ? goToPage(index) : (openBook(), goToPage(index, false)))}
                    onBookmarkJump={jumpToBookmark}
                    onNext={next}
                    onPrev={prev}
                    canNext={nav.canNext}
                    canPrev={nav.canPrev}
                  />
                </BookContext.Provider>
              </div>
            </div>
            {spread && isOpen && (
              <IconButton label="Página siguiente" className={styles.arrowNext} onClick={next} disabled={!nav.canNext}>
                <ChevronRight />
              </IconButton>
            )}
            {cover === 'closed' && (
              <Button
                variant="primary"
                icon={<BookOpen />}
                onClick={openBook}
                className={spread ? styles.openButtonSide : styles.openButton}
                style={spread ? { left: `calc(50% + ${(geometry.pageWidth * scale) / 2 + 30}px)` } : undefined}
              >
                Abrir el recetario
              </Button>
            )}
          </>
        ) : (
          <LoadingCover scale={scale} geometryWidth={geometry.pageWidth} geometryHeight={geometry.pageHeight} />
        )}
      </main>

      {!spread && isOpen && layout && (
        <nav className={styles.bottomNav} aria-label="Pasar página">
          <IconButton label="Página anterior" onClick={prev} disabled={!nav.canPrev}>
            <ChevronLeft />
          </IconButton>
          <span className={styles.pageInfo} aria-live="polite">
            {pageLabel}
          </span>
          <IconButton label="Página siguiente" onClick={next} disabled={!nav.canNext}>
            <ChevronRight />
          </IconButton>
        </nav>
      )}

      <p className="visually-hidden" aria-live="polite">
        {isOpen && pageLabel}
      </p>
      {layout && <Celebration onShowAlbum={() => goTo(layout.albumStart)} />}
      {searchOpen && layout && (
        <SearchDrawer
          onClose={() => setSearchOpen(false)}
          pageOf={(id) => layout.pages[layout.recipeStart[id]]?.number ?? null}
          onGo={(id) => {
            setSearchOpen(false);
            goTo(layout.recipeStart[id]);
          }}
        />
      )}
      {measurer}
    </div>
  );
}

/** Mientras se abren los datos: solo la tapa, en el mismo sitio. */
function LoadingCover({ scale, geometryWidth, geometryHeight }: { scale: number; geometryWidth: number; geometryHeight: number }) {
  const g = makeGeometry('single', geometryWidth, geometryHeight);
  return (
    <div
      className={styles.loading}
      style={{ ...geometryStyle(g), width: g.pageWidth * scale, height: g.pageHeight * scale }}
      aria-busy="true"
      aria-label="Abriendo el recetario"
    >
      <div style={{ width: g.pageWidth, height: g.pageHeight, transform: `scale(${scale})`, transformOrigin: 'top left', position: 'relative' }}>
        <BookCover />
      </div>
    </div>
  );
}
