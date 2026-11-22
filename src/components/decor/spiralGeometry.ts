/**
 * Medidas compartidas entre la espiral y los agujeros de las páginas
 * (px virtuales), para que cada anilla entre justo en su agujero.
 */

/** Separación entre anillas. */
export const RING_PITCH = 32;
/** Altura de la primera anilla. */
export const RING_START = 26;
/** Distancia del agujero al lomo (o al borde, en modo una página). */
export const HOLE_OFFSET = 22;

export function ringCount(height: number): number {
  return Math.max(1, Math.floor((height - RING_START - 14) / RING_PITCH) + 1);
}
