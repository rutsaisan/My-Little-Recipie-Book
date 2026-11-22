/**
 * Hoja que gira alrededor de la espiral al pasar página.
 *
 * Usa la Web Animations API: la hoja rota en 3D mientras unas sombras suaves
 * oscurecen la cara que se aleja, la página que se descubre y la que se tapa.
 */
import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import styles from './FlipLeaf.module.css';

/** Mitad del libro sobre la que gira la hoja (su lado «de reposo»). */
export type LeafPlacement = 'right' | 'left' | 'single';

interface FlipLeafProps {
  placement: LeafPlacement;
  /** Ángulos inicial y final (grados). 0 = hoja plana en su lado. */
  from: number;
  to: number;
  front: ReactNode;
  back: ReactNode;
  pageWidth: number;
  pageHeight: number;
  duration: number;
  onDone: () => void;
  /** Elemento que debe moverse a la vez (el libro al abrir o cerrar la tapa). */
  companion?: { ref: RefObject<HTMLElement | null>; keyframes: Keyframe[] };
}

const EASING = 'cubic-bezier(0.45, 0.05, 0.28, 1)';

const UNCOVER: Keyframe[] = [{ opacity: 0.55 }, { opacity: 0, offset: 0.6 }, { opacity: 0 }];
const COVER: Keyframe[] = [{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 0.38, offset: 0.85 }, { opacity: 0 }];
const TURN_AWAY: Keyframe[] = [{ opacity: 0 }, { opacity: 0.42, offset: 0.5 }, { opacity: 0.42 }];
const COME_BACK: Keyframe[] = [{ opacity: 0.42 }, { opacity: 0.42, offset: 0.5 }, { opacity: 0 }];

export function FlipLeaf({
  placement,
  from,
  to,
  front,
  back,
  pageWidth,
  pageHeight,
  duration,
  onDone,
  companion,
}: FlipLeafProps) {
  const leafRef = useRef<HTMLDivElement>(null);
  const frontShadeRef = useRef<HTMLDivElement>(null);
  const backShadeRef = useRef<HTMLDivElement>(null);
  const uncoverRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  const companionRef = useRef(companion);

  useLayoutEffect(() => {
    doneRef.current = onDone;
    companionRef.current = companion;
  });

  // La hoja se aleja de su lado de reposo (0°) o vuelve a él.
  const leaving = Math.abs(to) > Math.abs(from);

  useLayoutEffect(() => {
    const leaf = leafRef.current;
    if (!leaf) return;
    const timing: KeyframeAnimationOptions = { duration, easing: EASING, fill: 'forwards' };
    const animations = [leaf.animate([{ transform: `rotateY(${from}deg)` }, { transform: `rotateY(${to}deg)` }], timing)];
    const add = (el: HTMLElement | null, keys: Keyframe[]) => el && animations.push(el.animate(keys, timing));
    add(frontShadeRef.current, leaving ? TURN_AWAY : COME_BACK);
    add(backShadeRef.current, leaving ? COME_BACK : TURN_AWAY);
    add(uncoverRef.current, UNCOVER);
    add(coverRef.current, COVER);
    const extra = companionRef.current;
    const companionEl = extra?.ref.current;
    if (extra && companionEl) animations.push(companionEl.animate(extra.keyframes, timing));

    let cancelled = false;
    animations[0].finished.then(
      () => !cancelled && doneRef.current(),
      () => {},
    );
    // Si el navegador deja de pintar (pestaña oculta, ventana minimizada…), la
    // animación se congela; pasado su tiempo se completa igualmente.
    const fallback = window.setTimeout(() => {
      animations.forEach((a) => {
        if (a.playState !== 'finished') a.finish();
      });
    }, duration + 400);
    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
      animations.forEach((a) => a.cancel());
    };
  }, [from, to, duration, leaving]);

  const restLeft = placement === 'right' ? pageWidth : 0;
  const otherLeft = placement === 'right' ? 0 : pageWidth;
  // Zona que se descubre y zona que se tapa (en modo una página, solo la propia).
  const uncoverLeft = leaving ? restLeft : placement === 'single' ? null : otherLeft;
  const coverLeft = leaving ? (placement === 'single' ? null : otherLeft) : restLeft;

  const castStyle = (left: number): CSSProperties => ({
    left,
    width: pageWidth,
    height: pageHeight,
    // La sombra nace en la espiral: a la izquierda de la página derecha y viceversa.
    background:
      left === 0 && placement !== 'single'
        ? 'linear-gradient(270deg, rgb(36 20 12 / 0.75), rgb(36 20 12 / 0.15) 45%, transparent 80%)'
        : 'linear-gradient(90deg, rgb(36 20 12 / 0.75), rgb(36 20 12 / 0.15) 45%, transparent 80%)',
  });

  return (
    <div className={`${styles.layer} ${styles[placement]}`} aria-hidden="true">
      {uncoverLeft !== null && <div ref={uncoverRef} className={styles.cast} style={castStyle(uncoverLeft)} />}
      {coverLeft !== null && <div ref={coverRef} className={styles.cast} style={castStyle(coverLeft)} />}
      <div
        ref={leafRef}
        className={styles.leaf}
        style={{
          left: restLeft,
          width: pageWidth,
          height: pageHeight,
          transformOrigin: placement === 'left' ? 'right center' : 'left center',
          transform: `rotateY(${from}deg)`,
        }}
        inert
      >
        <div className={`${styles.face} ${styles.front}`}>
          {front}
          <div ref={frontShadeRef} className={`${styles.shade} ${placement === 'left' ? styles.shadeFromRight : ''}`} />
        </div>
        <div className={`${styles.face} ${styles.back}`}>
          {back}
          <div ref={backShadeRef} className={`${styles.shade} ${placement === 'left' ? '' : styles.shadeFromRight}`} />
        </div>
      </div>
    </div>
  );
}
