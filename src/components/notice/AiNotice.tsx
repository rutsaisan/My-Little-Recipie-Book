/**
 * Aviso de que Tom necesita Ollama para responder dudas (misma tarjeta que el
 * aviso de privacidad, con Tom asomando por arriba).
 */
import { Sticker } from '../decor/Sticker';
import { NoticeCard } from './NoticeCard';
import styles from './Notices.module.css';

interface AiNoticeProps {
  message: string | null;
  onRetry: () => void;
  onHelp: () => void;
}

export function AiNotice({ message, onRetry, onHelp }: AiNoticeProps) {
  return (
    <div className={styles.aiSlot}>
      <NoticeCard
        role="note"
        art={<Sticker id="gato-calico-chef" width={66} />}
        title="Para responder dudas necesito Ollama"
        secondary={{ label: '¿Qué es Ollama?', onClick: onHelp }}
        primary={{ label: 'Comprobar', onClick: onRetry }}
      >
        {message ?? 'La IA no está disponible ahora mismo.'} Mientras tanto sigo poniendo temporizadores, leyendo recetas y
        acompañándote al cocinar.
      </NoticeCard>
    </div>
  );
}
