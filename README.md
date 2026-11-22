# My Little Recipe Book

Recetario digital personal con forma de cuaderno de espiral: tapa de tela
vichy, páginas de papel, pestañas separadoras, marcapáginas y animalitos
cocineros. Las recetas se escriben en un bloc de notas y aparecen maquetadas
como en un libro de cocina de verdad, con su paso de página en 3D.

## Puesta en marcha

Requisitos: **Node.js 20.19 o superior** (o 22.12+) y npm.

```bash
npm install
npm run dev
```

Abre <http://localhost:5173>.

`npm run dev` arranca dos cosas a la vez: la app (Vite) y un pequeño
servidor local para importar recetas de vídeos con IA (`server/`). El libro
funciona aunque la parte de IA no esté preparada; ver
[Importar recetas de vídeos](#importar-recetas-de-vídeos-fase-4).

Para probarlo en el móvil dentro de la misma red Wi‑Fi:

```bash
npm run dev -- --host
```

y abre en el móvil la dirección «Network» que muestra la consola.

| Comando | Para qué |
|---|---|
| `npm run dev` | App + servidor de importación, con recarga automática |
| `npm run dev:app` | Solo la app (sin importación) |
| `npm run server` | Solo el servidor de importación |
| `npm run build` | Versión de producción en `dist/` |
| `npm run preview` | Sirve la versión de producción para probarla |
| `npm run build:pages` / `npm run preview:pages` | Igual que lo que se publica en GitHub Pages |
| `npm test` | Pruebas unitarias |
| `npm run lint` | Revisión del código |
| `npm run typecheck` | Comprobación de tipos |

## Qué incluye (fase 1)

- Portada de cuaderno con animación de apertura y cierre.
- Libro abierto a dos páginas en ordenador y una página en móvil, con paso de
  página animado (botones, esquinas, flechas del teclado o deslizando el dedo).
- Portadilla, índice interactivo, separadores por sección con pestañas que
  cambian de lado al pasar las hojas, numeración y marcapáginas.
- Formulario de receta en tres apartados: **fotografías** (una foto final o
  una por paso), **ingredientes** (cantidad, unidad y nombre) y
  **elaboración** (pasos reordenables), más un desplegable de información
  adicional (sección, tiempos, comensales, dificultad y notas).
- Páginas de receta maquetadas automáticamente: título, ingredientes con la
  foto pegada al lado, pasos numerados (con su foto debajo en el modo
  «proceso») y notas; nada se corta entre páginas.
- Recalcular cantidades al cambiar el número de comensales.
- Editar y borrar recetas (con confirmación); las fotos se borran con ellas.
- Todo se guarda en el navegador (IndexedDB) y sigue ahí al volver a abrir.

## Qué incluye la fase 2 (experiencia cozy)

- **Música ambiental** generada en el propio navegador (acordes suaves, cajita de
  música y crepitar de disco): es música original de la app, sin licencias de
  terceros. Botón arriba a la derecha; recuerda si la dejaste encendida y empieza
  al primer toque, nunca sola.
- **Favoritas** (corazón en la página), **«¡La he cocinado!»** (olla, con
  «Deshacer») y **«Por probar»** (en el formulario).
- **Buscador**: por nombre, ingrediente o notas, sin importar las tildes, con
  filtros de favoritas, recientes, por probar, cocinadas y sección.
- **Secciones propias** con su animalito, color de pestaña y frase (desde el
  formulario o desde *Personalizar*). Al borrar una, sus recetas pasan a «Otras».
- **Insignias**: 21 animalitos coleccionables (primera receta, cinco y diez
  recetas completadas, insignia de pastelería y una por sección…), celebradas
  con una tarjeta que no interrumpe. Se consultan en **Mi álbum de insignias**,
  páginas al final del libro.
- **Pegatinas y decoraciones**: cada insignia regala su pegatina, que se pega
  sola en la portada y en la guarda; algunas desbloquean manteles nuevos.
- **Personalizar el libro** (menú ⋯): tu nombre, la frase de la portada,
  pegatinas, mantel, color del marcapáginas, volumen y celebraciones.
- Animalitos decorativos al pie de las recetas cuando queda sitio.

## Qué incluye la fase 3 (asistente)

- **Tom, el ayudante de cocina** (el gatito cocinero), en la esquina de la
  mesa. Tiene estados visibles: esperando, hablando, escuchando, pensando y
  celebrando. Al pulsarlo abre su panel.
- **Preguntas**: cómo usar la app y dudas habituales de cocina
  (sustituciones, equivalencias de tazas y cucharadas, trucos). Funciona sin
  conexión ni IA: si no sabe algo, lo dice en vez de inventarlo. Se puede
  preguntar escribiendo o con la voz.
- **Lectura en voz alta** de la receta que estés viendo (se puede apagar).
- **Temporizadores** con aviso sonoro y visual; siguen contando aunque
  recargues la página.
- **Cocinar paso a paso** (botón ▶ en la receta): un paso en grande cada vez,
  lista de ingredientes para ir marcando, temporizador sugerido a partir del
  texto del paso («hornea 20 minutos»), la pantalla no se apaga y, en **manos
  libres**, órdenes de voz: «siguiente», «anterior», «repite», «lee los
  ingredientes», «pon un temporizador de diez minutos», «¿cuánto queda?»,
  «he terminado». Al acabar, «¡La he cocinado!» suma para las insignias.
- **Dictar una receta**: «Nueva receta» → «Dictándola con la voz». Se dicta el
  nombre, los ingredientes («doscientos gramos de harina…») y los pasos; todo
  se coloca en el formulario para revisarlo antes de guardar.

El reconocimiento de voz usa el del navegador (Chrome, Edge o Safari), que
envía el audio a su servicio para pasarlo a texto; la app no guarda
grabaciones. Si el navegador no lo admite, todo lo demás funciona escribiendo.

## Importar recetas de vídeos (fase 4)

«Nueva receta» → **«De un vídeo»** (o en el panel de Tom, «Sacar una receta
de un vídeo»). Tres maneras de empezar:

- **Enlace** de TikTok o Instagram.
- **Vídeo** guardado en el ordenador o el móvil.
- **Texto**: la transcripción o la descripción de la publicación.

Se ve el progreso de cada paso: abrir el vídeo, sacar fotogramas, transcribir
el audio, reconocer ingredientes en las imágenes, detectar cantidades y pasos,
elegir fotos y preparar la vista previa. Después eliges la foto del plato (o
una por paso) entre los fotogramas y todo pasa al formulario de siempre.

**La IA no inventa.** Lo que no se dice o no se ve con claridad llega vacío y
marcado **«Por confirmar»**: el libro no deja guardar la receta hasta que lo
corriges o pulsas «Confirmar». Además, una comprobación final borra cualquier
cantidad que no aparezca en el audio, el texto o las imágenes.

### Qué hace falta en el ordenador

Por defecto todo funciona **en local y gratis**, sin enviar el vídeo fuera:

1. **[Ollama](https://ollama.com)** en marcha, con los modelos:
   ```bash
   ollama pull qwen3:8b
   ollama pull gemma3:4b
   ```
   (`qwen3:8b` ordena la receta; `gemma3:4b` mira los fotogramas.)
2. **Whisper** para escuchar el audio (Python 3):
   ```bash
   pip install openai-whisper
   ```
3. *(Opcional)* **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** para descargar
   vídeos desde enlaces. Sin él, los enlaces de TikTok dan solo el texto de la
   publicación, y la ventana propone subir el vídeo o pegar el texto.

La ventana de importación dice al abrirse qué está disponible y qué falta.

### Usar un servicio de IA externo

Copia `.env.example` como `.env` y cambia:

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.openai.com/v1   # o Groq, OpenRouter, LM Studio…
AI_API_KEY=tu-clave
AI_TEXT_MODEL=gpt-4o-mini
AI_VISION_MODEL=gpt-4o-mini
```

La clave solo la lee el servidor local (`server/`); nunca llega al navegador.
Detalles en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md#fase-4--importación-con-ia-hecha).

## Instalarla como app (PWA)

My Little Recipe Book es una **app instalable** que funciona **sin conexión**:
la primera visita guarda la app entera (código, fuentes e ilustraciones) y
las recetas ya viven en el propio dispositivo.

- **Móvil (Android/Chrome):** menú ⋮ → «Instalar aplicación».
- **iPhone/iPad (Safari):** botón Compartir → «Añadir a pantalla de inicio».
- **Ordenador (Chrome/Edge):** icono de instalar en la barra de direcciones.

Cuando se publica una versión nueva, la app se actualiza sola la próxima vez
que se abre con conexión. Los iconos se generan con
`python tools/make_pwa_icons.py`.

## Publicar en GitHub Pages

El repositorio incluye un flujo (`.github/workflows/deploy.yml`) que, en cada
subida a la rama `main`, revisa el código (lint, tipos y pruebas), compila y
publica la web en `https://<tu-usuario>.github.io/<repositorio>/`.

1. Crea un repositorio en GitHub (en el plan gratuito, Pages exige que sea
   **público**; ver la nota de las ilustraciones más abajo).
2. Súbelo:
   ```bash
   git remote add origin https://github.com/<tu-usuario>/<repositorio>.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Source: «GitHub Actions»**. Si el primer
   intento falló por no tenerlo activado, ve a **Actions** y pulsa
   «Re-run jobs».

La versión publicada es **solo la web**: el libro, Tom, el dictado, la
música y las insignias funcionan; **importar de vídeos no**, porque necesita
el servidor local con la IA (la ventana lo explica). Para probar en tu
ordenador exactamente lo que se publicará:

```bash
npm run build:pages
npm run preview:pages
```

y abre <http://localhost:4173/my-little-recipe-book/>.

> Si el repositorio se llama `<tu-usuario>.github.io`, la web va en la raíz:
> cambia en el flujo `BASE_PATH` por `/`.

## Dónde se guardan las recetas

En la base de datos **IndexedDB del navegador** que uses. Cada navegador y
cada dispositivo tiene su propio libro, y borrar los «datos del sitio» del
navegador borra también las recetas. Compartir el libro entre dispositivos
llegará con la fase de base de datos y cuentas.

## Ilustraciones

Las ilustraciones originales están en `assets-src/originals/`. Los animalitos se generan sin fondo a partir de ellas con:

```bash
pip install pillow numpy opencv-python
python tools/remove_backgrounds.py --preview revision.png
```

El script no modifica los originales: deja PNG sin pérdida en
`assets-src/characters/` y versiones WebP ligeras en `src/assets/characters/`.
Para añadir una ilustración nueva, añade una línea `Spec(...)` en el script y
regístrala en `src/assets/characters/index.ts`.

Las ilustraciones de referencia son obra de sus autores (algunas llevan su
firma). Para un uso personal no hay problema; si algún día publicas la app o
el repositorio, pide permiso a los artistas o sustitúyelas.

## Estructura

Resumen de carpetas (detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)):

- `src/domain/` — lógica pura: recetas, cantidades, unidades, validación.
- `src/data/` — persistencia (IndexedDB) detrás de interfaces de repositorio.
- `src/services/` — guardar/borrar con fotos, preparar imágenes.
- `src/layout/` — maquetador del libro (medir, paginar, montar páginas).
- `src/components/` — componentes visuales, cada uno con su CSS.
- `server/` — servidor local de importación con IA (proveedores, Whisper, enlaces).
- `src/styles/` — paleta, tipografía, texturas y animaciones globales.
- `src/assets/` — ilustraciones y texturas.
