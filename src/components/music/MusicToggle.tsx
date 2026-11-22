import { Music, VolumeX } from 'lucide-react';
import { useAmbientMusic } from './useAmbientMusic';
import styles from './MusicToggle.module.css';

/** Botón de la música (arriba a la derecha): muestra si suena o no. */
export function MusicToggle({ compact = false }: { compact?: boolean }) {
  const { enabled, toggle } = useAmbientMusic();
  const label = enabled ? 'Música activada (pulsa para silenciar)' : 'Música en silencio (pulsa para activarla)';
  return (
    <button
      type="button"
      className={`${styles.toggle} ${enabled ? styles.on : ''}`}
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
    >
      {enabled ? <Music aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
      {!compact && <span className={styles.text}>{enabled ? 'Música' : 'Silencio'}</span>}
      {enabled && (
        <span className={styles.bars} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </button>
  );
}
