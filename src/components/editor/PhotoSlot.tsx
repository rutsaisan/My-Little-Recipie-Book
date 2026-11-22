import { Camera, ImagePlus, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react';
import { useId, useRef, useState, type DragEvent } from 'react';
import type { PhotoRef } from '../../domain/draft';
import { usePhotoUrl } from '../../hooks/usePhotoUrl';
import { ImageReadError, prepareImage } from '../../services/imageProcessing';
import { Tape } from '../decor/Ornaments';
import { Button } from '../ui/Button';
import styles from './PhotoSlot.module.css';

interface PhotoSlotProps {
  value: PhotoRef | null;
  onChange: (value: PhotoRef | null) => void;
  /** Texto accesible, p. ej. «Foto del plato» o «Foto del paso 2». */
  label: string;
  size?: 'large' | 'small';
  /** Para liberar las URL temporales al cerrar el formulario. */
  onUrlCreated: (url: string) => void;
}

/** Hueco para una foto: subir (clic o arrastrar), ver, cambiar y quitar. */
export function PhotoSlot({ value, onChange, label, size = 'large', onUrlCreated }: PhotoSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const storedUrl = usePhotoUrl(value?.kind === 'stored' ? value.id : null);
  const url = value?.kind === 'new' ? value.url : storedUrl;

  const accept = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const prepared = await prepareImage(file);
      const objectUrl = URL.createObjectURL(prepared.blob);
      onUrlCreated(objectUrl);
      onChange({ kind: 'new', blob: prepared.blob, url: objectUrl, width: prepared.width, height: prepared.height });
    } catch (e) {
      setError(e instanceof ImageReadError ? e.message : 'No he podido preparar esta foto. Prueba con otra.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void accept(event.dataTransfer.files[0]);
  };

  return (
    <div className={`${styles.slot} ${styles[size]}`}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/*"
        className="visually-hidden"
        tabIndex={-1}
        onChange={(e) => void accept(e.target.files?.[0])}
      />
      {value && url ? (
        <figure className={styles.preview}>
          <Tape className={styles.tape} />
          <img src={url} alt={label} />
          <figcaption className={styles.actions}>
            <Button size="sm" icon={<RefreshCw />} onClick={() => inputRef.current?.click()} disabled={busy}>
              Cambiar
            </Button>
            <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => onChange(null)} disabled={busy}>
              Quitar
            </Button>
          </figcaption>
        </figure>
      ) : (
        <button
          type="button"
          className={`${styles.drop} ${dragging ? styles.dragging : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={busy}
          aria-label={`Añadir ${label.toLowerCase()}`}
        >
          {busy ? <LoaderCircle className={styles.spin} /> : size === 'large' ? <Camera /> : <ImagePlus />}
          <span className={styles.dropTitle}>{busy ? 'Preparando la foto…' : 'Añadir foto'}</span>
          {size === 'large' && !busy && <span className={styles.dropHint}>Pulsa aquí o arrastra una imagen</span>}
        </button>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
