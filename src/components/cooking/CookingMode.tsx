/**
 * Cocinar paso a paso: un paso cada vez, en grande, para leer desde lejos con
 * las manos ocupadas. Lee en voz alta, propone temporizadores y entiende
 * órdenes de voz («siguiente», «repite», «pon un temporizador de 10 minutos»).
 * Mientras está abierto, la pantalla no se apaga (si el navegador lo permite).
 */
import { ArrowLeft, ArrowRight, Check, CookingPot, Hand, Mic, MicOff, Timer, Video, VideoOff, Volume2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HandGesture } from '../../domain/gestureTracker';
import { ingredientToText } from '../../domain/ingredients';
import type { Recipe } from '../../domain/recipe';
import { formatClock, formatDuration, parseCommand, suggestTimer } from '../../domain/voiceCommands';
import { usePhotoUrl } from '../../hooks/usePhotoUrl';
import { cameraSupported } from '../../services/gestures/handCamera';
import { listen, speechRecognitionSupported, type Listening } from '../../services/speech/recognition';
import { stopSpeaking } from '../../services/speech/synthesis';
import { useAssistant } from '../../state/assistantContext';
import { usePreferences } from '../../state/preferencesContext';
import { ingredientsToSpeech } from '../assistant/recipeSpeech';
import { Sticker } from '../decor/Sticker';
import { Button, IconButton } from '../ui/Button';
import { HandsFreeCamera } from './HandsFreeCamera';
import styles from './CookingMode.module.css';

interface CookingModeProps {
  recipe: Recipe;
  onClose: () => void;
  /** «¡La he cocinado!» al terminar. */
  onFinished: () => void;
}

export function CookingMode({ recipe, onClose, onFinished }: CookingModeProps) {
  const a = useAssistant();
  const { prefs } = usePreferences();
  // 0 = ingredientes; 1..n = pasos; n+1 = final
  const [index, setIndex] = useState(0);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [handsFree, setHandsFree] = useState<Listening | null>(null);
  const [heard, setHeard] = useState('');
  /** «Manos libres» con la cámara: apagado salvo que se pulse el botón. */
  const [camera, setCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const total = recipe.steps.length;
  const step = index >= 1 && index <= total ? recipe.steps[index - 1] : null;
  const photo = usePhotoUrl(recipe.photoMode === 'process' ? (step?.photoId ?? null) : null);
  const suggested = step ? suggestTimer(step.text) : null;
  const stateRef = useRef({ index, total });

  useEffect(() => {
    stateRef.current = { index, total };
  });

  const textFor = useCallback(
    (i: number) => {
      if (i === 0) return `Vamos a cocinar ${recipe.title}. ${ingredientsToSpeech(recipe)}`;
      if (i > total) return '¡Terminado! Que aproveche.';
      return `Paso ${i}. ${recipe.steps[i - 1].text}`;
    },
    [recipe, total],
  );

  // Al cambiar de paso, Tom lo lee (si la voz está activada).
  useEffect(() => {
    a.say(textFor(index));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Que la pantalla no se apague mientras se cocina.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {});
    return () => {
      void lock?.release();
      stopSpeaking();
    };
  }, []);

  const go = useCallback((to: number) => setIndex(Math.max(0, Math.min(stateRef.current.total + 1, to))), []);

  const startTimer = useCallback(
    (seconds: number) => {
      const label = step ? `${recipe.title} · paso ${index}` : recipe.title;
      a.addTimer(seconds, label);
      a.say(`Temporizador de ${formatDuration(seconds)} en marcha.`);
    },
    [a, step, recipe.title, index],
  );

  const handleCommand = useCallback(
    (text: string) => {
      setHeard(text);
      const command = parseCommand(text);
      const { index: i } = stateRef.current;
      switch (command.type) {
        case 'next':
          return go(i + 1);
        case 'previous':
          return go(i - 1);
        case 'repeat':
          return a.say(textFor(i));
        case 'ingredients':
          return a.say(ingredientsToSpeech(recipe));
        case 'timer':
          return startTimer(command.seconds);
        case 'cancelTimer': {
          const last = a.timers.at(-1);
          if (last) a.removeTimer(last.id);
          return a.say(last ? 'Temporizador cancelado.' : 'No hay ningún temporizador en marcha.');
        }
        case 'timeLeft': {
          const next = [...a.timers].sort((x, y) => x.endsAt - y.endsAt)[0];
          return a.say(next ? `Quedan ${formatDuration((next.endsAt - Date.now()) / 1000)}.` : 'No hay temporizadores en marcha.');
        }
        case 'finish':
          return go(stateRef.current.total + 1);
        case 'stop':
          return stopSpeaking();
        default:
          return undefined;
      }
    },
    [a, go, recipe, startTimer, textFor],
  );

  const onGesture = useCallback(
    (gesture: HandGesture) => {
      const { index: i } = stateRef.current;
      switch (gesture) {
        case 'next':
          return go(i + 1);
        case 'previous':
          return go(i - 1);
        case 'palm': {
          // Mano abierta: si suena una alarma la para; si no, repite el paso.
          const ringing = a.timers.filter((t) => t.ringing);
          if (ringing.length) {
            ringing.forEach((t) => a.removeTimer(t.id));
            return a.say('Alarma parada.', { voice: false });
          }
          return a.say(textFor(i), { voice: true });
        }
        case 'thumbUp': {
          const current = i >= 1 && i <= stateRef.current.total ? recipe.steps[i - 1] : null;
          const seconds = current ? suggestTimer(current.text) : null;
          if (seconds) return startTimer(seconds);
          return a.say('Este paso no dice ningún tiempo. Pon uno desde mi panel o con la voz.', { voice: false });
        }
      }
    },
    [a, go, recipe.steps, startTimer, textFor],
  );

  const toggleCamera = () => {
    setCameraError(null);
    setCamera((on) => {
      if (!on) a.say('Manos libres: pasa la mano delante de la cámara para cambiar de paso. Las imágenes no salen de tu dispositivo.', { voice: false });
      return !on;
    });
  };

  const handleRef = useRef(handleCommand);
  useEffect(() => {
    handleRef.current = handleCommand;
  });

  const toggleHandsFree = () => {
    if (handsFree) {
      handsFree.stop();
      setHandsFree(null);
      a.setMood('idle');
      return;
    }
    const session = listen({
      continuous: true,
      onFinal: (text) => {
        // Evita que Tom se escuche a sí mismo mientras lee.
        if (window.speechSynthesis?.speaking && !/para|calla|silencio/i.test(text)) return;
        handleRef.current(text);
      },
      onInterim: (t) => t && setHeard(t),
      onError: (message) => {
        setHandsFree(null);
        a.say(message, { voice: false });
      },
      onEnd: () => setHandsFree(null),
    });
    if (session) {
      setHandsFree(session);
      a.say('Te escucho. Dime «siguiente», «anterior», «repite» o «pon un temporizador de diez minutos».');
    }
  };

  useEffect(() => () => handsFree?.stop(), [handsFree]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea')) return;
      if (e.key === 'ArrowRight' || e.key === ' ') go(stateRef.current.index + 1);
      else if (e.key === 'ArrowLeft') go(stateRef.current.index - 1);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  const runningTimers = a.timers.filter((t) => !t.ringing);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label={`Cocinando ${recipe.title}`}>
      <div className={`${styles.card} tex-paper`}>
        <header className={styles.header}>
          <div className={styles.headText}>
            <p className={styles.kicker}>Cocinando</p>
            <h2 className={styles.title}>{recipe.title}</h2>
          </div>
          {cameraSupported() && (
            <Button
              size="sm"
              variant={camera ? 'primary' : 'secondary'}
              icon={camera ? <Video /> : <VideoOff />}
              onClick={toggleCamera}
              aria-pressed={camera}
              title="Pasar los pasos con gestos de la mano delante de la cámara"
            >
              {camera ? 'Cámara activa' : 'Manos libres'}
            </Button>
          )}
          {speechRecognitionSupported() && (
            <Button
              size="sm"
              variant={handsFree ? 'primary' : 'secondary'}
              icon={handsFree ? <Mic /> : <MicOff />}
              onClick={toggleHandsFree}
              aria-pressed={Boolean(handsFree)}
              title="Dar órdenes con la voz: «siguiente», «repite», «pon un temporizador»…"
            >
              {handsFree ? 'Te escucho' : 'Voz'}
            </Button>
          )}
          <IconButton label="Salir del modo cocina" onClick={onClose}>
            <X />
          </IconButton>
        </header>

        <ol className={styles.progress} aria-label="Progreso">
          {Array.from({ length: total + 2 }, (_, i) => (
            <li key={i} data-done={i < index || undefined} data-current={i === index || undefined}>
              <button type="button" onClick={() => go(i)} aria-label={i === 0 ? 'Ingredientes' : i > total ? 'Final' : `Paso ${i}`} />
            </li>
          ))}
        </ol>

        <main className={styles.body} aria-live="polite">
          {index === 0 && (
            <div className={styles.ingredients}>
              <h3 className={styles.stepLabel}>Antes de empezar, prepara:</h3>
              {recipe.ingredients.length ? (
                <ul>
                  {recipe.ingredients.map((i) => (
                    <li key={i.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={checked.has(i.id)}
                          onChange={() =>
                            setChecked((s) => {
                              const next = new Set(s);
                              if (next.has(i.id)) next.delete(i.id);
                              else next.add(i.id);
                              return next;
                            })
                          }
                        />
                        {ingredientToText(i)}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Esta receta no tiene ingredientes anotados.</p>
              )}
            </div>
          )}

          {step && (
            <div className={styles.step}>
              <p className={styles.stepLabel}>
                Paso {index} de {total}
              </p>
              <p className={styles.stepText}>{step.text}</p>
              {photo && <img className={styles.photo} src={photo} alt={`Foto del paso ${index}`} />}
              {suggested && (
                <Button icon={<Timer />} onClick={() => startTimer(suggested)}>
                  Temporizador de {formatDuration(suggested)}
                </Button>
              )}
            </div>
          )}

          {index > total && (
            <div className={styles.done}>
              <Sticker id="gato-calico-chef" width={150} motion="bob" />
              <p className={styles.doneTitle}>¡Terminado!</p>
              <p>¿Qué tal ha salido? Márcala como cocinada y suma para tus insignias.</p>
              <Button
                variant="primary"
                icon={<CookingPot />}
                onClick={() => {
                  onFinished();
                  a.celebrate('¡Qué buena pinta! Apuntado en tu libro.');
                  onClose();
                }}
              >
                ¡La he cocinado!
              </Button>
            </div>
          )}
        </main>

        {runningTimers.length > 0 && (
          <div className={styles.timers}>
            {runningTimers.map((t) => (
              <span key={t.id} className={styles.timerChip}>
                <Timer aria-hidden="true" /> {formatClock((t.endsAt - a.now) / 1000)}
              </span>
            ))}
          </div>
        )}

        <footer className={styles.footer}>
          <Button icon={<ArrowLeft />} onClick={() => go(index - 1)} disabled={index === 0}>
            Anterior
          </Button>
          <IconButton label="Leer otra vez" onClick={() => a.say(textFor(index), { voice: true })}>
            <Volume2 />
          </IconButton>
          {index <= total ? (
            <Button variant="primary" onClick={() => go(index + 1)}>
              {index === total ? (
                <>
                  Terminar <Check style={{ width: 16, height: 16, marginLeft: 4, verticalAlign: '-3px' }} />
                </>
              ) : (
                <>
                  Siguiente <ArrowRight style={{ width: 16, height: 16, marginLeft: 4, verticalAlign: '-3px' }} />
                </>
              )}
            </Button>
          ) : (
            <span />
          )}
        </footer>
        {camera && (
          <HandsFreeCamera
            onGesture={onGesture}
            onError={(message) => {
              setCamera(false);
              setCameraError(message);
            }}
          />
        )}
        {cameraError && <p className={styles.hint}>{cameraError}</p>}
        {handsFree && (
          <p className={styles.heard}>
            <Hand aria-hidden="true" /> {heard ? `He oído: «${heard}»` : 'Escuchando…'}
          </p>
        )}
        {!prefs.assistantVoice && <p className={styles.hint}>Tom no lee en voz alta: actívalo en su panel (altavoz).</p>}
      </div>
    </div>
  );
}
