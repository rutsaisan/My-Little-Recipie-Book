/**
 * Páginas que no son recetas: portadilla, separadores de sección, láminas,
 * páginas decorativas, «nueva receta» y guardas (interior de las tapas).
 */
import { PenLine, Plus } from 'lucide-react';
import type React from 'react';
import { CHARACTERS, type CharacterId } from '../../assets/characters';
import type { CategoryId } from '../../domain/categories';
import { useAchievements } from '../../state/achievementsContext';
import { useCategories } from '../../state/categoriesContext';
import { usePreferences } from '../../state/preferencesContext';
import { useBook } from '../book/bookContext';
import { CornerFlourish, Divider } from '../decor/Ornaments';
import { Sticker } from '../decor/Sticker';
import { Button } from '../ui/Button';
import { PageFrame, type PageSide } from './PageFrame';
import styles from './SpecialPages.module.css';

/** Ancho para que la ilustración no supere `maxHeight` ni `maxWidth`. */
function fitWidth(id: CharacterId, maxWidth: number, maxHeight: number): number {
  const art = CHARACTERS[id];
  return Math.round(Math.min(maxWidth, (maxHeight * art.width) / art.height));
}

const monthYear = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });

// ── Portadilla ─────────────────────────────────────────────────────────────

export function TitlePage({ side }: { side: PageSide }) {
  const { bookStartedAt, recipesById, geometry } = useBook();
  const { prefs } = usePreferences();
  const { stats } = useAchievements();
  const count = recipesById.size;
  const compact = geometry.bodyHeight < 520;
  const tiny = geometry.bodyHeight < 450;
  return (
    <PageFrame side={side} corners={false} label="Portadilla">
      <div className={styles.titlePage}>
        <CornerFlourish className={`${styles.frameCorner} ${styles.tl}`} />
        <CornerFlourish className={`${styles.frameCorner} ${styles.tr}`} />
        <CornerFlourish className={`${styles.frameCorner} ${styles.bl}`} />
        <CornerFlourish className={`${styles.frameCorner} ${styles.br}`} />
        <Sticker id="gorro-chef" width={compact ? 84 : 104} motion="breathe" plain />
        <p className={styles.titleSmall}>My Little</p>
        <h1 className={styles.titleBig}>Recipe Book</h1>
        <Divider motif="heart" className={styles.titleDivider} />
        <p className={styles.subtitle}>Recetas hechas con cariño</p>
        {prefs.ownerName.trim() && (
          <p className={styles.owner}>
            de <span className={styles.ownerName}>{prefs.ownerName.trim()}</span>
          </p>
        )}
        {!tiny && (
        <Sticker
          id="gato-calico-chef"
          width={fitWidth('gato-calico-chef', 200, compact ? 120 : 170)}
          motion="bob"
          className={styles.titleCat}
        />
        )}
        {bookStartedAt && <p className={styles.started}>Comenzado en {monthYear.format(new Date(bookStartedAt))}</p>}
        <p className={styles.count}>
          {count === 0 ? 'Aún sin recetas' : count === 1 ? '1 receta guardada' : `${count} recetas guardadas`}
          {stats.cooked > 0 && ` · ${stats.cooked} cocinadas`}
        </p>
      </div>
    </PageFrame>
  );
}

// ── Separador de sección ───────────────────────────────────────────────────

export function SectionPage({ categoryId, number, side }: { categoryId: CategoryId; number: number | null; side: PageSide }) {
  const { layout, recipesById, goToPage, onCreate, geometry } = useBook();
  const art = useCategories().getInfo(categoryId);
  const category = art;
  const section = layout.sections.find((s) => s.categoryId === categoryId);
  const ids = section?.recipeIds ?? [];
  const maxItems = Math.max(2, Math.floor((geometry.bodyHeight - 360) / 27));
  const shown = ids.slice(0, ids.length > maxItems ? maxItems - 1 : maxItems);
  const more = ids.length - shown.length;

  return (
    <PageFrame side={side} number={number} surface="gingham" label={`Sección ${category.name}`}>
      <div className={`${styles.sectionCard} tex-paper`}>
        <Sticker
          id={art.character}
          width={fitWidth(art.character, 190, geometry.bodyHeight < 520 ? 96 : 130)}
          motion="bob"
          className={styles.sectionSticker}
        />
        <p className={styles.sectionKicker}>Sección</p>
        <h2 className={styles.sectionTitle}>{category.name}</h2>
        <p className={styles.sectionPhrase}>{art.phrase}</p>
        <Divider motif="heart" className={styles.sectionDivider} />
        <ol className={styles.sectionList}>
          {shown.map((id) => {
            const start = layout.recipeStart[id];
            return (
              <li key={id}>
                <button type="button" className={styles.sectionItem} onClick={() => goToPage(start)}>
                  <span className={styles.sectionItemTitle}>{recipesById.get(id)?.title}</span>
                  <span className={styles.sectionItemNumber}>{layout.pages[start]?.number}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {more > 0 && <p className={styles.more}>y {more} más en el índice</p>}
        <Button size="sm" icon={<Plus />} onClick={() => onCreate(categoryId)} className={styles.sectionAdd}>
          Añadir receta aquí
        </Button>
      </div>
    </PageFrame>
  );
}

// ── Lámina ilustrada (frente a un separador) ───────────────────────────────

export function ArtPage({ categoryId, number, side }: { categoryId: CategoryId; number: number | null; side: PageSide }) {
  const { geometry } = useBook();
  const art = useCategories().getInfo(categoryId);
  const category = art;
  const size = Math.min(geometry.bodyWidth * 0.8, geometry.bodyHeight * 0.5);
  return (
    <PageFrame side={side} number={number} label={`Lámina de ${category.name}`}>
      <div className={styles.art}>
        <div className={styles.plate} style={{ width: size * 1.15, height: size * 1.15 }}>
          <Sticker id={art.character} width={fitWidth(art.character, size, size * 0.9)} motion="breathe" plain />
        </div>
        <p className={styles.artName}>{category.name}</p>
        <Divider motif="sprig" className={styles.artDivider} />
      </div>
    </PageFrame>
  );
}

// ── Página decorativa ──────────────────────────────────────────────────────

const QUOTES = [
  'Cocinar es una forma de querer.',
  'Una pizca de paciencia, una taza de cariño.',
  'Lo que se cocina con calma sabe mejor.',
  'Aquí huele a bizcocho recién hecho.',
  'Las mejores recetas se comparten.',
  'Despacito y con buena mano.',
];

const FILLER_ART: CharacterId[] = [
  'raya-mantequilla',
  'nutria-croissant',
  'raya-platano',
  'raton-chef',
  'raya-nata-fresa',
  'raya-chocolate-frutos',
  'raya-plancha',
  'raya-sarten',
];

export function FillerPage({ seed, number, side }: { seed: number; number: number | null; side: PageSide }) {
  const character = FILLER_ART[seed % FILLER_ART.length];
  return (
    <PageFrame side={side} number={number}>
      <div className={styles.filler}>
        <Sticker id={character} width={fitWidth(character, 190, 170)} tilt={seed % 2 ? 5 : -5} motion="bob" />
        <p className={styles.quote}>{QUOTES[seed % QUOTES.length]}</p>
        <Divider motif="dots" className={styles.fillerDivider} />
      </div>
    </PageFrame>
  );
}

// ── Nueva receta (al final del libro) ──────────────────────────────────────

export function NewRecipePage({ number, side }: { number: number | null; side: PageSide }) {
  const { onCreate } = useBook();
  return (
    <PageFrame side={side} number={number} label="Página para una receta nueva">
      <div className={styles.newRecipe}>
        <p className={styles.newKicker}>Página en blanco</p>
        <h2 className={styles.newTitle}>¿Qué cocinamos hoy?</h2>
        <Sticker id="nutria-croissant" width={fitWidth('nutria-croissant', 210, 190)} motion="bob" />
        <p className={styles.newText}>Escribe una receta nueva y se colocará sola en su sección del libro.</p>
        <Button variant="primary" icon={<PenLine />} onClick={() => onCreate()}>
          Escribir una receta
        </Button>
      </div>
    </PageFrame>
  );
}

// ── Guardas ────────────────────────────────────────────────────────────────

/** Sitios donde se pegan las pegatinas ganadas en la guarda delantera. */
const ENDPAPER_SPOTS: { style: React.CSSProperties; width: number; tilt: number }[] = [
  { style: { top: '4%', left: '6%' }, width: 74, tilt: -10 },
  { style: { top: '6%', right: '8%' }, width: 64, tilt: 8 },
  { style: { bottom: '8%', left: '10%' }, width: 80, tilt: 6 },
  { style: { bottom: '6%', right: '6%' }, width: 70, tilt: -7 },
  { style: { top: '38%', left: '0%' }, width: 56, tilt: 12 },
  { style: { top: '36%', right: '0%' }, width: 56, tilt: -12 },
];

export function EndpaperPage({ side, back = false }: { side: PageSide; back?: boolean }) {
  const { prefs } = usePreferences();
  const { unlocked, stickers } = useAchievements();
  // Las pegatinas más recientes, como si se hubieran ido pegando en la tapa.
  const recent = [...stickers]
    .map((id, order) => ({ id, order }))
    .sort((a, b) => b.order - a.order)
    .slice(0, unlocked.size ? ENDPAPER_SPOTS.length : 0);
  const owner = prefs.ownerName.trim();
  return (
    <PageFrame side={side} surface="gingham" corners={false} label={back ? 'Contraportada interior' : 'Portada interior'}>
      <div className={styles.endpaper}>
        {back ? (
          <Sticker id="raya-mini-chocolate" width={74} tilt={10} className={styles.endSticker} />
        ) : (
          <>
            {recent.map(({ id }, i) => (
              <Sticker
                key={id}
                id={id}
                width={ENDPAPER_SPOTS[i].width}
                tilt={ENDPAPER_SPOTS[i].tilt}
                className={styles.endpaperSticker}
                style={ENDPAPER_SPOTS[i].style}
              />
            ))}
            <div className={`${styles.bookplate} tex-paper`}>
              <Sticker id="gorro-chef" width={70} plain />
              <p className={styles.bookplateSmall}>ex libris</p>
              <p className={styles.bookplateTitle}>{owner || 'My Little Recipe Book'}</p>
            </div>
          </>
        )}
      </div>
    </PageFrame>
  );
}