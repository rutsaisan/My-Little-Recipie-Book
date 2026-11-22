/**
 * Buscador del recetario: busca por nombre, ingrediente o notas y filtra por
 * favoritas, recientes, por probar, cocinadas y sección.
 */
import { Heart, Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { RecipeId } from '../../domain/recipe';
import { RECIPE_VIEWS, searchRecipes, type RecipeView } from '../../domain/search';
import { useCategories } from '../../state/categoriesContext';
import { usePreferences } from '../../state/preferencesContext';
import { useRecipes } from '../../state/recipesContext';
import { Sticker } from '../decor/Sticker';
import { IconButton } from '../ui/Button';
import styles from './SearchDrawer.module.css';

interface SearchDrawerProps {
  onClose: () => void;
  onGo: (recipeId: RecipeId) => void;
  pageOf: (recipeId: RecipeId) => number | null;
}

const EMPTY_TEXT: Record<RecipeView, string> = {
  all: 'No hay ninguna receta que coincida.',
  favorites: 'Aún no has marcado favoritas: pulsa el corazón en la página de una receta.',
  recent: 'Todavía no has abierto ninguna receta.',
  toTry: 'No tienes recetas pendientes de probar.',
  cooked: 'Cuando cocines una receta, pulsa la olla en su página y aparecerá aquí.',
};

export function SearchDrawer({ onClose, onGo, pageOf }: SearchDrawerProps) {
  const { recipes } = useRecipes();
  const { categories, getInfo } = useCategories();
  const { prefs } = usePreferences();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<RecipeView>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const usedCategories = useMemo(() => {
    const used = new Set(recipes.map((r) => r.categoryId));
    return categories.filter((c) => used.has(c.id));
  }, [recipes, categories]);

  const results = useMemo(
    () => searchRecipes(recipes, { query, view, categoryId, recent: prefs.recentRecipes }),
    [recipes, query, view, categoryId, prefs.recentRecipes],
  );

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className={`${styles.drawer} tex-paper`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            Buscar en el recetario
          </h2>
          <IconButton label="Cerrar el buscador" variant="plain" onClick={onClose}>
            <X />
          </IconButton>
        </header>

        <label className={styles.searchBox}>
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre, ingrediente o nota…"
            aria-label="Buscar recetas"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) onGo(results[0].id);
            }}
          />
        </label>

        <div className={styles.chips} role="group" aria-label="Mostrar">
          {RECIPE_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              className={styles.chip}
              aria-pressed={view === v.id}
              onClick={() => setView(v.id)}
            >
              {v.id === 'favorites' && <Heart aria-hidden="true" />}
              {v.label}
            </button>
          ))}
        </div>

        {usedCategories.length > 1 && (
          <div className={styles.chips} role="group" aria-label="Sección">
            <button type="button" className={styles.chip} aria-pressed={categoryId === null} onClick={() => setCategoryId(null)}>
              Todas las secciones
            </button>
            {usedCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={styles.chip}
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
              >
                <Sticker id={c.character} width={20} />
                {c.shortName}
              </button>
            ))}
          </div>
        )}

        <ol className={styles.results} aria-live="polite">
          {results.map((r) => {
            const info = getInfo(r.categoryId);
            const page = pageOf(r.id);
            return (
              <li key={r.id}>
                <button type="button" className={styles.result} onClick={() => onGo(r.id)}>
                  <Sticker id={info.character} width={38} />
                  <span className={styles.resultText}>
                    <span className={styles.resultTitle}>
                      {r.title}
                      {r.favorite && <Heart className={styles.heart} fill="currentColor" aria-label="(favorita)" />}
                    </span>
                    <span className={styles.resultMeta}>
                      {info.name}
                      {r.cookedCount > 0 && ` · cocinada ${r.cookedCount === 1 ? '1 vez' : `${r.cookedCount} veces`}`}
                      {r.toTry && ' · por probar'}
                    </span>
                  </span>
                  {page !== null && <span className={styles.page}>pág. {page}</span>}
                </button>
              </li>
            );
          })}
        </ol>
        {results.length === 0 && (
          <div className={styles.empty}>
            <Sticker id="raton-chef" width={90} motion="bob" />
            <p>{recipes.length === 0 ? 'Tu libro aún no tiene recetas.' : query ? EMPTY_TEXT.all : EMPTY_TEXT[view]}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
