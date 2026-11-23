/**
 * «Manos libres» con la cámara: una ventanita con lo que ve la cámara (en
 * espejo), el estado y la chuleta de gestos. Solo existe mientras está
 * activado; al desmontarse, la cámara se apaga.
 */
import { useEffect, useRef, useState } from 'react';
import type { HandGesture } from '../../domain/gestureTracker';
import { startHandCamera, type HandCameraStatus } from '../../services/gestures/handCamera';
import styles from './CookingMode.module.css';

const GESTURE_TEXT: Record<HandGesture, string> = {
  next: 'Siguiente paso',
  previous: 'Paso anterior',
  palm: 'Mano abierta',
  thumbUp: 'Pulgar arriba',
};

const STATUS_TEXT: Record<HandCameraStatus, string> = {
  loading: 'Encendiendo la cámara…',
  ready: 'Te veo. Haz un gesto',
  'no-hand': 'No veo tu mano: ponla delante de la cámara',
  error: '',
};

interface HandsFreeCameraProps {
  onGesture: (gesture: HandGesture) => void;
  onError: (message: string) => void;
}

export function HandsFreeCamera({ onGesture, onError }: HandsFreeCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<HandCameraStatus>('loading');
  const [last, setLast] = useState<HandGesture | null>(null);
  const [hold, setHold] = useState<{ shape: string; progress: number } | null>(null);
  const handlers = useRef({ onGesture, onError });
  useEffect(() => {
    handlers.current = { onGesture, onError };
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let flash = 0;
    const camera = startHandCamera(video, {
      onStatus: (s, detail) => {
        setStatus(s);
        if (s === 'error') handlers.current.onError(detail ?? 'No he podido encender la cámara.');
      },
      onGesture: (g) => {
        setLast(g);
        window.clearTimeout(flash);
        flash = window.setTimeout(() => setLast(null), 1400);
        if ('vibrate' in navigator) navigator.vibrate?.(30);
        handlers.current.onGesture(g);
      },
      onHold: (h) => setHold((prev) => (prev?.shape === h?.shape && Math.abs((prev?.progress ?? 0) - (h?.progress ?? 0)) < 0.1 ? prev : h)),
    });
    return () => {
      window.clearTimeout(flash);
      camera.stop();
    };
  }, []);

  return (
    <aside className={styles.camera} aria-label="Manos libres con la cámara">
      <div className={styles.cameraView}>
        <video ref={videoRef} className={styles.cameraVideo} muted playsInline aria-hidden="true" />
        <span className={styles.recDot} aria-hidden="true" />
        {hold && hold.progress > 0.15 && (
          <span className={styles.holdRing} style={{ '--p': hold.progress } as React.CSSProperties} aria-hidden="true" />
        )}
        {last && <span className={styles.gestureFlash}>{GESTURE_TEXT[last]}</span>}
      </div>
      <div className={styles.cameraInfo}>
        <p className={styles.cameraStatus} role="status">
          {STATUS_TEXT[status]}
        </p>
        <ul className={styles.gestureList}>
          <li>
            <strong>Mano a la izquierda</strong> siguiente
          </li>
          <li>
            <strong>Mano a la derecha</strong> anterior
          </li>
          <li>
            <strong>Mano abierta quieta</strong> repetir o parar la alarma
          </li>
          <li>
            <strong>Pulgar arriba</strong> temporizador del paso
          </li>
        </ul>
      </div>
    </aside>
  );
}
