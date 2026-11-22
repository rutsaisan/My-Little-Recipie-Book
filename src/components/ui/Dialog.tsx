import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { CharacterId } from '../../assets/characters';
import { Sticker } from '../decor/Sticker';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  character?: CharacterId;
  onClose: () => void;
}

/**
 * Ventana modal accesible (elemento <dialog> nativo: atrapa el foco y se
 * cierra con Esc) con aspecto de notita de papel.
 */
export function Dialog({ open, title, children, actions, character, onClose }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Clic fuera de la tarjeta (en el fondo) = cerrar.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {open && (
        <div className={`${styles.card} tex-paper`}>
          {character && <Sticker id={character} width={118} tilt={-6} motion="bob" className={styles.character} />}
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          {children && <div className={styles.body}>{children}</div>}
          <div className={styles.actions}>{actions}</div>
        </div>
      )}
    </dialog>
  );
}
