# Arquitectura de *My Little Recipe Book*

Este documento explica cómo está montada la aplicación, por qué, y dónde
encaja cada una de las fases siguientes sin tener que rehacer nada.

---

## 1. Decisiones principales

| Necesidad | Decisión | Motivo |
|---|---|---|
| Interfaz muy visual y animada | **React 19 + TypeScript + Vite** | Componentes reutilizables, tipos que evitan errores al crecer, recarga instantánea al desarrollar. |
| Estilos con personalidad | **CSS Modules** + variables CSS globales (`styles/tokens.css`) | Cada componente tiene su `.module.css` al lado; la paleta y las texturas son comunes. Sin librerías de componentes «de dashboard». |
| Guardar recetas y fotos sin servidor | **IndexedDB** (con la librería `idb`) | Funciona sin conexión, guarda fotos como `Blob` sin convertirlas a texto y no tiene el límite de 5 MB de `localStorage`. |
| Poder añadir base de datos y cuentas | **Repositorios con interfaz** (`data/types.ts`) | La app solo habla con interfaces. Hoy hay una implementación IndexedDB; mañana se añade otra que hable con un backend. |
| Que parezca un libro de verdad | **Maquetador propio** (`layout/`) | Mide el contenido real y lo reparte en páginas de tamaño fijo, como un recetario impreso, en lugar de hacer scroll. |
| Pasar páginas con realismo | **Web Animations API** + CSS 3D | Giro 3D de la hoja sobre la espiral, con sombras; sin dependencias pesadas. |
| Reordenar pasos | **@dnd-kit** | Arrastrar con ratón, dedo o teclado (accesible). |

La app es *local-first*: las recetas viven en el navegador. Desde la fase 4
hay además un **servidor local pequeño** (`server/`) que solo atiende la
importación con IA; las claves privadas de servicios externos viven allí,
nunca en el navegador (ver § 7).

---

## 2. Capas y carpetas

```
My Little Recipe Book/
├─ index.html               Página base (idioma, iconos, título)
├─ .env.example             Variables de entorno de ejemplo (sin secretos)
├─ public/                  Ficheros servidos tal cual (favicon)
├─ assets-src/characters/   Ilustraciones recortadas en PNG (originales sin pérdida)
├─ tools/
│  └─ remove_backgrounds.py Quita el fondo a las ilustraciones de referencia
├─ docs/                    Documentación (este archivo)
├─ server/                  SERVIDOR LOCAL DE IMPORTACIÓN (fase 4, Node sin compilar)
│  ├─ index.ts             Rutas /api/import/* (solo escucha en 127.0.0.1)
│  ├─ config.ts            Variables de entorno (.env) — aquí viven las claves
│  ├─ providers/           Proveedores de IA intercambiables (Ollama, API tipo OpenAI)
│  ├─ analyze.ts           Fotogramas + texto → receta (instrucciones y esquema)
│  ├─ verify.ts            Comprobaciones contra la invención
│  ├─ transcribe.ts/.py    Audio → texto con Whisper
│  └─ link.ts              Enlaces de TikTok/Instagram (yt-dlp opcional)
└─ src/
   ├─ main.tsx              Arranque: fuentes, estilos globales y <App/>
   ├─ app/                  Composición de la aplicación (libro + formulario + diálogos)
   ├─ assets/               RECURSOS GRÁFICOS
   │  ├─ characters/        Animalitos en WebP + catálogo (`index.ts`)
   │  └─ textures/          Grano de papel y trama de lino (SVG)
   ├─ styles/               ESTILOS GLOBALES: paleta, base, texturas, animaciones
   ├─ domain/               LÓGICA DE NEGOCIO pura (sin React ni base de datos)
   │  ├─ recipe.ts          Modelo de receta y lectura defensiva (`normalizeRecipe`)
   │  ├─ draft.ts           Borrador del formulario, validación y conversión
   │  ├─ categories.ts      Secciones del libro
   │  ├─ units.ts           Unidades de medida
   │  ├─ quantities.ts      Leer/escribir cantidades («1/2», «1,5», «½»)
   │  ├─ ingredients.ts     «200 g de harina» y recálculo por comensales
   │  ├─ importTypes.ts     Contrato de la importación (compartido con server/)
   │  └─ importDraft.ts     Resultado de la IA → borrador con «pendientes»
   ├─ data/                 GESTIÓN DE DATOS
   │  ├─ types.ts           Interfaces de los repositorios
   │  ├─ index.ts           Elige la implementación (VITE_DATA_SOURCE)
   │  └─ indexeddb/         Esquema, migraciones y repositorios IndexedDB
   ├─ services/             SERVICIOS (casos de uso y utilidades del navegador)
   │  ├─ recipeService.ts   Guardar/borrar recetas con sus fotos de forma atómica
   │  ├─ imageProcessing.ts Reducir y orientar las fotos subidas
   │  ├─ photoUrls.ts       URLs temporales de las fotos (con caché)
   │  └─ importer/          Fotogramas y audio del vídeo, cliente del servidor y orquestación
   ├─ state/                Estado compartido de React (recetas, avisos)
   ├─ hooks/                Lógica reutilizable (tamaño de pantalla, fuentes, ajustes…)
   ├─ layout/               MAQUETADOR del libro
   │  ├─ geometry.ts        Tamaños de página y escala según la pantalla
   │  ├─ Measurer.tsx       Mide el contenido fuera de la pantalla
   │  ├─ paginate.ts        Reparte cada receta y el índice en páginas (puro)
   │  ├─ buildBook.ts       Ordena todas las páginas del libro (puro)
   │  └─ useBookLayout.tsx  Orquesta medir → paginar → montar (con caché)
   └─ components/           COMPONENTES (cada uno con su .module.css)
      ├─ ui/                Botones, diálogo, avisos
      ├─ decor/             Pegatinas, espiral, adornos, colores de sección
      ├─ cover/             Tapa del cuaderno
      ├─ book/              Escena, libro, hoja que gira, pestañas, marcapáginas
      ├─ pages/             Tipos de página (portadilla, índice, separador, receta…)
      ├─ recipe/            Piezas de una receta (cabecera, ingrediente, paso…)
      ├─ editor/            Formulario de receta (apartados, fotos, reordenación, «Por confirmar»)
      └─ importer/          Ventana «Importar de un vídeo» (origen, progreso, fotos)
```

Reglas de dependencia (de dentro a fuera):

```
domain  ←  data  ←  services  ←  state  ←  components / app
   ↑                                 ↑
 layout (usa domain y, para medir, los componentes de receta)
```

`domain/` no importa nada de React ni del navegador: se prueba con tests
unitarios y se podría reutilizar en un backend.

---

## 3. Flujo de datos

```
Formulario (editor/) ──borrador──▶ recipeService.saveRecipeDraft
                                        │  · valida el borrador
                                        │  · decide qué fotos nuevas guardar y cuáles sobran
                                        ▼
                         RecipeRepository.save(receta, {add, remove})   ← una sola transacción
                                        │
RecipesProvider (state/) ◀──────────────┘   (lista de recetas en memoria)
        │
        ▼
BookScene ──▶ useBookLayout ──▶ Measurer (mide) ──▶ paginate + buildBook ──▶ Book ──▶ PageView
```

- Las fotos nuevas viven en memoria mientras se edita. Si se cancela, no
  queda nada guardado; al guardar, receta y fotos se escriben juntas.
- Al borrar una receta se borran también sus fotos (no quedan huérfanas).
- Todo dato leído de la base de datos pasa por `normalizeRecipe`, que
  rellena valores por defecto: añadir campos en el futuro no rompe recetas
  antiguas.

---

## 4. El maquetador: cómo se convierten las recetas en páginas

1. **Tamaño virtual fijo.** Cada página se maqueta en píxeles «virtuales»
   (p. ej. 500 × 620) y el libro entero se escala para caber en pantalla.
   Así lo que se mide es exactamente lo que se pinta.
2. **Medir.** `Measurer` pinta, invisible y fuera de la pantalla, las mismas
   piezas que usan las páginas (cabecera, cada ingrediente, cada paso…) con
   el mismo ancho, y anota sus alturas. Hay caché por receta: solo se vuelve
   a medir lo que cambia.
3. **Paginar** (`paginate.ts`, funciones puras con tests):
   - título y datos arriba;
   - ingredientes en columna con la foto del plato al lado (o un animalito si
     no hay foto); si no caben, siguen a todo el ancho en la página siguiente;
   - pasos sin partir nunca un paso; con fotos del proceso, en dos columnas
     equilibradas en el libro abierto;
   - el encabezado de ingredientes no se queda solo al pie de página;
   - notas personales al final.
4. **Montar el libro** (`buildBook.ts`): guardas, portadilla, índice,
   separadores por sección y recetas. En el libro abierto, los separadores van
   en página derecha y las recetas de 2+ páginas empiezan en la izquierda
   (para verlas enteras), añadiendo láminas o páginas decorativas si hace
   falta. En móvil, simplemente una detrás de otra.
5. **Red de seguridad:** si por cualquier motivo algo no cupiera, esa página
   se puede desplazar en vez de cortar el texto.

### Pantallas

| Pantalla | Modo | Tamaño de página |
|---|---|---|
| Ordenador / tableta horizontal | Libro abierto (dos páginas) | Cuatro tamaños fijos; se elige el mayor que se lea cómodo |
| Móvil / tableta vertical | Una página | Se adapta al ancho para ver el texto a tamaño real (redondeado a saltos de 20/40 px) |

En páginas estrechas la foto del plato va encima de los ingredientes.

---

## 5. Animaciones

- **Abrir/cerrar:** la tapa gira 180° sobre la espiral mientras el libro se
  centra (`FlipLeaf` + animación «acompañante»).
- **Pasar página:** la hoja gira en 3D con sombras en las dos caras, sombra
  proyectada sobre la página que se descubre y la que se tapa.
- **Detalles:** animalitos que respiran o se balancean, pegatinas que saludan
  al pasar el ratón, esquinas que se doblan, marcapáginas que cae.
- **Accesibilidad:** con «reducir movimiento» activado en el sistema, las
  animaciones son instantáneas. Si el navegador deja de pintar (pestaña
  oculta), las animaciones se completan solas.

---

## 6. Persistencia

Base de datos IndexedDB `my-little-recipe-book` (versión 1):

| Almacén | Clave | Contenido |
|---|---|---|
| `recipes` | `id` | Recetas (índices por sección y fecha) |
| `photos` | `id` | Fotos (`Blob` JPEG reducido a 1600 px, ancho y alto) |
| `settings` | nombre | Marcapáginas, fecha de inicio del recetario |

Para cambiar el esquema: subir `DB_VERSION` en `data/indexeddb/db.ts` y añadir
un bloque `if (oldVersion < N)` en `upgrade` (nunca borrar los anteriores).

Tras guardar la primera receta se pide al navegador almacenamiento
persistente (`navigator.storage.persist()`), para que no borre los datos si
le falta espacio.

> Importante: los datos viven **en el navegador de cada dispositivo**. El
> libro del ordenador y el del móvil son independientes hasta que exista un
> backend (fase de base de datos y cuentas).

---

## 7. Cómo crecer (fases siguientes)

### Fase 2 · Experiencia cozy (hecha)
- **Base de datos v2**: almacenes `categories` (secciones propias), `cooks`
  (historial de recetas cocinadas) y `achievements` (insignias). Las recetas
  ganan `favorite`, `toTry`, `cookedCount` y `lastCookedAt`, rellenados al leer.
- **Estado**: `PreferencesProvider` (ajustes), `CategoriesProvider` (secciones
  fijas + propias, con su arte), `AchievementsProvider` (evalúa
  `domain/achievements.ts`, guarda, pega pegatinas en la portada y celebra).
- **Maqueta**: el caché de medidas usa `layoutSignature` (cambia al marcar
  favorita o cocinada); bloque `sticker` al pie; páginas `album` al final.
- **Búsqueda**: `domain/search.ts` (puro, con pruebas) + `components/search/`.
- **Música**: `services/music/ambientMusic.ts` (Web Audio, generativa) y
  `components/music/`. Para usar una pista propia con licencia bastaría con un
  reproductor `HTMLAudioElement` con la misma interfaz `start/stop/setVolume`.
### Fase 3 · Asistente (hecha)
- **Lógica pura con pruebas** (`domain/`): `spanishNumbers.ts` (números
  dichos), `dictation.ts` (frases → `RecipeDraft`), `voiceCommands.ts`
  (órdenes, duraciones y temporizador sugerido por paso) y `kitchenHelp.ts`
  (respuestas de la app y de cocina; reconoce cuándo no sabe).
- **Servicios del navegador** (`services/`): `speech/recognition.ts` (Web
  Speech API en es-ES, modo continuo), `speech/synthesis.ts` (voz española)
  y `alarm.ts` (campanita con Web Audio).
- **Estado**: `AssistantProvider` (ánimo, bocadillo, voz y temporizadores
  guardados en ajustes).
- **Interfaz**: `components/assistant/` (Tom y su panel),
  `components/cooking/` (modo cocina con Wake Lock) y `components/dictation/`.
- Para un asistente con IA en el futuro, `answerQuestion` es el único punto a
  sustituir por una llamada al backend.
### Fase 4 · Importación con IA (hecha)

```
navegador                                   server/ (127.0.0.1:8787)          IA
─────────                                   ────────────────────────          ──
enlace ─────────── POST /link ────────────▶ yt-dlp (si está) / oEmbed TikTok
vídeo ─┬─ fotogramas (canvas) ──────────┐
       └─ audio 16 kHz (Web Audio) ─ POST /transcribe ─▶ Whisper (Python)
texto ──────────────────────────────────┴─ POST /analyze ─▶ visión: describe fotogramas ─▶ Ollama
                                                            texto: JSON con esquema   ─▶  u otra API
                                                            verify.ts: rebaja lo no dicho
◀── receta + avisos ── importDraft.ts → formulario con «Por confirmar»
```

- **El vídeo no sale del ordenador**: los fotogramas y el audio se sacan en el
  navegador (sin ffmpeg); el servidor solo recibe audio en PCM y fotogramas
  pequeños.
- **Proveedores intercambiables** (`server/providers/`): interfaz `AIProvider`
  con `health`, `chatJSON` y `describeImage`. Hoy: `ollama` (modelos locales,
  por defecto `qwen3:8b` + `gemma3:4b`) y `openai-compatible` (OpenAI, Groq,
  OpenRouter, LM Studio…). Se elige con `AI_PROVIDER` en `.env`; la clave
  `AI_API_KEY` solo la lee el servidor. Añadir otro es un archivo más.
- **No inventar**, en tres capas: (1) instrucciones y esquema JSON que obligan
  a `null`/`certain: false` cuando algo no se dice; (2) `verify.ts` comprueba
  que cada ingrediente y cada cantidad aparezcan de verdad en el audio, el
  texto o lo visto (si no, la cantidad se borra y se avisa) y recupera solo
  cantidades dichas literalmente («dos huevos»); (3) `importDraft.ts` marca en
  el borrador como `pending` lo dudoso, y `validateDraft` no deja guardar
  hasta confirmarlo o corregirlo.
- **Sin enlace utilizable** (privado, sin yt-dlp, Instagram): la ventana
  ofrece subir el vídeo o pegar el texto.
- Las fotos se eligen entre 12 fotogramas: una del plato terminado o una por
  paso (propuestas por la IA; si no elige, el último fotograma).

### Base de datos y cuentas
- Implementar `data/api/repositories.ts` (mismas interfaces de
  `data/types.ts`) y registrarlo en `data/index.ts`; activar con
  `VITE_DATA_SOURCE=api`. Las fotos irían a un almacenamiento de archivos del
  servidor.

---

## 8. Calidad

- `npm run typecheck` — TypeScript estricto.
- `npm run lint` — ESLint (incluidas las reglas de hooks de React).
- `npm test` — pruebas unitarias (Vitest) de cantidades, ingredientes,
  borradores, paginación, montaje del libro, repositorio IndexedDB, voz,
  conversión de lo importado y comprobaciones contra la invención
  (`server/verify.test.ts`).
