/**
 * Preparación de las fotos que sube la persona.
 *
 * Las fotos del móvil pueden pesar 5-10 MB; se reducen a un tamaño cómodo
 * para el libro (lado mayor 1600 px) y se guardan como JPEG, respetando la
 * orientación de la cámara (EXIF). Así el almacenamiento local no se llena.
 */

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

export const PHOTO_MAX_SIDE = 1600;
const JPEG_QUALITY = 0.86;

export class ImageReadError extends Error {
  constructor() {
    super('No he podido leer esta imagen. Prueba con una foto JPG o PNG.');
    this.name = 'ImageReadError';
  }
}

export async function prepareImage(file: Blob): Promise<PreparedImage> {
  const source = await decode(file);
  try {
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageReadError();
    // Fondo claro por si la imagen tiene transparencia (el JPEG no la admite).
    ctx.fillStyle = '#fbf8f5';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source.image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new ImageReadError();
    return { blob, width, height };
  } finally {
    source.release();
  }
}

interface Decoded {
  image: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Alternativa para navegadores sin createImageBitmap completo.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return {
        image: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      };
    } catch {
      URL.revokeObjectURL(url);
      throw new ImageReadError();
    }
  }
}
