/**
 * Piezas con las que se compone una receta en las páginas del libro.
 *
 * Las mismas piezas se usan para MEDIR (en un contenedor invisible) y para
 * PINTAR, de modo que la paginación coincide al píxel con lo que se ve.
 */
import { ChefHat, Clock, CookingPot, Flame, Heart, Minus, Plus, Sparkles, Users } from 'lucide-react';
import { CHARACTERS, type CharacterId } from '../../assets/characters';
import { describeIngredient } from '../../domain/ingredients';
import { difficultyInfo, formatMinutes, type Ingredient, type Recipe, type RecipeStep } from '../../domain/recipe';
import { usePhotoUrl } from '../../hooks/usePhotoUrl';
import { useCategories } from '../../state/categoriesContext';
import { Divider, Tape } from '../decor/Ornaments';
import { Sticker } from '../decor/Sticker';
import styles from './RecipeBlocks.module.css';

// ── Cabecera ───────────────────────────────────────────────────────────────

interface HeaderProps {
  recipe: Recipe;
  /** Comensales mostrados (pueden ser distintos de los de la receta). */
  servings: number | null;
  onServingsChange?: (value: number) => void;
}

export function RecipeHeader({ recipe, servings, onServingsChange }: HeaderProps) {
  const cooked = recipe.cookedCount > 0;
  const hasMeta =
    recipe.prepMinutes !== null ||
    recipe.cookMinutes !== null ||
    servings !== null ||
    recipe.difficulty ||
    cooked ||
    recipe.toTry;
  return (
    <div className={styles.header}>
      <h2 className={styles.title}>
        {recipe.title}
        {recipe.favorite && (
          <Heart className={styles.titleHeart} aria-label="(favorita)" role="img" fill="currentColor" />
        )}
      </h2>
      <Divider motif="sprig" className={styles.titleDivider} />
      {hasMeta && (
        <ul className={styles.meta}>
          {cooked && (
            <li className={`${styles.metaItem} ${styles.stamp}`}>
              <CookingPot aria-hidden="true" />
              {recipe.cookedCount === 1 ? 'Cocinada 1 vez' : `Cocinada ${recipe.cookedCount} veces`}
            </li>
          )}
          {!cooked && recipe.toTry && (
            <li className={`${styles.metaItem} ${styles.stamp}`}>
              <Sparkles aria-hidden="true" />
              Por probar
            </li>
          )}
          {recipe.prepMinutes !== null && (
            <li className={styles.metaItem}>
              <Clock aria-hidden="true" />
              <span>
                <span className={styles.metaLabel}>Preparación</span> {formatMinutes(recipe.prepMinutes)}
              </span>
            </li>
          )}
          {recipe.cookMinutes !== null && (
            <li className={styles.metaItem}>
              <Flame aria-hidden="true" />
              <span>
                <span className={styles.metaLabel}>Cocción</span> {formatMinutes(recipe.cookMinutes)}
              </span>
            </li>
          )}
          {servings !== null && (
            <li className={styles.metaItem}>
              <Users aria-hidden="true" />
              <ServingsControl
                value={servings}
                original={recipe.servings}
                onChange={onServingsChange}
                title={recipe.title}
              />
            </li>
          )}
          {recipe.difficulty && (
            <li className={styles.metaItem}>
              <ChefHat aria-hidden="true" />
              <span>
                <span className={styles.metaLabel}>Dificultad</span> {difficultyInfo(recipe.difficulty).label}
              </span>
              <span className={styles.level} aria-hidden="true">
                {[1, 2, 3].map((n) => (
                  <i key={n} data-on={n <= difficultyInfo(recipe.difficulty!).level || undefined} />
                ))}
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function ServingsControl({
  value,
  original,
  onChange,
  title,
}: {
  value: number;
  original: number | null;
  onChange?: (value: number) => void;
  title: string;
}) {
  const changed = original !== null && value !== original;
  return (
    <span className={styles.servings} data-changed={changed || undefined}>
      <button
        type="button"
        className={styles.servingsButton}
        onClick={() => onChange?.(Math.max(1, value - 1))}
        disabled={!onChange || value <= 1}
        aria-label={`Menos comensales para ${title}`}
      >
        <Minus aria-hidden="true" />
      </button>
      <span
        className={styles.servingsValue}
        aria-live="polite"
        title={changed ? `Receta original: ${original} comensales` : undefined}
      >
        {value} {value === 1 ? 'comensal' : 'comensales'}
      </span>
      <button
        type="button"
        className={styles.servingsButton}
        onClick={() => onChange?.(Math.min(99, value + 1))}
        disabled={!onChange || value >= 99}
        aria-label={`Más comensales para ${title}`}
      >
        <Plus aria-hidden="true" />
      </button>
    </span>
  );
}

// ── Ingredientes ───────────────────────────────────────────────────────────

export function IngredientsHeading({ continued = false, empty = false }: { continued?: boolean; empty?: boolean }) {
  return (
    <div className={styles.sectionHeading}>
      <h3 className={styles.sectionTitle}>
        Ingredientes{continued && <span className={styles.continued}> (continuación)</span>}
      </h3>
      {empty && <p className={styles.emptyNote}>Esta receta no tiene ingredientes anotados.</p>}
    </div>
  );
}

export function IngredientLine({ ingredient, factor = 1 }: { ingredient: Ingredient; factor?: number }) {
  const text = describeIngredient(ingredient, factor);
  return (
    <li className={styles.ingredient}>
      <span className={styles.bullet} aria-hidden="true" />
      <span className={styles.ingredientText}>
        {text.amount && (
          <>
            <strong className={styles.amount}>{text.amount}</strong>{' '}
          </>
        )}
        {text.connector && `${text.connector} `}
        {text.name}
        {text.suffix && <em className={styles.suffix}> {text.suffix}</em>}
      </span>
    </li>
  );
}

// ── Foto del plato o ilustración junto a los ingredientes ─────────────────

/** Foto del plato (modo «foto final») o, si no hay, el animalito de la sección. */
export function IntroAside({ recipe, width }: { recipe: Recipe; width: number }) {
  const { getInfo } = useCategories();
  if (recipe.photoMode === 'final' && recipe.coverPhotoId) {
    return <Polaroid photoId={recipe.coverPhotoId} caption={recipe.title} />;
  }
  return (
    <div className={styles.asideArt}>
      <Sticker id={getInfo(recipe.categoryId).character} width={Math.round(width * 0.8)} tilt={-4} motion="bob" />
    </div>
  );
}

// ── Pegatina decorativa al pie ─────────────────────────────────────────────

const FOOT_STICKERS: CharacterId[] = [
  'raya-mini-mantequilla',
  'raya-mini-chocolate',
  'raya-corazon',
  'raya-mantequilla',
  'raya-nata-fresa',
  'raya-platano',
  'nutria-croissant',
  'raton-chef',
];

const FOOT_CAPTIONS = ['¡Que aproveche!', 'Hecho con cariño', 'Para compartir', '¡A disfrutar!', 'Mmm…', 'Receta de la casa'];

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Animalito que decora el hueco libre al final de una receta (siempre el mismo para cada receta). */
export function FootSticker({ recipeId, height }: { recipeId: string; height: number }) {
  const h = hash(recipeId);
  const character = FOOT_STICKERS[h % FOOT_STICKERS.length];
  const caption = FOOT_CAPTIONS[(h >> 3) % FOOT_CAPTIONS.length];
  const art = CHARACTERS[character];
  const width = Math.round(Math.min(height * 1.1, ((height - 16) * art.width) / art.height));
  return (
    <div className={styles.foot} style={{ height }} aria-hidden="true">
      <span className={styles.footCaption}>{caption}</span>
      <Sticker id={character} width={width} tilt={h % 2 ? 7 : -6} motion="bob" />
    </div>
  );
}

function Polaroid({ photoId, caption }: { photoId: string; caption: string }) {
  const url = usePhotoUrl(photoId);
  return (
    <figure className={styles.polaroid}>
      <Tape className={styles.polaroidTape} />
      <div className={styles.photoBox}>
        {url && <img src={url} alt={`Foto del plato: ${caption}`} decoding="async" />}
      </div>
      <figcaption className={styles.polaroidCaption}>{caption}</figcaption>
    </figure>
  );
}

// ── Elaboración ────────────────────────────────────────────────────────────

export function MethodHeading({ continued = false }: { continued?: boolean }) {
  return (
    <div className={styles.sectionHeading}>
      <h3 className={styles.sectionTitle}>
        Elaboración{continued && <span className={styles.continued}> (continuación)</span>}
      </h3>
    </div>
  );
}

export function StepItem({ step, number, showPhoto }: { step: RecipeStep; number: number; showPhoto: boolean }) {
  return (
    <li className={styles.step}>
      <span className={styles.stepNumber} aria-label={`Paso ${number}`}>
        {number}
      </span>
      <div className={styles.stepBody}>
        <p className={styles.stepText}>{step.text}</p>
        {showPhoto && step.photoId && <StepPhoto photoId={step.photoId} number={number} />}
      </div>
    </li>
  );
}

function StepPhoto({ photoId, number }: { photoId: string; number: number }) {
  const url = usePhotoUrl(photoId);
  return (
    <figure className={styles.stepPhoto}>
      {url && <img src={url} alt={`Foto del paso ${number}`} decoding="async" />}
    </figure>
  );
}

// ── Notas ──────────────────────────────────────────────────────────────────

export function NotesBlock({ notes }: { notes: string }) {
  return (
    <aside className={styles.notes}>
      <Tape className={styles.notesTape} />
      <h3 className={styles.notesTitle}>Notas</h3>
      <p className={styles.notesText}>{notes}</p>
    </aside>
  );
}
