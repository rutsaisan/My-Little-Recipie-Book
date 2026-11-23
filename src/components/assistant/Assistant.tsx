/**
 * Tom, el ayudante de cocina: un gatito cocinero que vive en la esquina de la
 * mesa. Explica la app, responde dudas de cocina, lee recetas, pone
 * temporizadores y lleva al modo «cocinar paso a paso» o al dictado.
 */
import { BookOpenText, ChefHat, Clapperboard, Mic, MicOff, Play, Send, Timer, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import type { Recipe } from '../../domain/recipe';
import { formatClock } from '../../domain/voiceCommands';
import { useViewport } from '../../hooks/useViewport';
import { askTom } from '../../services/assistant/tomAI';
import { listen, speechRecognitionSupported, type Listening } from '../../services/speech/recognition';
import { useAssistant } from '../../state/assistantContext';
import { usePreferences } from '../../state/preferencesContext';
import { Sticker } from '../decor/Sticker';
import { AiNotice } from '../notice/AiNotice';
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
  const viewport = useViewport();
  const narrow = viewport.width < 620;
  const [aiHelp, setAiHelp] = useState(false);
  /** Última pregunta y su respuesta, para leerla dentro del panel. */
  const [exchange, setExchange] = useState<{ q: string; a: string | null } | null>(null);
  const aiReady = a.ai.available === true;
  const { recheckAI } = a;

  // Al abrir el panel se vuelve a mirar si la IA está disponible.
  useEffect(() => {
    if (a.panelOpen && !aiReady) recheckAI();
  }, [a.panelOpen, aiReady, recheckAI]);

  // ── Mover a Tom arrastrándolo ─────────────────────────────────────────────
  const size = narrow ? 64 : 84;
  const margin = narrow ? 10 : 14;
  const { side, y } = prefs.assistantPosition;
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ id: number; dx: number; dy: number; x0: number; y0: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  // Zonas libres: la barra de arriba y, en el móvil, la de paginación de abajo.
  const topReserve = 56;
  const bottomReserve = narrow ? 70 : 0;
  const travel = Math.max(0, viewport.height - size - margin * 2 - topReserve - bottomReserve);
  const restTop = margin + topReserve + y * travel;
  const onTop = restTop + size / 2 < viewport.height / 2;

  const onCharacterDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    drag.current = {
      id: event.pointerId,
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
      x0: event.clientX,
      y0: event.clientY,
      moved: false,
    };
  };
  const onCharacterMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    if (!d.moved) {
      if (Math.hypot(event.clientX - d.x0, event.clientY - d.y0) < 8) return;
      d.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      a.setPanelOpen(false);
    }
    setDragPos({
      x: Math.min(viewport.width - size, Math.max(0, event.clientX - d.dx)),
      y: Math.min(viewport.height - size, Math.max(0, event.clientY - d.dy)),
    });
  };
  const onCharacterUp = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== event.pointerId || !d.moved || !dragPos) return;
    justDragged.current = true;
    // Se queda pegado al borde más cercano, a la altura donde se soltó.
    const nextSide = dragPos.x + size / 2 < viewport.width / 2 ? 'left' : 'right';
    const nextY = travel > 0 ? Math.min(1, Math.max(0, (dragPos.y - margin - topReserve) / travel)) : 1;
    setPref('assistantPosition', { side: nextSide, y: nextY });
    setDragPos(null);
  };

  const rootStyle: CSSProperties = dragPos
    ? { left: dragPos.x, top: dragPos.y, right: 'auto', bottom: 'auto', transition: 'none' }
    : {
        top: onTop ? restTop : 'auto',
        bottom: onTop ? 'auto' : Math.max(margin, viewport.height - restTop - size),
        left: side === 'left' ? margin : 'auto',
        right: side === 'right' ? margin : 'auto',
      };

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
    if (!aiReady) return;
    setQuestion('');
    setExchange({ q, a: null });
    a.setMood('thinking');
    askTom(q, recipe)
      .then((answer) => {
        setExchange({ q, a: answer });
        a.say(answer);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'No he podido pensar la respuesta.';
        setExchange({ q, a: message });
        a.say(message, { voice: false });
        recheckAI();
      });
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
    <div
      className={[
        styles.root,
        side === 'left' && !dragPos ? styles.leftSide : '',
        onTop && !dragPos ? styles.topSide : '',
        dragPos ? styles.moving : '',
        hidden ? styles.hidden : '',
      ].join(' ')}
      style={rootStyle}
    >
      {a.panelOpen && narrow && <div className={styles.sheetBackdrop} onClick={() => a.setPanelOpen(false)} aria-hidden="true" />}
      {a.panelOpen && (
        <div
          ref={panelRef}
          className={`${styles.panel} ${narrow ? styles.sheet : ''} tex-paper`}
          role="dialog"
          aria-label="Tom, tu ayudante de cocina"
        >
          <header className={styles.panelHead}>
            <Sticker id="gato-calico-chef" width={44} className={styles.sheetTom} />
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
            {!aiReady && a.ai.available === false && (
              <>
                <AiNotice message={a.ai.message} onRetry={recheckAI} onHelp={() => setAiHelp((v) => !v)} />
                {aiHelp && (
                  <p className={styles.aiHelp}>
                    Ollama es un programa gratuito que hace funcionar modelos de IA en tu propio ordenador, sin enviar
                    nada fuera. Instálalo desde ollama.com, descarga el modelo con «ollama pull qwen3:8b» y abre esta app
                    con «npm run dev». En la versión de internet no se puede usar.
                  </p>
                )}
              </>
            )}
            {a.ai.available === null && <p className={styles.aiHelp}>Comprobando si puedo pensar con IA…</p>}
            {exchange && (
              <div className={styles.exchange} aria-live="polite">
                <p className={styles.exchangeQ}>{exchange.q}</p>
                <p className={styles.exchangeA}>{exchange.a ?? 'Pensando…'}</p>
              </div>
            )}
            <form
              className={`${styles.ask} ${aiReady ? '' : styles.askOff}`}
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
              aria-disabled={!aiReady}
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={aiReady ? 'Una duda de cocina o de la app…' : 'Necesito Ollama para responder'}
                aria-label="Tu pregunta"
                disabled={!aiReady}
              />
              {canListen && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={!aiReady}
                  aria-label={listening ? 'Dejar de escuchar' : 'Preguntar con la voz'}
                >
                  {listening ? <MicOff /> : <Mic />}
                </button>
              )}
              <button type="submit" aria-label="Preguntar" disabled={!aiReady}>
                <Send />
              </button>
            </form>
            <div className={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} disabled={!aiReady}>
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
        style={{ width: size, height: size }}
        onPointerDown={onCharacterDown}
        onPointerMove={onCharacterMove}
        onPointerUp={onCharacterUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragPos(null);
        }}
        onClick={() => {
          if (justDragged.current) {
            justDragged.current = false;
            return;
          }
          if (!a.panelOpen && !a.bubble && a.timers.length === 0) a.say('¡Hola! Soy Tom. ¿En qué te ayudo?', { voice: false });
          a.setPanelOpen(!a.panelOpen);
        }}
        aria-expanded={a.panelOpen}
        aria-label={`Tom, tu ayudante de cocina (${MOOD_LABEL[a.mood]}). Puedes arrastrarlo para moverlo.`}
        title="Pulsa para hablar con Tom · arrastra para moverlo"
      >
        <span className={styles.halo} aria-hidden="true" />
        <Sticker id="gato-calico-chef" width={size - 10} />
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
