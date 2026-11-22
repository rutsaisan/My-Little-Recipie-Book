import { Lock } from 'lucide-react';
import { ACHIEVEMENTS, getAchievement, type AchievementDef, type BookStats } from '../../domain/achievements';
import type { BookPage } from '../../layout/types';
import { useAchievements } from '../../state/achievementsContext';
import { useBook } from '../book/bookContext';
import { Divider } from '../decor/Ornaments';
import { Sticker } from '../decor/Sticker';
import { PageFrame, type PageSide } from './PageFrame';
import styles from './AlbumPage.module.css';

type AlbumBookPage = Extract<BookPage, { kind: 'album' }>;

const dateFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

/** Página del álbum: casillas con las pegatinas conseguidas y las que faltan. */
export function AlbumPage({ page, side }: { page: AlbumBookPage; side: PageSide }) {
  const { unlocked, stats } = useAchievements();
  const { geometry } = useBook();
  const got = ACHIEVEMENTS.filter((a) => unlocked.has(a.id)).length;

  return (
    <PageFrame side={side} number={page.number} head={<span className={styles.kicker}>Álbum</span>} label="Álbum de insignias">
      <div className={styles.album}>
        {page.part === 0 && (
          <div className={styles.header} style={{ height: geometry.albumHeaderHeight }}>
            <h2 className={styles.title}>Mi álbum de insignias</h2>
            <p className={styles.counters}>
              <strong>{got}</strong> de {ACHIEVEMENTS.length} pegatinas
              <span aria-hidden="true"> · </span>
              <strong>{stats.cooked}</strong> {stats.cooked === 1 ? 'receta completada' : 'recetas completadas'}
            </p>
            <Divider motif="heart" className={styles.divider} />
          </div>
        )}
        <ul
          className={styles.grid}
          style={{
            gridTemplateColumns: `repeat(${geometry.albumColumns}, minmax(0, 1fr))`,
            gridAutoRows: geometry.albumSlotHeight,
          }}
        >
          {page.items.map((id) => {
            const def = getAchievement(id);
            return def ? <AlbumSlot key={id} def={def} unlockedAt={unlocked.get(id)} stats={stats} /> : null;
          })}
        </ul>
      </div>
    </PageFrame>
  );
}

function AlbumSlot({ def, unlockedAt, stats }: { def: AchievementDef; unlockedAt?: number; stats: BookStats }) {
  const done = unlockedAt !== undefined;
  const { value, target } = def.progress(stats);
  return (
    <li className={`${styles.slot} ${done ? styles.done : styles.locked}`}>
      <div className={styles.art}>
        <Sticker id={def.character} width={70} tilt={done ? -5 : 0} motion={done ? 'bob' : 'none'} className={styles.sticker} />
        {!done && <Lock className={styles.lock} aria-hidden="true" />}
      </div>
      <p className={styles.name}>{def.title}</p>
      <p className={styles.detail}>
        {done ? (
          <>
            {def.reward ?? def.description}
            <span className={styles.date}>{dateFormat.format(unlockedAt)}</span>
          </>
        ) : (
          <>
            {def.goal}
            {target > 1 && (
              <span className={styles.progress}>
                {value}/{target}
              </span>
            )}
          </>
        )}
      </p>
      <span className="visually-hidden">{done ? 'Conseguida' : 'Aún por conseguir'}</span>
    </li>
  );
}
