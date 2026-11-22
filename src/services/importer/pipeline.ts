/**
 * Orquesta la importación de una receta desde un vídeo, paso a paso, e
 * informa del progreso para que la interfaz lo muestre.
 *
 *   enlace ─┐
 *   vídeo ──┼─► fotogramas ─► audio → texto ─► IA (imágenes + texto) ─► fotos ─► revisión
 *   texto ──┘
 *
 * Si algo no se puede hacer (no hay voz, no hay modelo de visión, no se
 * puede descargar el enlace) se salta y se dice, nunca se rellena a ojo.
 */
import type { ImportCapabilities, ImportedRecipe } from '../../domain/importTypes';
import { analyze, downloadVideo, processLink, transcribeAudio } from './api';
import { extractAudio, extractFrames, frameForAI, releaseFrames, spreadIndices, type VideoFrame } from './media';

export type ImportInput = { kind: 'link'; url: string } | { kind: 'file'; file: File } | { kind: 'text'; text: string };

export type StageId = 'source' | 'frames' | 'audio' | 'vision' | 'recipe' | 'photos' | 'review';
export type StageStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

export interface Stage {
  id: StageId;
  label: string;
  status: StageStatus;
  detail?: string;
}

export const STAGE_LABELS: Record<StageId, string> = {
  source: 'Abrir el vídeo',
  frames: 'Sacar fotogramas',
  audio: 'Escuchar y transcribir el audio',
  vision: 'Reconocer ingredientes en las imágenes',
  recipe: 'Detectar cantidades y pasos, y ordenarlos',
  photos: 'Elegir las fotos más representativas',
  review: 'Preparar la vista previa para revisar',
};

export function initialStages(): Stage[] {
  return (Object.keys(STAGE_LABELS) as StageId[]).map((id) => ({ id, label: STAGE_LABELS[id], status: 'pending' }));
}

export interface ImportOutcome {
  recipe: ImportedRecipe;
  /** Fotogramas candidatos para elegir fotos. */
  frames: VideoFrame[];
  /** Foto propuesta para el plato terminado (índice en `frames`), o null. */
  coverIndex: number | null;
  /** Foto propuesta para cada paso (índice en `frames`), o null. */
  stepFrames: (number | null)[];
  transcript: string;
  description: string;
  url: string | null;
  /** Avisos del proceso (lo que no se ha podido hacer). */
  notes: string[];
}

const CANDIDATE_FRAMES = 12;
const AI_FRAMES = 8;

export class ImportCancelled extends Error {
  constructor() {
    super('Importación cancelada.');
    this.name = 'ImportCancelled';
  }
}

export async function runImport(
  input: ImportInput,
  capabilities: ImportCapabilities,
  onStage: (id: StageId, status: StageStatus, detail?: string) => void,
  signal: AbortSignal,
): Promise<ImportOutcome> {
  const check = () => {
    if (signal.aborted) throw new ImportCancelled();
  };
  const notes: string[] = [];
  let description = '';
  let transcript = '';
  let url: string | null = null;
  let video: Blob | null = null;
  let frames: VideoFrame[] = [];

  try {
    // 1. Origen
    onStage('source', 'active');
    if (input.kind === 'link') {
      url = input.url.trim();
      const link = await processLink(url);
      description = [link.title, link.description].filter(Boolean).join('\n');
      notes.push(...link.notes);
      if (link.videoUrl) video = await downloadVideo(link.videoUrl);
      onStage('source', 'done', video ? 'Vídeo descargado' : 'Solo el texto de la publicación');
    } else if (input.kind === 'file') {
      video = input.file;
      onStage('source', 'done', input.file.name);
    } else {
      transcript = input.text.trim();
      onStage('source', 'done', 'Texto pegado');
    }
    check();

    // 2. Fotogramas
    if (video) {
      onStage('frames', 'active');
      const src = URL.createObjectURL(video);
      try {
        const result = await extractFrames(src, CANDIDATE_FRAMES, (done, total) =>
          onStage('frames', 'active', `${done} de ${total}`),
        );
        frames = result.frames;
      } finally {
        URL.revokeObjectURL(src);
      }
      onStage('frames', 'done', `${frames.length} fotogramas`);
    } else onStage('frames', 'skipped', 'No hay vídeo');
    check();

    // 3. Audio → texto
    if (video && capabilities.transcription) {
      onStage('audio', 'active', 'Puede tardar un par de minutos');
      const pcm = await extractAudio(video);
      if (pcm) {
        const result = await transcribeAudio(pcm);
        transcript = result.text.trim();
        onStage('audio', transcript ? 'done' : 'skipped', transcript ? `${transcript.split(/\s+/).length} palabras` : 'No se oye voz');
        if (!transcript) notes.push('En el vídeo no se oye a nadie explicar la receta.');
      } else {
        onStage('audio', 'skipped', 'El vídeo no tiene voz');
        notes.push('El vídeo no tiene sonido que transcribir.');
      }
    } else if (video) {
      onStage('audio', 'skipped', 'Whisper no está instalado');
      notes.push('No se ha podido escuchar el audio (falta Whisper en este ordenador).');
    } else onStage('audio', input.kind === 'text' ? 'done' : 'skipped', input.kind === 'text' ? 'Texto pegado' : 'No hay vídeo');
    check();

    // 4 y 5. IA: imágenes + texto
    const useVision = frames.length > 0 && capabilities.visionModel !== null;
    const aiIndices = useVision ? spreadIndices(frames.length, AI_FRAMES) : [];
    const aiFrames = await Promise.all(aiIndices.map((i) => frameForAI(frames[i])));
    check();
    if (useVision) onStage('vision', 'active', `${aiFrames.length} imágenes`);
    else onStage('vision', 'skipped', frames.length ? 'No hay modelo de visión' : 'No hay imágenes');
    onStage('recipe', 'active', useVision ? 'Esperando a las imágenes' : undefined);

    const result = await analyze({
      transcript,
      description,
      frames: aiFrames,
      frameTimes: aiIndices.map((i) => frames[i].time),
    });
    check();
    if (useVision) onStage('vision', 'done');
    const r = result.recipe;
    onStage('recipe', 'done', `${r.ingredients.length} ingredientes · ${r.steps.length} pasos`);

    // 6. Fotos
    let coverIndex: number | null = null;
    let stepFrames: (number | null)[] = r.steps.map(() => null);
    if (frames.length) {
      onStage('photos', 'active');
      const toCandidate = (aiIndex: number | null) => (aiIndex === null ? null : (aiIndices[aiIndex] ?? null));
      // Si la IA no ha elegido, se propone el último fotograma: suele ser el plato terminado.
      coverIndex = toCandidate(r.coverFrame) ?? frames.length - 1;
      stepFrames = r.steps.map((s) => toCandidate(s.frame));
      onStage('photos', 'done', r.coverFrame === null ? 'Propuesta: el último fotograma' : undefined);
    } else onStage('photos', 'skipped', 'No hay imágenes');

    onStage('review', 'done');
    return { recipe: r, frames, coverIndex, stepFrames, transcript, description, url, notes };
  } catch (error) {
    releaseFrames(frames);
    throw error;
  }
}
