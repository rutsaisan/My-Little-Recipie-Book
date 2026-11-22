import type { Announcements, ScreenReaderInstructions, UniqueIdentifier } from '@dnd-kit/core';

/** Mensajes en español para reordenar con teclado y lector de pantalla. */
export function sortableA11y(
  keys: string[],
  noun: string,
): { announcements: Announcements; screenReaderInstructions: ScreenReaderInstructions } {
  const pos = (id: UniqueIdentifier) => keys.indexOf(String(id)) + 1;
  return {
    screenReaderInstructions: {
      draggable: `Para mover este ${noun}, pulsa espacio o intro. Usa las flechas para cambiarlo de sitio y vuelve a pulsar espacio o intro para soltarlo. Escape cancela.`,
    },
    announcements: {
      onDragStart: ({ active }) => `Has cogido el ${noun} ${pos(active.id)}.`,
      onDragOver: ({ active, over }) =>
        over ? `El ${noun} ${pos(active.id)} está ahora en la posición ${pos(over.id)}.` : `Fuera de la lista.`,
      onDragEnd: ({ over }) => (over ? `Colocado en la posición ${pos(over.id)}.` : `Soltado.`),
      onDragCancel: () => 'Movimiento cancelado.',
    },
  };
}
