import type { CSSProperties } from 'react';
import { CHARACTERS, type CharacterId } from '../../assets/characters';
import styles from './Sticker.module.css';

interface StickerProps {
  id: CharacterId;
  /** Ancho en px (la altura sale de la proporción de la ilustración). */
  width: number;
  /** Inclinación en grados, como una pegatina puesta a mano. */
  tilt?: number;
  /** Pequeña animación en reposo. */
  motion?: 'bob' | 'breathe' | 'none';
  /** Retraso de la animación (s) para que no se muevan todas a la vez. */
  delay?: number;
  /** Sin borde blanco de pegatina (ilustraciones grandes). */
  plain?: boolean;
  /** Si es puramente decorativa, los lectores de pantalla la ignoran. */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Ilustración de un animalito recortada, con aspecto de pegatina. */
export function Sticker({
  id,
  width,
  tilt = 0,
  motion = 'none',
  delay = 0,
  plain = false,
  decorative = true,
  className,
  style,
}: StickerProps) {
  const art = CHARACTERS[id];
  const height = Math.round((width * art.height) / art.width);
  return (
    <span
      className={[styles.sticker, styles[motion], plain ? styles.plain : '', className].filter(Boolean).join(' ')}
      style={{ width, height, '--tilt': `${tilt}deg`, animationDelay: `${delay}s`, ...style } as CSSProperties}
    >
      <img
        src={art.src}
        alt={decorative ? '' : art.alt}
        width={width}
        height={height}
        draggable={false}
        decoding="async"
      />
    </span>
  );
}
