/**
 * Importar una receta de un vídeo de TikTok o Instagram (fase 4).
 *
 * Tres maneras de empezar: pegar el enlace, subir el vídeo o pegar el texto.
 * Se ve el progreso de cada paso del análisis, se eligen las fotos entre los
 * fotogramas y todo termina en el formulario de siempre para revisarlo: lo
 * que la IA no ha podido asegurar llega marcado como «pendiente de confirmar».
 */
import {
  AlertCircle,
  Check,
  CircleDashed,
  FileText,
  Film,
  Link2,
  Loader2,
  Minus,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CategoryId } from '../../domain/categories';
import type { PhotoRef, RecipeDraft } from '../../domain/draft';
import { countPending, importedToDraft } from '../../domain/importDraft';
import type { ImportCapabilities } from '../../domain/importTypes';
import { getCapabilities, importServerAvailable } from '../../services/importer/api';
import { releaseFrames, type VideoFrame } from '../../services/importer/media';
import {
  ImportCancelled,
  initialStages,
  runImport,
  type ImportInput,
  type ImportOutcome,
  type Stage,
  type StageStatus,
} from '../../services/importer/pipeline';
import { useAssistant } from '../../state/assistantContext';
import { Sticker } from '../decor/Sticker';
import { Button, IconButton } from '../ui/Button';
import styles from './ImportSheet.module.css';

type Source = 'link' | 'file' | 'text';

const SOURCES: { id: Source; label: string; icon: ReactNode }[] = [
  { id: 'link', label: 'Enlace', icon: <Link2 /> },
  { id: 'file', label: 'Vídeo', icon: <Film /> },
  { id: 'text', label: 'Texto', icon: <FileText /> },
];

const STATUS_ICON: Record<StageStatus, ReactNode> = {
  pending: <CircleDashed />,
  active: <Loader2 className={styles.spin} />,
  done: <Check />,
  skipped: <Minus />,
  error: <AlertCircle />,
};

const MAX_VIDEO_MB = 300;

interface ImportSheetProps {
  categoryId?: CategoryId;
  onClose: () => void;
  onDone: (draft: RecipeDraft) => void;
}

export function ImportSheet({ categoryId, onClose, onDone }: ImportSheetProps) {
  const a = useAssistant();
  const [caps, setCaps] = useState<ImportCapabilities | null>(null);
  const [capsError, setCapsError] = useState<string | null>(null);
  const [source, setSource] = useState<Source>('link');
  const [link, setLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'input' | 'working' | 'review'>('input');
  const [stages, setStages] = useState<Stage[]>(initialStages);
  const [error, setError] = useState<{ message: string; linkFailed: boolean } | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [photoMode, setPhotoMode] = useState<'final' | 'process'>('final');
  const [cover, setCover] = useState<number | null>(null);
  const [stepFrames, setStepFrames] = useState<(number | null)[]>([]);
  const abort = useRef<AbortController | null>(null);
  const framesRef = useRef<VideoFrame[]>([]);

  const fetchCaps = () =>
    getCapabilities()
      .then((c) => {
        setCaps(c);
        setCapsError(null);
      })
      .catch((e: unknown) => setCapsError(e instanceof Error ? e.message : 'No encuentro el ayudante de importación.'));

  const loadCaps = () => {
    setCaps(null);
    setCapsError(null);
    void fetchCaps();
  };

  useEffect(() => {
    void fetchCaps();
    a.say(
      importServerAvailable
        ? 'Pega el enlace del vídeo, súbelo o pega su texto, y yo saco la receta. Luego la revisas tú.'
        : 'Aquí no puedo ver vídeos: eso solo funciona con la app instalada en un ordenador.',
    );
    return () => {
      abort.current?.abort();
      releaseFrames(framesRef.current);
      a.setMood('idle');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready =
    caps?.ai === true &&
    ((source === 'link' && link.trim().length > 8) || (source === 'file' && file !== null) || (source === 'text' && text.trim().length > 20));

  const start = async () => {
    if (!caps || !ready) return;
    const input: ImportInput =
      source === 'link' ? { kind: 'link', url: link } : source === 'file' && file ? { kind: 'file', file } : { kind: 'text', text };
    const controller = new AbortController();
    abort.current = controller;
    setError(null);
    setStages(initialStages());
    setPhase('working');
    a.setMood('thinking');
    a.say('Voy mirando el vídeo con calma. Esto puede tardar unos minutos.', { voice: false });

    let current: Stage['id'] = 'source';
    try {
      const result = await runImport(
        input,
        caps,
        (id, status, detail) => {
          if (status === 'active') current = id;
          setStages((all) => all.map((s) => (s.id === id ? { ...s, status, detail } : s)));
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      framesRef.current = result.frames;
      setOutcome(result);
      setCover(result.coverIndex);
      setStepFrames(result.stepFrames);
      setPhotoMode(result.stepFrames.some((f) => f !== null) ? 'process' : 'final');
      setPhase('review');
      a.setMood('celebrating');
      a.say(
        result.recipe.ingredients.length || result.recipe.steps.length
          ? '¡Ya está! Elige las fotos y repasa lo marcado como pendiente.'
          : 'No he encontrado una receta clara en el vídeo. Mira los avisos.',
      );
    } catch (e) {
      if (e instanceof ImportCancelled || controller.signal.aborted) return;
      setStages((all) => all.map((s) => (s.id === current ? { ...s, status: 'error' } : s)));
      const message = e instanceof Error ? e.message : 'Algo ha fallado.';
      setError({ message, linkFailed: source === 'link' && current === 'source' });
      a.setMood('idle');
      a.say('Vaya, no he podido terminar. Te explico qué ha pasado.', { voice: false });
    }
  };

  const cancel = () => {
    abort.current?.abort();
    setPhase('input');
    a.setMood('idle');
  };

  const finish = () => {
    if (!outcome) return;
    const ref = (index: number | null): PhotoRef | null => {
      if (index === null) return null;
      const frame = outcome.frames[index];
      if (!frame) return null;
      return { kind: 'new', blob: frame.blob, url: URL.createObjectURL(frame.blob), width: frame.width, height: frame.height };
    };
    const draft = importedToDraft(
      outcome.recipe,
      {
        cover: photoMode === 'final' ? ref(cover) : null,
        steps: photoMode === 'process' ? stepFrames.map(ref) : [],
      },
      { url: outcome.url, categoryId },
    );
    if (outcome.notes.length) draft.importWarnings = [...outcome.notes, ...(draft.importWarnings ?? [])];
    onDone(draft);
  };

  const pickFile = (f: File | null) => {
    if (f && f.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError({ message: `El vídeo pesa más de ${MAX_VIDEO_MB} MB. Prueba con uno más corto.`, linkFailed: false });
      return;
    }
    setError(null);
    setFile(f);
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Importar una receta de un vídeo">
      <div className={`${styles.sheet} tex-paper`}>
        <header className={styles.header}>
          <Sticker id="raton-chef" width={60} motion={phase === 'working' ? 'breathe' : 'bob'} />
          <div className={styles.headText}>
            <p className={styles.kicker}>Importar de un vídeo</p>
            <h2 className={styles.title}>
              {phase === 'input' ? '¿De dónde sale la receta?' : phase === 'working' ? (error ? 'No he podido terminar' : 'Analizando…') : 'Antes de guardarla'}
            </h2>
          </div>
          <IconButton label="Cerrar la importación" onClick={onClose}>
            <X />
          </IconButton>
        </header>

        <div className={styles.body}>
          {phase === 'input' && (
            <>
              <CapabilitiesNote caps={caps} error={capsError} onRetry={loadCaps} />

              <div className={styles.tabs} role="tablist" aria-label="Origen">
                {SOURCES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="tab"
                    aria-selected={source === s.id}
                    className={`${styles.tab} ${source === s.id ? styles.tabOn : ''}`}
                    onClick={() => {
                      setSource(s.id);
                      setError(null);
                    }}
                  >
                    {s.icon}
                    {s.label}
                  </button>
                ))}
              </div>

              {source === 'link' && (
                <label className={styles.field}>
                  <span>Enlace de TikTok o Instagram</span>
                  <input
                    type="url"
                    inputMode="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://www.tiktok.com/@…/video/…"
                    autoComplete="off"
                  />
                  <small>
                    {caps?.links
                      ? 'Se descarga el vídeo para verlo y escucharlo.'
                      : 'En este ordenador solo se puede leer el texto de la publicación de TikTok. Para ver y oír el vídeo, súbelo en «Vídeo».'}
                  </small>
                </label>
              )}

              {source === 'file' && (
                <label className={`${styles.drop} ${file ? styles.dropFull : ''}`}>
                  <input type="file" accept="video/*" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
                  <Upload aria-hidden="true" />
                  <span>{file ? file.name : 'Elige el vídeo guardado (MP4, MOV…)'}</span>
                  <small>
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(1)} MB · el vídeo no sale de este ordenador`
                      : 'Se sacan fotogramas y se transcribe el audio aquí mismo.'}
                  </small>
                </label>
              )}

              {source === 'text' && (
                <label className={styles.field}>
                  <span>Lo que dice el vídeo o el texto de la publicación</span>
                  <textarea
                    rows={7}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Pega aquí la transcripción o la descripción con los ingredientes y los pasos…"
                  />
                </label>
              )}

              {error && (
                <div className={styles.error} role="alert">
                  <AlertCircle aria-hidden="true" />
                  <div>
                    <p>{error.message}</p>
                    {error.linkFailed && (
                      <div className={styles.errorActions}>
                        <Button size="sm" icon={<Film />} onClick={() => setSource('file')}>
                          Subir el vídeo
                        </Button>
                        <Button size="sm" icon={<FileText />} onClick={() => setSource('text')}>
                          Pegar el texto
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {phase === 'working' && (
            <ol className={styles.stages}>
              {stages.map((s) => (
                <li key={s.id} className={styles[`s-${s.status}`]}>
                  <span className={styles.stageIcon}>{STATUS_ICON[s.status]}</span>
                  <span className={styles.stageLabel}>{s.label}</span>
                  {s.detail && <span className={styles.stageDetail}>{s.detail}</span>}
                </li>
              ))}
            </ol>
          )}

          {phase === 'working' && error && (
            <div className={styles.error} role="alert">
              <AlertCircle aria-hidden="true" />
              <div>
                <p>{error.message}</p>
                <div className={styles.errorActions}>
                  <Button size="sm" onClick={() => setPhase('input')}>
                    Volver
                  </Button>
                  {error.linkFailed && (
                    <>
                      <Button
                        size="sm"
                        icon={<Film />}
                        onClick={() => {
                          setSource('file');
                          setPhase('input');
                        }}
                      >
                        Subir el vídeo
                      </Button>
                      <Button
                        size="sm"
                        icon={<FileText />}
                        onClick={() => {
                          setSource('text');
                          setPhase('input');
                        }}
                      >
                        Pegar el texto
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {phase === 'review' && outcome && (
            <Review
              outcome={outcome}
              photoMode={photoMode}
              onPhotoMode={setPhotoMode}
              cover={cover}
              onCover={setCover}
              stepFrames={stepFrames}
              onStepFrame={(step, frame) => setStepFrames((all) => all.map((f, i) => (i === step ? frame : f)))}
              categoryId={categoryId}
            />
          )}
        </div>

        <footer className={styles.footer}>
          {phase === 'input' && (
            <>
              <Button onClick={onClose}>Cancelar</Button>
              <Button variant="primary" disabled={!ready} onClick={() => void start()}>
                Analizar
              </Button>
            </>
          )}
          {phase === 'working' && !error && (
            <>
              <Button onClick={cancel}>Cancelar</Button>
              <span className={styles.wait}>No cierres esta ventana</span>
            </>
          )}
          {phase === 'review' && (
            <>
              <Button
                onClick={() => {
                  releaseFrames(framesRef.current);
                  framesRef.current = [];
                  setOutcome(null);
                  setPhase('input');
                }}
              >
                Empezar de nuevo
              </Button>
              <Button variant="primary" onClick={finish}>
                Revisar en el formulario
              </Button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

function CapabilitiesNote({ caps, error, onRetry }: { caps: ImportCapabilities | null; error: string | null; onRetry: () => void }) {
  if (error) {
    return (
      <div className={styles.error}>
        <AlertCircle aria-hidden="true" />
        <div>
          <p>{error}</p>
          <p className={styles.small}>
            La importación necesita el pequeño servidor local que arranca con <code>npm run dev</code>.
          </p>
          {importServerAvailable && (
            <div className={styles.errorActions}>
              <Button size="sm" onClick={onRetry}>
                Volver a comprobar
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }
  if (!caps) return <p className={styles.small}>Comprobando qué puedo hacer en este ordenador…</p>;
  return (
    <div className={caps.ai ? styles.caps : styles.error}>
      {!caps.ai && <AlertCircle aria-hidden="true" />}
      <div>
        <p className={styles.small}>
          {caps.ai
            ? `IA: ${caps.provider} · ${caps.textModel}${caps.visionModel ? ` + ${caps.visionModel} para las imágenes` : ''}${caps.transcription ? ' · Whisper para el audio' : ''}`
            : 'La IA no está disponible ahora mismo.'}
        </p>
        {caps.notes.map((n) => (
          <p key={n} className={styles.small}>
            {n}
          </p>
        ))}
        {!caps.ai && (
          <div className={styles.errorActions}>
            <Button size="sm" onClick={onRetry}>
              Volver a comprobar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ReviewProps {
  outcome: ImportOutcome;
  photoMode: 'final' | 'process';
  onPhotoMode: (mode: 'final' | 'process') => void;
  cover: number | null;
  onCover: (index: number | null) => void;
  stepFrames: (number | null)[];
  onStepFrame: (step: number, frame: number | null) => void;
  categoryId?: CategoryId;
}

function Review({ outcome, photoMode, onPhotoMode, cover, onCover, stepFrames, onStepFrame, categoryId }: ReviewProps) {
  const { recipe, frames } = outcome;
  // Borrador de prueba solo para contar lo pendiente (sin fotos).
  const pending = countPending(importedToDraft(recipe, { cover: null, steps: [] }, { categoryId }));
  const warnings = [...outcome.notes, ...recipe.warnings];

  return (
    <div className={styles.review}>
      <div className={styles.summary}>
        <p className={styles.recipeTitle}>{recipe.title ?? 'Receta sin nombre'}</p>
        <p className={styles.small}>
          {recipe.ingredients.length} ingredientes · {recipe.steps.length} pasos
          {pending > 0 && (
            <>
              {' · '}
              <strong className={styles.pendingCount}>{pending} por confirmar</strong>
            </>
          )}
        </p>
      </div>

      {warnings.length > 0 && (
        <ul className={styles.warnings}>
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {frames.length > 0 ? (
        <>
          <div className={styles.tabs} role="radiogroup" aria-label="Fotos de la receta">
            <button
              type="button"
              role="radio"
              aria-checked={photoMode === 'final'}
              className={`${styles.tab} ${photoMode === 'final' ? styles.tabOn : ''}`}
              onClick={() => onPhotoMode('final')}
            >
              Una foto del plato
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={photoMode === 'process'}
              className={`${styles.tab} ${photoMode === 'process' ? styles.tabOn : ''}`}
              onClick={() => onPhotoMode('process')}
              disabled={!recipe.steps.length}
            >
              Una por paso
            </button>
          </div>

          {photoMode === 'final' ? (
            <>
              <p className={styles.small}>Toca el fotograma que mejor muestre el plato terminado.</p>
              <FrameStrip frames={frames} selected={cover} onSelect={onCover} label="Foto del plato" />
            </>
          ) : (
            <ol className={styles.stepPhotos}>
              {recipe.steps.map((step, i) => (
                <li key={`${i}-${step.text}`}>
                  <p>
                    <strong>{i + 1}.</strong> {step.text}
                  </p>
                  <FrameStrip
                    frames={frames}
                    selected={stepFrames[i] ?? null}
                    onSelect={(f) => onStepFrame(i, f)}
                    label={`Foto del paso ${i + 1}`}
                    compact
                  />
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className={styles.small}>No hay fotogramas: podrás añadir tus fotos en el formulario.</p>
      )}
    </div>
  );
}

function FrameStrip({
  frames,
  selected,
  onSelect,
  label,
  compact = false,
}: {
  frames: VideoFrame[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.frames} ${compact ? styles.framesCompact : ''}`} role="radiogroup" aria-label={label}>
      <button
        type="button"
        role="radio"
        aria-checked={selected === null}
        className={`${styles.frame} ${styles.noFrame} ${selected === null ? styles.frameOn : ''}`}
        onClick={() => onSelect(null)}
      >
        Sin foto
      </button>
      {frames.map((f, i) => (
        <button
          key={f.url}
          type="button"
          role="radio"
          aria-checked={selected === i}
          aria-label={`Fotograma del segundo ${Math.round(f.time)}`}
          className={`${styles.frame} ${selected === i ? styles.frameOn : ''}`}
          onClick={() => onSelect(i)}
        >
          <img src={f.url} alt="" />
          <span>{Math.round(f.time)} s</span>
        </button>
      ))}
    </div>
  );
}
