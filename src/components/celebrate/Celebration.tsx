import { Award, X } from 'lucide-react';
import { useEffect, type CSSProperties } from 'react';
import { useAchievements } from '../../state/achievementsContext';
import { Sticker } from '../decor/Sticker';
import styles from './Celebration.module.css';

/**
 * Tarjeta que celebra una insignia nueva. No bloquea nada: se puede seguir
 * usando el libro y desaparece sola a los pocos segundos.
 */
export function Celebration({ onShowAlbum }: { onShowAlbum: () => void }) {
  const { celebration, dismissCelebration } = useAchievements();

  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(dismissCelebration, 8000);
    return () => window.clearTimeout(timer);
  }, [celebration, dismissCelebration]);

  if (!celebration) return null;
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div key={celebration.id} className={`${styles.card} tex-paper`}>
        <div className={styles.burst} aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <i key={i} style={{ '--a': `${i * 36}deg` } as CSSProperties} />
          ))}
        </div>
        <Sticker id={celebration.character} width={96} motion="bob" className={styles.sticker} />
        <div className={styles.text}>
          <p className={styles.kicker}>¡Nueva insignia!</p>
          <p className={styles.title}>{celebration.title}</p>
          <p className={styles.desc}>{celebration.description}</p>
          {celebration.reward && <p className={styles.reward}>{celebration.reward}</p>}
          <button
            type="button"
            className={styles.album}
            onClick={() => {
              dismissCelebration();
              onShowAlbum();
            }}
          >
            <Award aria-hidden="true" /> Ver mi álbum
          </button>
        </div>
        <button type="button" className={styles.close} onClick={dismissCelebration} aria-label="Cerrar">
          <X />
        </button>
      </div>
    </div>
  );
}
