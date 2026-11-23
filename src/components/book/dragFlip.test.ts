import { describe, expect, it } from 'vitest';
import { readPreferences } from '../../state/preferencesContext';
import { createDragFlip, shouldCommit } from './dragFlip';

describe('paso de página arrastrando', () => {
  it('el mando limita el progreso y avisa a quien escucha', () => {
    const drag = createDragFlip();
    const seen: number[] = [];
    drag.subscribe(() => seen.push(drag.progress));
    drag.set(0.4);
    drag.set(1.7);
    drag.set(-2);
    expect(seen).toEqual([0.4, 1, 0]);
  });

  it('al soltar ya no se mueve', () => {
    const drag = createDragFlip();
    drag.set(0.5);
    drag.end('commit');
    drag.set(0.1);
    drag.end('cancel');
    expect(drag.progress).toBe(0.5);
    expect(drag.release).toBe('commit');
  });

  it('pasa la página si se lleva lejos o se lanza rápido', () => {
    expect(shouldCommit(0.5, 0)).toBe(true);
    expect(shouldCommit(0.2, 0)).toBe(false);
    expect(shouldCommit(0.1, 1.2)).toBe(true);
    expect(shouldCommit(0.6, -1)).toBe(false);
  });
});

describe('preferencias nuevas', () => {
  it('tienen valores por defecto seguros', () => {
    const p = readPreferences({});
    expect(p.privacyAccepted).toBe(false);
    expect(p.notifications).toEqual({ timers: false, imports: false, toTry: false });
    expect(p.assistantPosition).toEqual({ side: 'right', y: 1 });
  });

  it('corrigen lo que llega mal guardado', () => {
    const p = readPreferences({ assistantPosition: { side: 'arriba' as 'left', y: 7 }, notifications: { timers: true } as never });
    expect(p.assistantPosition).toEqual({ side: 'right', y: 1 });
    expect(p.notifications.timers).toBe(true);
    expect(p.notifications.toTry).toBe(false);
  });
});
