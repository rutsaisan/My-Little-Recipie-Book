import { X } from 'lucide-react';
import type { CharacterId } from '../../assets/characters';
import { Sticker } from '../decor/Sticker';
import styles from './Toasts.module.css';

export interface ToastItem {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  character?: CharacterId;
  action?: { label: string; onClick: () => void };
}

const DEFAULT_CHARACTER: Record<ToastItem['tone'], CharacterId> = {
  info: 'raya-mini-mantequilla',
  success: 'raya-corazon',
  error: 'raton-pizza',
};

export function Toasts({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`${styles.toast} ${styles[item.tone]} tex-paper`}>
          <Sticker id={item.character ?? DEFAULT_CHARACTER[item.tone]} width={44} />
          <p className={styles.message}>{item.message}</p>
          {item.action && (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                item.action!.onClick();
                onDismiss(item.id);
              }}
            >
              {item.action.label}
            </button>
          )}
          <button type="button" className={styles.close} onClick={() => onDismiss(item.id)} aria-label="Cerrar aviso">
            <X />
          </button>
        </div>
      ))}
    </div>
  );
}
