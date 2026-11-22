import { Check } from 'lucide-react';
import styles from './Editor.module.css';

/** Aviso «Por confirmar» de lo importado, con su botón para darlo por bueno. */
export function PendingNote({ reason, showError, onConfirm }: { reason: string; showError: boolean; onConfirm: () => void }) {
  return (
    <div className={`${styles.pendingNote} ${showError ? styles.pendingError : ''}`}>
      <span className={styles.pendingBadge}>Por confirmar</span>
      <span className={styles.pendingReason}>{reason}</span>
      <button type="button" className={styles.confirm} onClick={onConfirm}>
        <Check aria-hidden="true" /> Confirmar
      </button>
    </div>
  );
}
