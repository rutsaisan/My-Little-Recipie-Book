/**
 * Lo que sabe el asistente: cómo usar la app y dudas frecuentes de cocina
 * (sustituciones, equivalencias, trucos). Funciona sin conexión y sin IA:
 * si no encuentra una respuesta fiable, lo dice en lugar de inventar.
 */
import { normalizeText } from './search';

export interface HelpEntry {
  id: string;
  /** Palabras que suelen aparecer en la pregunta (sin tildes). */
  keywords: string[];
  answer: string;
  topic: 'app' | 'cocina';
}

export const HELP: readonly HelpEntry[] = [
  // ── La app ──
  { id: 'crear', topic: 'app', keywords: ['crear', 'nueva', 'escribir', 'anadir', 'receta'], answer: 'Pulsa «Nueva receta» arriba. Puedes escribirla a mano o dictármela con la voz; antes de guardarla siempre la revisas.' },
  { id: 'dictar', topic: 'app', keywords: ['dictar', 'voz', 'hablar', 'dictado'], answer: 'En «Nueva receta» elige «Dictar con la voz». Te pido primero el nombre, luego los ingredientes (uno por frase) y después los pasos. Al final lo revisas en el formulario.' },
  { id: 'cocinar', topic: 'app', keywords: ['cocinar', 'paso', 'guiar', 'guia', 'modo'], answer: 'En la página de una receta pulsa el botón ▶ («Cocinar paso a paso»). Te leo cada paso y puedes decirme «siguiente», «anterior», «repite» o «pon un temporizador de diez minutos».' },
  { id: 'temporizador', topic: 'app', keywords: ['temporizador', 'alarma', 'reloj', 'minutos', 'avisar'], answer: 'Pulsa sobre mí y elige un tiempo en «Temporizadores», o mientras cocinas dime «pon un temporizador de 10 minutos». Te aviso con un sonido cuando termine.' },
  { id: 'buscar', topic: 'app', keywords: ['buscar', 'encontrar', 'donde', 'busco'], answer: 'Usa «Buscar» en la barra de arriba: encuentra recetas por nombre, ingrediente o notas, y filtra favoritas, recientes o por probar.' },
  { id: 'marcapaginas', topic: 'app', keywords: ['marcapaginas', 'marcar', 'pagina', 'cinta'], answer: 'Con «Marcar página» cae la cinta en la página que estás viendo; púlsala desde cualquier sitio del libro para volver.' },
  { id: 'insignias', topic: 'app', keywords: ['insignia', 'insignias', 'pegatina', 'pegatinas', 'album', 'logro'], answer: 'Ganas insignias escribiendo recetas y cocinándolas (pulsa la olla al terminar un plato). Están en «Mi álbum de insignias», en el menú ⋯, y sus pegatinas decoran la portada.' },
  { id: 'personalizar', topic: 'app', keywords: ['personalizar', 'nombre', 'portada', 'mantel', 'musica', 'color'], answer: 'En el menú ⋯, «Personalizar el libro»: tu nombre, la frase de la portada, las pegatinas, el mantel, la música y más.' },
  { id: 'comensales', topic: 'app', keywords: ['comensales', 'raciones', 'personas', 'cantidades', 'recalcular'], answer: 'En la página de la receta usa − y + junto a «comensales» y recalculo todas las cantidades.' },
  { id: 'guardar', topic: 'app', keywords: ['guardan', 'guardar', 'datos', 'perder', 'movil', 'ordenador'], answer: 'Tus recetas se guardan en este navegador. Cada navegador o dispositivo tiene su propio libro, y si borras los datos del sitio se borran también.' },
  // ── Cocina ──
  { id: 'huevo', topic: 'cocina', keywords: ['sustituir', 'cambiar', 'sin', 'huevo', 'huevos'], answer: 'En bizcochos, un huevo se puede cambiar por una cucharada de semillas de lino molidas con tres de agua (reposadas 10 minutos), o por medio plátano maduro chafado. En recetas donde el huevo es protagonista no hay buen sustituto.' },
  { id: 'mantequilla-aceite', topic: 'cocina', keywords: ['mantequilla', 'aceite', 'sustituir', 'cambiar'], answer: 'Para masas, 100 g de mantequilla equivalen a unos 80 ml de aceite suave (girasol u oliva suave). El resultado queda algo más húmedo y menos «mantecoso».' },
  { id: 'levadura', topic: 'cocina', keywords: ['levadura', 'quimica', 'polvo', 'hornear', 'royal', 'fresca', 'panadero'], answer: 'La levadura química (impulsor, tipo Royal) es para bizcochos y actúa con el calor. La de panadero (fresca o seca) es para masas que fermentan. No se cambian una por otra. 25 g de levadura fresca equivalen a unos 7 g de seca.' },
  { id: 'taza', topic: 'cocina', keywords: ['taza', 'gramos', 'cuanto', 'equivale', 'harina', 'azucar'], answer: 'Aproximadamente, una taza (240 ml) son unos 120–130 g de harina, 200 g de azúcar, 240 ml de leche o agua y unos 200 g de arroz.' },
  { id: 'cucharada', topic: 'cocina', keywords: ['cucharada', 'cucharadita', 'ml', 'gramos', 'equivale', 'cuanto'], answer: 'Una cucharada son unos 15 ml y una cucharadita unos 5 ml. De azúcar o harina, una cucharada rasa son unos 10–12 g.' },
  { id: 'buttermilk', topic: 'cocina', keywords: ['buttermilk', 'suero', 'mazada', 'leche', 'agria'], answer: 'Para hacer «buttermilk» casero mezcla 250 ml de leche con una cucharada de zumo de limón o vinagre y deja reposar 10 minutos.' },
  { id: 'nata', topic: 'cocina', keywords: ['nata', 'montar', 'montada', 'crema'], answer: 'La nata para montar necesita al menos un 30–35 % de grasa y estar muy fría (también el bol). Bate a velocidad media y para en cuanto forme picos: si te pasas, se corta.' },
  { id: 'harina-fuerza', topic: 'cocina', keywords: ['harina', 'fuerza', 'reposteria', 'normal', 'trigo'], answer: 'La harina de fuerza tiene más proteína y sirve para panes y masas elásticas; la floja o de repostería, para bizcochos y galletas. La «de trigo normal» queda en medio y vale para casi todo en casa.' },
  { id: 'bizcocho-hecho', topic: 'cocina', keywords: ['bizcocho', 'hecho', 'saber', 'palillo', 'crudo'], answer: 'Pincha el centro con un palillo: si sale limpio o con migas secas, está hecho. No abras el horno en los primeros dos tercios del tiempo o puede bajarse.' },
  { id: 'horno', topic: 'cocina', keywords: ['horno', 'grados', 'ventilador', 'temperatura', 'aire'], answer: 'Con ventilador (aire) suele bastar con bajar unos 20 °C la temperatura de la receta. Precalienta siempre al menos 10 minutos.' },
  { id: 'azucar-moreno', topic: 'cocina', keywords: ['azucar', 'moreno', 'blanco', 'panela', 'sustituir'], answer: 'Puedes cambiar azúcar moreno por blanco en la misma cantidad; el moreno da más humedad y sabor a caramelo.' },
  { id: 'sal-dulce', topic: 'cocina', keywords: ['sal', 'dulce', 'postre', 'pizca'], answer: 'Una pizca de sal en dulces realza el sabor y equilibra el azúcar; no se nota salado.' },
  { id: 'ajo-cebolla', topic: 'cocina', keywords: ['cebolla', 'ajo', 'pochar', 'quemar', 'sofrito'], answer: 'Para pochar la cebolla, fuego medio-bajo y paciencia (10–15 minutos). El ajo se quema enseguida: añádelo al final del sofrito.' },
  { id: 'arroz', topic: 'cocina', keywords: ['arroz', 'agua', 'cuanto', 'proporcion'], answer: 'Para arroz blanco suele funcionar 1 parte de arroz por 2 de agua (en volumen), unos 15–18 minutos a fuego bajo y tapado, y reposar 5 minutos.' },
  { id: 'chocolate', topic: 'cocina', keywords: ['chocolate', 'derretir', 'fundir', 'microondas', 'bano'], answer: 'Funde el chocolate al baño maría o en el microondas a golpes de 20–30 segundos, removiendo entre medias. Evita que le caiga agua: se apelmaza.' },
  { id: 'conservar', topic: 'cocina', keywords: ['conservar', 'nevera', 'dura', 'cuantos', 'dias', 'congelar'], answer: 'Como norma general, la comida cocinada aguanta 3–4 días en la nevera bien tapada, y se puede congelar unos 3 meses. Ante la duda, mejor no arriesgarse.' },
];

const STOP = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'que', 'como', 'un', 'una', 'por', 'en', 'y', 'o', 'a', 'se', 'me', 'mi', 'es', 'con', 'para', 'puedo', 'hago', 'hacer', 'si', 'no', 'lo', 'le']);

export interface HelpAnswer {
  answer: string;
  /** false si no se encontró nada fiable. */
  known: boolean;
}

export function answerQuestion(question: string): HelpAnswer {
  const words = normalizeText(question)
    .replace(/[¿?¡!.,;:]/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w));
  if (!words.length) return { answer: '¿Qué quieres saber? Puedes preguntarme por la app o por algún ingrediente.', known: false };

  let best: { entry: HelpEntry; score: number } | null = null;
  for (const entry of HELP) {
    const score = entry.keywords.filter((k) => words.some((w) => w === k || (w.length > 4 && k.startsWith(w.slice(0, -1))))).length;
    if (score > (best?.score ?? 0)) best = { entry, score };
  }
  if (!best || best.score < 2) {
    return {
      answer:
        'Esa no la sé con seguridad y prefiero no inventármela. Puedo ayudarte con sustituciones habituales (huevo, mantequilla, levadura…), equivalencias de tazas y cucharadas o con cómo usar el recetario.',
      known: false,
    };
  }
  return { answer: best.entry.answer, known: true };
}
