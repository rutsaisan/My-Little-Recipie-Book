import { useId } from 'react';
import { HOLE_OFFSET, RING_PITCH, RING_START, ringCount } from './spiralGeometry';
import styles from './Spiral.module.css';

interface SpiralProps {
  /** `gutter`: en el centro del libro abierto; `edge`: en el borde izquierdo. */
  variant: 'gutter' | 'edge';
  height: number;
  /** Posición horizontal del lomo dentro del contenedor. */
  spineX?: number;
  className?: string;
}

/**
 * Espiral metálica (en tonos bronce de la paleta) que une las hojas.
 * Solo se dibuja la parte de cada anilla que queda por encima del papel; los
 * agujeros los pinta cada página, alineados con estas mismas medidas.
 */
export function Spiral({ variant, height, spineX = 0, className }: SpiralProps) {
  const gradientId = useId();
  const count = ringCount(height);
  const width = variant === 'gutter' ? 2 * HOLE_OFFSET + 20 : HOLE_OFFSET + 22;
  const rings = Array.from({ length: count }, (_, i) => RING_START + i * RING_PITCH);

  // Extremos de cada anilla (en coordenadas del SVG): en el centro van de un
  // agujero al otro; en el borde, del agujero a la parte exterior del canto.
  const a = variant === 'gutter' ? width / 2 - HOLE_OFFSET : width - 4;
  const b = variant === 'gutter' ? width / 2 + HOLE_OFFSET : 4;
  // El agujero queda a HOLE_OFFSET del lomo, igual que en las páginas.
  const left = variant === 'gutter' ? spineX - width / 2 : spineX + HOLE_OFFSET - a;

  return (
    <svg
      className={[styles.spiral, styles[variant], className].filter(Boolean).join(' ')}
      style={{ left }}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f0ea" />
          <stop offset="0.3" stopColor="#bb9c86" />
          <stop offset="0.68" stopColor="#7f5638" />
          <stop offset="1" stopColor="#4e2f21" />
        </linearGradient>
      </defs>
      {rings.map((y) =>
        variant === 'gutter' ? (
          <g key={y}>
            <path d={`M${a} ${y + 2.5} C${a} ${y - 8}, ${b} ${y - 8}, ${b} ${y + 2.5}`} className={styles.shadow} />
            <path d={`M${a} ${y} C${a} ${y - 11}, ${b} ${y - 11}, ${b} ${y}`} stroke={`url(#${gradientId})`} className={styles.ring} />
          </g>
        ) : (
          <g key={y}>
            <path d={`M${a} ${y + 2} C${a} ${y - 9}, ${b} ${y - 10}, ${b} ${y + 1}`} className={styles.shadow} />
            <path d={`M${b} ${y} C${b} ${y + 5}, ${b + 5} ${y + 7}, ${b + 11} ${y + 6}`} className={styles.back} />
            <path d={`M${a} ${y} C${a} ${y - 11}, ${b} ${y - 12}, ${b} ${y}`} stroke={`url(#${gradientId})`} className={styles.ring} />
          </g>
        ),
      )}
    </svg>
  );
}
