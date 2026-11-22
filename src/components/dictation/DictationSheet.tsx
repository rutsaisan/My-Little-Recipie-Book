/**
 * Dictar una receta con la voz, en tres pasos guiados (nombre, ingredientes,
 * elaboración). Lo dictado se coloca en el formulario de siempre para
 * revisarlo antes de guardar: nunca se guarda sin que la persona lo vea.
 */
import { ArrowLeft, ArrowRight, Mic, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { buildDictatedDraft } from '../../domain/dictation';
import type { RecipeDraft } from '../../domain/draft';
import { listen, speechRecognitionSupported, type Listening } from '../../services/speech/recognition';
import { stopSpeaking } from '../../services/speech/synthesis';
import { useAssistant } from '../../state/assistantContext';
import { Sticker } from '../decor/Sticker';
import { Button, IconButton } from '../ui/Button';
import styles from './DictationSheet.module.css';

type Stage = 'title' | 'ingredients' | 'steps';

const STAGES: { id: Stage; label: string; prompt: string; example: string }[] = [
  { id: 'title', label: 'Nombre', prompt: '¿Cómo se llama la receta?', example: '«Bizcocho de yogur de la abuela»' },
  {
    id: 'ingredients',
    label: 'Ingredientes',
    prompt: 'Dime los ingredientes, uno detrás de otro, haciendo una pausa entre cada uno.',
    example: '«doscientos gramos de harina» · «tres huevos» · «una pizca de sal»',
  },
  {
    id: 'steps',
    label: 'Elaboración',
    prompt: 'Ahora cuéntame los pasos. Haz una pausa (o di «siguiente paso») entre uno y otro.',
    example: '«bate los huevos con el azúcar» · «siguiente paso» · «añade la harina»',
  },
];

interface DictationSheetProps {
  categoryId?: string;
  onClose: () => void;
  onDone: (draft: RecipeDraft) => void;
}

export function DictationSheet({ categoryId, onClose, onDone }: DictationSheetProps) {
  const a = useAssistant();
  const [stage, setStage] = useState(0);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<Record<'ingredients' | 'steps', string[]>>({ ingredients: [], steps: [] });
  const [interim, setInterim] = useState('');
  const [typed, setTyped] = useState('');
  const [session, setSession] = useState<Listening | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = STAGES[stage];
  const supported = speechRecognitionSupported();

  useEffect(() => {
    a.say(current.prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(
    () => () => {
      session?.stop();
      stopSpeaking();
    },
    [session],
  );

  const add = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    if (current.id === 'title') setTitle(clean);
    else setItems((all) => ({ ...all, [current.id]: [...all[current.id as 'ingredients' | 'steps'], clean] }));
  };

  const stopListening = () => {
    session?.stop();
    setSession(null);
    setInterim('');
    a.setMood('idle');
  };

  const startListening = () => {
    setError(null);
    stopSpeaking();
    const s = listen({
      continuous: current.id !== 'title',
      onInterim: setInterim,
      onFinal: (text) => {
        setInterim('');
        add(text);
        if (current.id === 'title') stopListening();
      },
      onError: (message) => {
        setError(message);
        setSession(null);
        a.setMood('idle');
      },
      onEnd: () => {
        setSession(null);
        a.setMood('idle');
      },
    });
    if (s) {
      setSession(s);
      a.setMood('listening');
    }
  };

  const goStage = (to: number) => {
    stopListening();
    setTyped('');
    setStage(to);
  };

  const finish = () => {
    stopListening();
    onDone(buildDictatedDraft({ title, ingredients: items.ingredients, steps: items.steps }, categoryId));
  };

  const list = current.id === 'title' ? (title ? [title] : []) : items[current.id];

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Dictar una receta">
      <div className={`${styles.sheet} tex-paper`}>
        <header className={styles.header}>
          <Sticker id="gato-calico-chef" width={64} motion="bob" />
          <div className={styles.headText}>
            <p className={styles.kicker}>Dictar una receta · {stage + 1} de 3</p>
            <h2 className={styles.title}>{current.label}</h2>
          </div>
          <IconButton label="Cancelar el dictado" onClick={onClose}>
            <X />
          </IconButton>
        </header>

        <p className={styles.prompt}>{current.prompt}</p>
        <p className={styles.example}>Por ejemplo: {current.example}</p>

        {supported ? (
          <button
            type="button"
            className={`${styles.mic} ${session ? styles.listening : ''}`}
            onClick={session ? stopListening : startListening}
            aria-pressed={Boolean(session)}
          >
            {session ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
            {session ? 'Parar' : 'Pulsa y habla'}
          </button>
        ) : (
          <p className={styles.warning}>
            Este navegador no puede escuchar. Prueba con Chrome o Edge, o escríbelo aquí abajo.
          </p>
        )}
        {interim && <p className={styles.interim}>{interim}…</p>}
        {error && <p className={styles.warning}>{error}</p>}

        <ul className={styles.items}>
          {list.map((text, i) => (
            <li key={`${i}-${text}`}>
              <span className={styles.bullet}>{current.id === 'steps' ? i + 1 : '•'}</span>
              <span className={styles.itemText}>{text}</span>
              <button
                type="button"
                aria-label={`Quitar «${text}»`}
                onClick={() =>
                  current.id === 'title'
                    ? setTitle('')
                    : setItems((all) => ({
                        ...all,
                        [current.id]: all[current.id as 'ingredients' | 'steps'].filter((_, j) => j !== i),
                      }))
                }
              >
                <X />
              </button>
            </li>
          ))}
        </ul>

        <form
          className={styles.typed}
          onSubmit={(e) => {
            e.preventDefault();
            add(typed);
            setTyped('');
          }}
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={supported ? 'O escríbelo aquí y pulsa Intro' : 'Escríbelo aquí y pulsa Intro'}
            aria-label={`Añadir ${current.label.toLowerCase()} escribiendo`}
          />
        </form>

        <footer className={styles.footer}>
          <Button icon={<ArrowLeft />} onClick={() => goStage(stage - 1)} disabled={stage === 0}>
            Anterior
          </Button>
          {stage < STAGES.length - 1 ? (
            <Button variant="primary" onClick={() => goStage(stage + 1)}>
              Siguiente <ArrowRight style={{ width: 16, height: 16, marginLeft: 4, verticalAlign: '-3px' }} />
            </Button>
          ) : (
            <Button variant="primary" onClick={finish} disabled={!title && !items.ingredients.length && !items.steps.length}>
              Revisar en el formulario
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
