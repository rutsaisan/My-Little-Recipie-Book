import { Award, PenLine } from 'lucide-react';
import type { BookPage, IndexEntry } from '../../layout/types';
import { ALBUM_LABEL } from '../../layout/labels';
import { useCategories } from '../../state/categoriesContext';
import { useBook } from '../book/bookContext';
import { Divider } from '../decor/Ornaments';
import { Sticker } from '../decor/Sticker';
import { Button } from '../ui/Button';
import { PageFrame, type PageSide } from './PageFrame';
import styles from './IndexPage.module.css';

type IndexBookPage = Extract<BookPage, { kind: 'index' }>;

/** Título del índice (se mide para paginar). */
export function IndexTitle({ continued }: { continued: boolean }) {
  return (
    <div className={styles.title}>
      <h2 className={styles.titleText}>
        Índice{continued && <span className={styles.cont}> (continuación)</span>}
      </h2>
      {!continued && <Divider motif="dots" className={styles.titleDivider} />}
    </div>
  );
}

interface EntryProps {
  entry: IndexEntry;
  label: string;
  number?: number | null;
  onGo?: () => void;
}

/** Una línea del índice: sección, receta o álbum, con su número de página. */
export function IndexEntryLine({ entry, label, number, onGo }: EntryProps) {
  const { getInfo } = useCategories();
  if (entry.type === 'category') {
    return (
      <li className={styles.category}>
        <span className={styles.swatch} style={{ background: getInfo(entry.categoryId).color }} />
        <button type="button" className={styles.categoryButton} onClick={onGo} tabIndex={onGo ? 0 : -1}>
          {label}
        </button>
      </li>
    );
  }
  const album = entry.type === 'album';
  return (
    <li className={album ? styles.albumLine : styles.recipe}>
      <button type="button" className={styles.recipeButton} onClick={onGo} tabIndex={onGo ? 0 : -1}>
        {album && <Award className={styles.albumIcon} aria-hidden="true" />}
        <span className={styles.recipeTitle}>{label}</span>
        <span className={styles.leader} aria-hidden="true" />
        <span className={styles.number}>{number ?? ''}</span>
      </button>
    </li>
  );
}

export function IndexPage({ page, side }: { page: IndexBookPage; side: PageSide }) {
  const { layout, recipesById, goToPage, onCreate } = useBook();
  const { getInfo } = useCategories();
  const empty = layout.sections.length === 0;
  const albumNumber = layout.pages[layout.albumStart]?.number ?? null;

  const labelOf = (entry: IndexEntry) =>
    entry.type === 'category'
      ? getInfo(entry.categoryId).name
      : entry.type === 'recipe'
        ? (recipesById.get(entry.recipeId)?.title ?? '')
        : ALBUM_LABEL;

  const numberOf = (entry: IndexEntry) =>
    entry.type === 'recipe' ? layout.pages[layout.recipeStart[entry.recipeId]]?.number : entry.type === 'album' ? albumNumber : null;

  const go = (entry: IndexEntry) => {
    const target =
      entry.type === 'category'
        ? layout.sectionStart[entry.categoryId]
        : entry.type === 'recipe'
          ? layout.recipeStart[entry.recipeId]
          : layout.albumStart;
    if (target !== undefined) goToPage(target);
  };

  return (
    <PageFrame side={side} number={page.number} head={<span className={styles.kicker}>Índice</span>} label="Índice">
      {empty ? (
        <div className={styles.empty}>
          <IndexTitle continued={false} />
          <Sticker id="serpiente-canela" width={190} motion="breathe" className={styles.emptySticker} />
          <p className={styles.emptyTitle}>Tu recetario está esperando su primera receta</p>
          <p className={styles.emptyText}>
            Escribe tus platos favoritos y se irán colocando aquí, ordenados por secciones.
          </p>
          <Button variant="primary" icon={<PenLine />} onClick={() => onCreate()}>
            Escribir mi primera receta
          </Button>
          <button type="button" className={styles.emptyAlbum} onClick={() => goToPage(layout.albumStart)}>
            <Award aria-hidden="true" /> {ALBUM_LABEL}
            {albumNumber !== null && <span>· pág. {albumNumber}</span>}
          </button>
        </div>
      ) : (
        <div className={styles.block}>
          <IndexTitle continued={page.part > 0} />
          <ol className={styles.list}>
            {page.entries.map((entry) => (
              <IndexEntryLine
                key={
                  entry.type === 'category'
                    ? `c-${entry.categoryId}`
                    : entry.type === 'recipe'
                      ? `r-${entry.recipeId}`
                      : 'album'
                }
                entry={entry}
                label={labelOf(entry)}
                number={numberOf(entry)}
                onGo={() => go(entry)}
              />
            ))}
          </ol>
        </div>
      )}
    </PageFrame>
  );
}
