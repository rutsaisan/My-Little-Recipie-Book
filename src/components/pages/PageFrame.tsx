import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { CornerFlourish } from '../decor/Ornaments';
import styles from './PageFrame.module.css';

export type PageSide = 'left' | 'right' | 'single';

interface PageFrameProps {
  side: PageSide;
  /** Número impreso al pie (null = sin número). */
  number?: number | null;
  /** Contenido de la cabecera (sección, acciones…). */
  head?: ReactNode;
  /** Papel normal, cartulina vichy (separadores, guardas) o lámina. */
  surface?: 'paper' | 'gingham';
  corners?: boolean;
  label?: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Hoja del cuaderno: papel con textura, agujeros de la espiral en el lado
 * interior, esquinas ornamentales, cabecera y número de página.
 */
export function PageFrame({
  side,
  number = null,
  head,
  surface = 'paper',
  corners = true,
  label,
  className,
  children,
}: PageFrameProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  // Red de seguridad: si algo no cupiera, la página se puede desplazar.
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const check = () => setOverflowing(body.scrollHeight > body.clientHeight + 2);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(body);
    return () => observer.disconnect();
  }, [children]);

  return (
    <article
      className={[styles.page, styles[side], styles[surface], className].filter(Boolean).join(' ')}
      aria-label={label}
    >
      <div className={`${styles.surface} ${surface === 'gingham' ? 'tex-gingham' : 'tex-paper'}`} aria-hidden="true" />
      <div className={styles.holes} aria-hidden="true" />
      <div className={styles.gutter} aria-hidden="true" />
      {corners && (
        <>
          <CornerFlourish className={`${styles.corner} ${styles.cornerTop}`} />
          <CornerFlourish className={`${styles.corner} ${styles.cornerBottom}`} />
        </>
      )}
      <header className={styles.head}>{head}</header>
      <div ref={bodyRef} className={`${styles.body} ${overflowing ? styles.scrollable : ''}`}>
        {children}
      </div>
      <footer className={styles.foot}>
        {number !== null && <span className={styles.number}>{number}</span>}
      </footer>
    </article>
  );
}
