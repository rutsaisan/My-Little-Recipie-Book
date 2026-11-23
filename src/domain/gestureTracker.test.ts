import { describe, expect, it } from 'vitest';
import { GestureTracker, type HandFrame } from './gestureTracker';

const hand = (x: number, shape = 'None', y = 0.5): HandFrame => ({ x, y, shape, score: 0.9 });

/** Simula fotogramas cada 66 ms (≈15 por segundo) y devuelve los gestos. */
function play(tracker: GestureTracker, frames: (HandFrame | null)[], start = 0) {
  return frames.map((f, i) => tracker.update(start + i * 66, f)).filter(Boolean);
}

describe('GestureTracker', () => {
  it('deslizar hacia la izquierda es «siguiente»', () => {
    const t = new GestureTracker();
    expect(play(t, [hand(0.75), hand(0.65), hand(0.55), hand(0.45)])).toEqual(['next']);
  });

  it('deslizar hacia la derecha es «anterior»', () => {
    const t = new GestureTracker();
    expect(play(t, [hand(0.3), hand(0.4), hand(0.5), hand(0.6)])).toEqual(['previous']);
  });

  it('un movimiento lento no cuenta como deslizar', () => {
    const t = new GestureTracker();
    const slow = Array.from({ length: 30 }, (_, i) => hand(0.7 - i * 0.01));
    expect(play(t, slow)).toEqual([]);
  });

  it('mover la mano en vertical no pasa de paso', () => {
    const t = new GestureTracker();
    expect(play(t, [hand(0.5, 'None', 0.2), hand(0.45, 'None', 0.5), hand(0.4, 'None', 0.8)])).toEqual([]);
  });

  it('la mano abierta quieta un momento es «palma»', () => {
    const t = new GestureTracker();
    expect(play(t, Array.from({ length: 14 }, () => hand(0.5, 'Open_Palm')))).toEqual(['palm']);
  });

  it('el pulgar arriba quieto es «pulgar»', () => {
    const t = new GestureTracker();
    expect(play(t, Array.from({ length: 14 }, () => hand(0.5, 'Thumb_Up')))).toEqual(['thumbUp']);
  });

  it('tras un gesto hay una pausa para no repetirlo', () => {
    const t = new GestureTracker();
    const swipe = [hand(0.75), hand(0.6), hand(0.45), hand(0.3), hand(0.75), hand(0.6), hand(0.45), hand(0.3)];
    expect(play(t, swipe)).toEqual(['next']);
  });

  it('sin mano no hay gesto y se olvida lo anterior', () => {
    const t = new GestureTracker();
    expect(play(t, [hand(0.75), null, hand(0.5), hand(0.45)])).toEqual([]);
  });

  it('formas poco seguras no cuentan', () => {
    const t = new GestureTracker();
    const unsure = Array.from({ length: 14 }, () => ({ ...hand(0.5, 'Open_Palm'), score: 0.3 }));
    expect(play(t, unsure)).toEqual([]);
  });
});
