/**
 * Tom, el ayudante de cocina: un gatito cocinero que vive en la esquina de la
 * mesa. Explica la app, responde dudas de cocina, lee recetas, pone
 * temporizadores y lleva al modo «cocinar paso a paso» o al dictado.
 */
import { BookOpenText, ChefHat, Clapperboard, Mic, MicOff, Play, Send, Timer, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { answerQuestion } from '../../domain/kitchenHelp';
import type { Recipe } from '../../domain/recipe';
import { formatClock } from '../../domain/voiceCommands';
import { listen, speechRecognitionSupported, type Listening } from '../../services/speech/recognition';
import { useAssistant } from '../../state/assistantContext';
import { usePreferences } from '../../state/preferencesContext';
import { Sticker } from '../decor/Sticker';
import { recipeToSpeech } from './recipeSpeech';
import styles from './Assistant.module.css';

const QUICK_TIMERS = [1, 5, 10, 15, 30];
const SUGGESTIONS = ['¿Cómo sustituyo el huevo?', '¿Cuánto es una taza de harina?', '¿Cómo pongo un temporizador?'];
const MOOD_LABEL = {
  idle: 'esperando',
  speaking: 'hablando',
  listening: 'escuchando',
  thinking: 'pensando',
  celebrating: '¡celebrando!',
};

interface AssistantProps {
  /** Receta que se está viendo en el libro (si hay). */
  recipe: Recipe | null;
  onCook: (recipeId: string) => void;
  onDictate: () => void;
  /** Importar una receta de un vídeo (fase 4). */
  onImport: () => void;
  /** Hay otra ventana delante (formulario, cocina…): Tom se esconde un poco. */
  hidden?: boolean;
}

export function Assistant({ recipe, onCook, onDictate, onImport, hidden = false }: AssistantProps) {
  const a = useAssistant();
  const { prefs, setPref } = usePreferences();
  const [question, setQuestion] = useState('');
  const [listening, setListening] = useState<Listening | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const canListen = speechRecognitionSupported();

  useEffect(() => () => listening?.stop(), [listening]);

  useEffect(() => {
    if (!a.panelOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && a.setPanelOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [a]);

  const ask = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setQuestion('');
    a.setMood('thinking');
    window.setTimeout(() => a.say(answerQuestion(q).answer), 450);
  };

  const toggleMic = () => {
    if (listening) {
      listening.stop();
      setListening(null);
      a.setMood('idle');
      return;
    }
    a.setMood('listening');
    const session = listen({
      onInterim: (t) => setQuestion(t),
      onFinal: (t) => {
        setListening(null);
        ask(t);
      },
      onError: (message) => {
        setListening(null);
        a.say(message, { voice: false });
      },
      onEnd: () => setListening(null),
    });
    if (session) setListening(session);
    else a.say('Este navegador no sabe escuchar. Prueba con Chrome o Edge.', { voice: false });
  };

  const ringing = a.timers.filter((t) => t.ringing);

  return (
    <div className={`${styles.root} ${hidden ? styles.hidden : ''}`}>
      {a.panelOpen && (
        <div ref={panelRef} className={`${styles.panel} tex-paper`} role="dialog" aria-label="Tom, tu ayudante de cocina">
          <header className={styles.panelHead}>
            <div>
              <p className={styles.name}>Tom</p>
              <p className={styles.role}>tu ayudante de cocina · {MOOD_LABEL[a.mood]}</p>
            </div>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setPref('assistantVoice', !prefs.assistantVoice)}
              aria-pressed={prefs.assistantVoice}
              aria-label={prefs.assistantVoice ? 'Leer en voz alta: activado' : 'Leer en voz alta: desactivado'}
              title={prefs.assistantVoice ? 'Leo en voz alta' : 'Solo texto'}
            >
              {prefs.assistantVoice ? <Volume2 /> : <VolumeX />}
            </button>
            <button type="button" className={styles.iconBtn} onClick={() => a.setPanelOpen(false)} aria-label="Cerrar">
              <X />
            </button>
          </header>

          {ringing.map((t) => (
            <div key={t.id} className={styles.ringing} role="alert">
              <Timer aria-hidden="true" /> ¡Tiempo! {t.label}
              <button type="button" onClick={() => a.removeTimer(t.id)}>
                Parar
              </button>
            </div>
          ))}

          <div className={styles.actions}>
            {recipe && (
              <>
                <button type="button" className={styles.action} onClick={() => onCook(recipe.id)}>
                  <Play aria-hidden="true" /> Cocinar «{recipe.title}» paso a paso
                </button>
                <button type="button" className={styles.action} onClick={() => a.say(recipeToSpeech(recipe), { voice: true })}>
                  <BookOpenText aria-hidden="true" /> Leer la receta en voz alta
                </button>
              </>
            )}
            <button type="button" className={styles.action} onClick={onDictate}>
              <Mic aria-hidden="true" /> Dictarme una receta nueva
            </button>
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                a.setPanelOpen(false);
                onImport();
              }}
            >
              <Clapperboard aria-hidden="true" /> Sacar una receta de un vídeo
            </button>
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <Timer aria-hidden="true" /> Temporizadores
            </h3>
            {a.timers.filter((t) => !t.ringing).map((t) => (
              <div key={t.id} className={styles.timer}>
                <span className={styles.clock}>{formatClock((t.endsAt - a.now) / 1000)}</span>
                <span className={styles.timerLabel}>{t.label}</span>
                <button type="button" onClick={() => a.removeTimer(t.id)} aria-label={`Cancelar «${t.label}»`}>
                  <X />
                </button>
              </div>
            ))}
            <div className={styles.quick}>
              {QUICK_TIMERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    a.addTimer(m * 60, `${m} min`);
                    a.say(`Vale, te aviso dentro de ${m === 1 ? 'un minuto' : `${m} minutos`}.`);
                  }}
                >
                  {m} min
                </button>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <ChefHat aria-hidden="true" /> Pregúntame
            </h3>
            <form
              className={styles.ask}
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Una duda de cocina o de la app…"
                aria-label="Tu pregunta"
              />
              {canListen && (
                <button type="button" onClick={toggleMic} aria-label={listening ? 'Dejar de escuchar' : 'Preguntar con la voz'}>
                  {listening ? <MicOff /> : <Mic />}
                </button>
              )}
              <button type="submit" aria-label="Preguntar">
                <Send />
              </button>
            </form>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {a.bubble && !a.panelOpen && (
        <p className={`${styles.bubble} tex-paper`} role="status" onClick={a.hush}>
          {a.bubble}
        </p>
      )}

      <button
        type="button"
        className={`${styles.character} ${styles[a.mood]}`}
        onClick={() => {
          if (!a.panelOpen && !a.bubble && a.timers.length === 0) a.say('¡Hola! Soy Tom. ¿En qué te ayudo?', { voice: false });
          a.setPanelOpen(!a.panelOpen);
        }}
        aria-expanded={a.panelOpen}
        aria-label={`Tom, tu ayudante de cocina (${MOOD_LABEL[a.mood]})`}
      >
        <span className={styles.halo} aria-hidden="true" />
        <Sticker id="gato-calico-chef" width={74} />
        {a.mood === 'listening' && <Mic className={styles.badge} aria-hidden="true" />}
        {a.mood === 'thinking' && (
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        {a.mood === 'celebrating' && (
          <span className={styles.sparkles} aria-hidden="true">
            ✦ ✧ ✦
          </span>
        )}
        {a.timers.length > 0 && (
          <span className={`${styles.timerBadge} ${ringing.length ? styles.timerRing : ''}`}>
            {ringing.length ? '¡Ya!' : formatClock((Math.min(...a.timers.map((t) => t.endsAt)) - a.now) / 1000)}
          </span>
        )}
      </button>
    </div>
  );
}
