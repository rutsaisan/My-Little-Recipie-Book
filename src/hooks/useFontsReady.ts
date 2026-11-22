import { useEffect, useState } from 'react';

/** Tipografías que deben estar cargadas antes de medir las páginas. */
const FONTS = [
  '400 15px "Lora Variable"',
  'italic 400 15px "Lora Variable"',
  '600 15px "Lora Variable"',
  '600 28px "Fraunces Variable"',
  'italic 400 22px "Fraunces Variable"',
  '500 22px "Caveat Variable"',
];

/**
 * `true` cuando las fuentes del libro están listas. Medir con la fuente de
 * reserva daría alturas falsas y el texto se saldría de la página.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const done = () => alive && setReady(true);
    if (!('fonts' in document)) {
      done();
      return;
    }
    // Si alguna fuente fallara, se sigue igualmente a los pocos segundos.
    const timeout = window.setTimeout(done, 4000);
    Promise.all(FONTS.map((font) => document.fonts.load(font, 'Receta ñáéíóú ¿¡')))
      .then(() => document.fonts.ready)
      .then(done, done)
      .finally(() => window.clearTimeout(timeout));
    return () => {
      alive = false;
      window.clearTimeout(timeout);
    };
  }, []);

  return ready;
}
