import type { CSSProperties } from 'react';
import styles from './Ornaments.module.css';

/** Esquina ornamental con una ramita, dibujada para la esquina superior izquierda. */
export function CornerFlourish({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      className={[styles.corner, className].filter(Boolean).join(' ')}
      style={style}
      viewBox="0 0 60 60"
      aria-hidden="true"
      focusable="false"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M3 36 V13 C3 7.5 7.5 3 13 3 H36" strokeWidth="1.5" />
        <path d="M9 40 V17 C9 12.6 12.6 9 17 9 H40" strokeWidth="0.9" opacity="0.55" />
      </g>
      <g fill="currentColor">
        <circle cx="39.5" cy="3" r="1.7" />
        <circle cx="3" cy="39.5" r="1.7" />
        <circle cx="43.5" cy="9" r="1.1" opacity="0.6" />
        <circle cx="9" cy="43.5" r="1.1" opacity="0.6" />
        <path d="M17 17 C21 12.5 27 12 30 14.5 C26 16.6 21.5 17.6 17 17 Z" opacity="0.85" />
        <path d="M17 17 C12.5 21 12 27 14.5 30 C16.6 26 17.6 21.5 17 17 Z" opacity="0.85" />
        <circle cx="17" cy="17" r="2.3" />
      </g>
    </svg>
  );
}

type Motif = 'heart' | 'sprig' | 'dots';

/** Línea separadora con un motivo central. */
export function Divider({ motif = 'heart', className }: { motif?: Motif; className?: string }) {
  return (
    <svg
      className={[styles.divider, className].filter(Boolean).join(' ')}
      viewBox="0 0 200 16"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeLinecap="round" fill="none">
        <path d="M8 8 H80" strokeWidth="1.1" />
        <path d="M120 8 H192" strokeWidth="1.1" />
      </g>
      <g fill="currentColor">
        <circle cx="4" cy="8" r="1.4" />
        <circle cx="196" cy="8" r="1.4" />
        <path d="M86 8 l2.6 -2.6 l2.6 2.6 l-2.6 2.6 z" />
        <path d="M109 8 l2.6 -2.6 l2.6 2.6 l-2.6 2.6 z" />
        {motif === 'heart' && (
          <path d="M100 14 C92.5 8.6 93.4 2.6 97.4 2.9 C99 3 100 4.4 100 5.6 C100 4.4 101 3 102.6 2.9 C106.6 2.6 107.5 8.6 100 14 Z" />
        )}
        {motif === 'sprig' && (
          <>
            <path d="M100 13 C99.5 9 100 5 100.5 2" stroke="currentColor" strokeWidth="1" fill="none" />
            <path d="M100.2 9.5 C96 9.5 94 6.8 94.4 5 C97.4 5.3 99.6 7 100.2 9.5 Z" />
            <path d="M100.4 7 C104 6.4 105.6 4 105.4 2.4 C102.6 2.8 100.8 4.6 100.4 7 Z" />
          </>
        )}
        {motif === 'dots' && (
          <>
            <circle cx="95" cy="8" r="1.6" />
            <circle cx="100" cy="8" r="2.2" />
            <circle cx="105" cy="8" r="1.6" />
          </>
        )}
      </g>
    </svg>
  );
}

/** Tira de cinta adhesiva decorativa (washi tape). */
export function Tape({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span className={[styles.tape, className].filter(Boolean).join(' ')} style={style} aria-hidden="true" />;
}
