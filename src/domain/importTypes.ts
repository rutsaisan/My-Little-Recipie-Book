/**
 * Contrato de la importación desde vídeo (fase 4), compartido por el
 * servidor local y la app. Solo tipos: el servidor los importa con
 * `import type`, así no arrastra código del navegador.
 *
 * Regla de oro: lo que la IA no puede ver ni oír con claridad llega como
 * `null` o con `certain: false`, nunca rellenado a ojo.
 */

export interface ImportedIngredient {
  name: string;
  /** Número tal cual («200», «1/2», «1,5»); null si no se dice ni se ve. */
  quantity: string | null;
  /** Unidad tal como aparece («gramos», «cucharadas»…); null si no hay. */
  unit: string | null;
  /** La IA solo marca true si lo ha oído o leído de forma explícita. */
  certain: boolean;
  /** De dónde sale: audio, texto en pantalla, descripción o imagen. */
  source: 'audio' | 'texto' | 'descripcion' | 'imagen';
}

export interface ImportedStep {
  text: string;
  certain: boolean;
  /** Índice del fotograma que mejor ilustra el paso, o null. */
  frame: number | null;
}

export interface ImportedRecipe {
  title: string | null;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: ImportedIngredient[];
  steps: ImportedStep[];
  notes: string | null;
  /** Fotograma que mejor muestra el plato terminado, o null. */
  coverFrame: number | null;
  /** Lo que la IA no ha podido determinar, dicho con sus palabras. */
  warnings: string[];
}

/** Lo que el servidor sabe hacer en este ordenador. */
export interface ImportCapabilities {
  /** ¿Responde el proveedor de IA (Ollama u otro)? */
  ai: boolean;
  provider: string;
  textModel: string;
  visionModel: string | null;
  /** ¿Puede pasar el audio a texto? */
  transcription: boolean;
  /** ¿Puede descargar vídeos de enlaces (yt-dlp)? */
  links: boolean;
  /** Mensajes para explicar lo que falta. */
  notes: string[];
}

/** Resultado de procesar un enlace. */
export interface LinkResult {
  title: string | null;
  description: string | null;
  /** Vídeo descargado, servido por el servidor local para extraer fotogramas. */
  videoUrl: string | null;
  uploader: string | null;
}

export interface TranscriptResult {
  text: string;
  language: string;
  segments: { start: number; end: number; text: string }[];
}

export interface AnalyzeRequest {
  transcript: string;
  /** Descripción o texto del vídeo (pie de la publicación). */
  description: string;
  /** Fotogramas JPEG en base64 (sin el prefijo data:). */
  frames: string[];
  /** Segundo del vídeo de cada fotograma. */
  frameTimes: number[];
}

export interface AnalyzeResult {
  recipe: ImportedRecipe;
  /** Lo que la IA ha visto en cada fotograma (para mostrarlo al revisar). */
  frameNotes: string[];
}
