import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { dataSource } from '../data';
import { createId } from '../domain/ids';
import { primeAlarm, startAlarm, stopAlarm } from '../services/alarm';
import { getTomStatus } from '../services/assistant/tomAI';
import { notify } from '../services/notifications';
import { speak, stopSpeaking } from '../services/speech/synthesis';
import { useAchievements } from './achievementsContext';
import { AssistantContext, type AssistantContextValue, type AssistantMood, type KitchenTimer } from './assistantContext';
import { usePreferences } from './preferencesContext';

/**
 * El ayudante de cocina: su estado de ánimo, lo que dice y los temporizadores
 * (que siguen corriendo aunque se recargue la página).
 */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const { prefs } = usePreferences();
  const { celebration } = useAchievements();
  const [mood, setMoodState] = useState<AssistantMood>('idle');
  const [bubble, setBubble] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [timers, setTimers] = useState<KitchenTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const bubbleTimer = useRef<number | null>(null);
  const voiceRef = useRef(prefs.assistantVoice);
  const loadedTimers = useRef(false);
  const [ai, setAI] = useState<AssistantContextValue['ai']>({ available: null, message: null });
  const lastCheck = useRef(0);

  // ── ¿Hay IA para responder dudas? ──
  const recheckAI = useCallback(() => {
    // Como mucho una comprobación cada 10 segundos.
    if (Date.now() - lastCheck.current < 10_000) return;
    lastCheck.current = Date.now();
    void getTomStatus().then((status) => setAI({ available: status.ai, message: status.message }));
  }, []);
  useEffect(() => {
    lastCheck.current = Date.now();
    let alive = true;
    void getTomStatus().then((status) => alive && setAI({ available: status.ai, message: status.message }));
    return () => {
      alive = false;
    };
  }, []);

  const notifyTimersRef = useRef(prefs.notifications.timers);
  useEffect(() => {
    voiceRef.current = prefs.assistantVoice;
    notifyTimersRef.current = prefs.notifications.timers;
  }, [prefs.assistantVoice, prefs.notifications.timers]);

  const clearBubbleLater = useCallback((ms: number) => {
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => {
      setBubble(null);
      setMoodState((m) => (m === 'speaking' || m === 'celebrating' ? 'idle' : m));
    }, ms);
  }, []);

  const say = useCallback(
    (text: string, options: { voice?: boolean } = {}) => {
      setBubble(text);
      setMoodState('speaking');
      const readTime = Math.min(14000, 2500 + text.length * 55);
      if (options.voice ?? voiceRef.current) {
        speak(text, { onEnd: () => clearBubbleLater(2500) });
        clearBubbleLater(readTime + 4000);
      } else {
        clearBubbleLater(readTime);
      }
    },
    [clearBubbleLater],
  );

  const celebrate = useCallback(
    (text?: string) => {
      setMoodState('celebrating');
      if (text) setBubble(text);
      clearBubbleLater(3500);
    },
    [clearBubbleLater],
  );

  const hush = useCallback(() => {
    stopSpeaking();
    setBubble(null);
    setMoodState('idle');
  }, []);

  const setMood = useCallback((m: AssistantMood) => setMoodState(m), []);

  // Cada insignia nueva hace que el asistente lo celebre.
  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => celebrate(), 0);
    return () => window.clearTimeout(timer);
  }, [celebration, celebrate]);

  // ── Temporizadores ──
  useEffect(() => {
    let alive = true;
    dataSource.settings.get('timers').then((saved) => {
      loadedTimers.current = true;
      if (!alive || !Array.isArray(saved)) return;
      setTimers(saved.map((t) => ({ ...t, ringing: false })));
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loadedTimers.current) return;
    void dataSource.settings.set(
      'timers',
      timers.filter((t) => !t.ringing).map(({ id, label, endsAt, seconds }) => ({ id, label, endsAt, seconds })),
    );
  }, [timers]);

  const active = timers.length > 0;
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  // ¿Ha terminado alguno?
  const due = timers.find((t) => !t.ringing && t.endsAt <= now);
  useEffect(() => {
    if (!due) return;
    const timer = window.setTimeout(() => {
      setTimers((list) => list.map((t) => (t.id === due.id ? { ...t, ringing: true } : t)));
      startAlarm();
      setPanelOpen(true);
      say(`¡Tiempo! Ya ha terminado: ${due.label}.`);
      if (notifyTimersRef.current) {
        void notify('¡Tiempo!', { body: `Ya ha terminado: ${due.label}.`, tag: `timer-${due.id}`, onlyWhenHidden: true });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [due, say]);

  const ringing = timers.some((t) => t.ringing);
  useEffect(() => {
    if (!ringing) {
      stopAlarm();
      return;
    }
    const original = document.title;
    const flash = window.setInterval(() => {
      document.title = document.title.startsWith('⏰') ? original : `⏰ ¡Tiempo! · ${original}`;
    }, 1000);
    return () => {
      window.clearInterval(flash);
      document.title = original;
    };
  }, [ringing]);

  const addTimer = useCallback((seconds: number, label: string) => {
    primeAlarm();
    const timer: KitchenTimer = { id: createId(), label, seconds, endsAt: Date.now() + seconds * 1000, ringing: false };
    setNow(Date.now());
    setTimers((list) => [...list, timer]);
    return timer;
  }, []);

  const removeTimer = useCallback((id: string) => setTimers((list) => list.filter((t) => t.id !== id)), []);

  const value = useMemo<AssistantContextValue>(
    () => ({ mood, bubble, say, setMood, celebrate, hush, panelOpen, setPanelOpen, timers, now, addTimer, removeTimer, ai, recheckAI }),
    [mood, bubble, say, setMood, celebrate, hush, panelOpen, timers, now, addTimer, removeTimer, ai, recheckAI],
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
