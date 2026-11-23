/**
 * Mando del paso de página arrastrando (dedo o ratón).
 *
 * El gesto cambia el progreso muchas veces por segundo; en vez de pasar por
 * el estado de React (que volvería a pintar todo el libro), la hoja se
 * suscribe a este pequeño objeto y mueve su animación directamente.
 */
export type DragRelease = 'commit' | 'cancel';

export interface DragFlipController {
  /** 0 = hoja en reposo, 1 = página pasada. */
  readonly progress: number;
  readonly release: DragRelease | null;
  set(progress: number): void;
  end(release: DragRelease): void;
  subscribe(listener: () => void): () => void;
}

export function createDragFlip(): DragFlipController {
  const listeners = new Set<() => void>();
  const state = { progress: 0, release: null as DragRelease | null };
  const emit = () => listeners.forEach((l) => l());
  return {
    get progress() {
      return state.progress;
    },
    get release() {
      return state.release;
    },
    set(progress) {
      if (state.release) return;
      state.progress = Math.min(1, Math.max(0, progress));
      emit();
    },
    end(release) {
      if (state.release) return;
      state.release = release;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * ¿Se completa el paso al soltar? Si se ha llevado la hoja más de un tercio,
 * o si se ha lanzado con un gesto rápido en esa dirección.
 */
export function shouldCommit(progress: number, velocity: number): boolean {
  if (velocity > 0.6 && progress > 0.04) return true;
  if (velocity < -0.6) return false;
  return progress > 0.33;
}
