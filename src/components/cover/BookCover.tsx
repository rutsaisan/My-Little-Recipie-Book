import type { CSSProperties } from 'react';
import { DEFAULT_DEDICATION, usePreferences } from '../../state/preferencesContext';
import { Sticker } from '../decor/Sticker';
import styles from './BookCover.module.css';

/** Huecos para pegatinas en la portada (lejos de la etiqueta y del gorro). */
const SLOTS: { style: CSSProperties; width: number; tilt: number }[] = [
  { style: { top: '4%', right: '7%' }, width: 66, tilt: -12 },
  { style: { bottom: '6%', right: '7%' }, width: 112, tilt: 9 },
  { style: { bottom: '7%', left: '12%' }, width: 96, tilt: -8 },
  { style: { top: '47%', right: '4%' }, width: 72, tilt: 14 },
];

/**
 * Tapa del cuaderno, inspirada en la portada de referencia: tela vichy beige,
 * espiral a la izquierda y gorro de cocinero en el centro, con su etiqueta.
 * Las pegatinas que se ganan con las insignias se pegan en sus huecos.
 */
export function BookCover({ compact = false }: { compact?: boolean }) {
  const { prefs } = usePreferences();
  const k = compact ? 0.8 : 1;
  return (
    <div className={`${styles.cover} tex-gingham`}>
      <div className={styles.holes} aria-hidden="true" />
      <div className={`${styles.label} tex-paper`}>
        <p className={styles.small}>My Little</p>
        <h1 className={styles.title}>Recipe Book</h1>
        <p className={styles.tagline}>{prefs.dedication.trim() || DEFAULT_DEDICATION}</p>
      </div>
      <Sticker id="gorro-chef" width={compact ? 220 : 290} plain motion="breathe" className={styles.hat} decorative={false} />
      {prefs.coverStickers.map((id, i) =>
        id ? (
          <Sticker
            key={`${i}-${id}`}
            id={id}
            width={Math.round(SLOTS[i].width * k)}
            tilt={SLOTS[i].tilt}
            className={styles.coverSticker}
            style={SLOTS[i].style}
          />
        ) : null,
      )}
      <div className={styles.sheen} aria-hidden="true" />
    </div>
  );
}
