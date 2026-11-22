#!/usr/bin/env python3
"""
Quita el fondo a las ilustraciones de referencia de «My Little Recipe Book»
y genera los recursos gráficos que usa la aplicación.

* Las imágenes originales NO se modifican: solo se leen de --src.
* Genera PNG maestros sin pérdida en  assets-src/characters/
  y WebP optimizados para la web en   src/assets/characters/
* Con --preview crea una hoja de contactos para revisar el recorte
  sobre papel claro y sobre marrón oscuro.

Uso:
    python tools/remove_backgrounds.py            (usa assets-src/originals)

Dependencias: pillow, numpy, opencv-python
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MASTER_DIR = ROOT / "assets-src" / "characters"
WEB_DIR = ROOT / "src" / "assets" / "characters"

# Lado máximo de las versiones web (las fuentes rondan los 700 px).
WEB_MAX_SIDE = 640


@dataclass
class Spec:
    """Cómo recortar una ilustración concreta."""

    match: str  # texto con el que empieza el nombre del archivo original
    out: str  # nombre del recurso generado (sin extensión)
    tol: int = 6  # tolerancia del relleno por inundación (0-255 por canal)
    halo_tol: float = 20.0  # distancia de color para limpiar el halo del fondo
    strip_white_border: bool = False  # quitar el borde blanco de pegatina
    min_island: int = 40  # islas más pequeñas (px) se descartan
    fixed: bool = False  # compara con el color de la semilla (fondos lisos con trazo suave)
    drop_boxes: list[tuple[int, int, int, int]] = field(default_factory=list)
    # rectángulos (x0, y0, x1, y1) con elementos ajenos a la ilustración
    # (p. ej. iconos de la interfaz de Instagram en una captura)


CHARACTERS: list[Spec] = [
    Spec("@_artizzy chef tom", "gato-calico-chef"),
    Spec("A cute little mouse eating pizza", "raton-pizza", tol=5),
    Spec("cute and kawaii illustration", "patito-naranja"),
    Spec("descarga (14)", "nutria-croissant"),
    Spec("descarga (15)", "perrito-hotdog"),
    Spec(
        "descarga (16)",
        "gato-siames-bizcocho",
        drop_boxes=[(630, 20, 735, 90), (640, 640, 735, 734), (330, 680, 400, 715)],
    ),
    Spec("descarga (17)", "gorro-chef"),
    Spec("descarga (18)", "raton-chef"),
    Spec("kawaii turtles", "tortuga-smore", tol=12, fixed=True),
    Spec("Pancaked stingray", "raya-tortita", strip_white_border=True),
    Spec("sticker aesthetic green", "serpiente-canela", strip_white_border=True),
]

# Hoja de pegatinas «Sea Pancake Menu»: se extrae cada pegatina por separado.
SHEET_MATCH = "b32f73e03c688b44c4455d74611f1fe4"
SHEET_BG = np.array([255, 207, 151], np.float32)  # naranja del fondo
SHEET_DOT = np.array([250, 172, 78], np.float32)  # lunares
# Nombre de cada pegatina y su centro aproximado (x, y) en la hoja original.
SHEET_STICKERS: list[tuple[str, tuple[int, int]]] = [
    ("vapor", (462, 122)),
    ("raya-sarten", (908, 278)),
    ("raya-plancha", (464, 266)),
    ("raya-mantequilla", (487, 493)),
    ("raya-mini-mantequilla", (1025, 491)),
    ("raya-pila-tortitas", (828, 703)),
    ("raya-platano", (395, 763)),
    ("raya-mini-chocolate", (743, 941)),
    ("raya-chocolate-frutos", (965, 1039)),
    ("raya-nata-fresa", (492, 1052)),
    ("raya-cafetera", (449, 1365)),
    ("raya-corazon", (898, 1334)),
]


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------


def find_source(src_dir: Path, prefix: str) -> Path:
    for path in sorted(src_dir.iterdir()):
        if path.name.startswith(prefix):
            return path
    raise FileNotFoundError(f"No encuentro una imagen que empiece por «{prefix}» en {src_dir}")


def load_rgb(path: Path) -> np.ndarray:
    # PIL admite rutas con emojis en Windows (cv2.imread no).
    with Image.open(path) as im:
        return np.array(im.convert("RGB"))


def border_seeds(h: int, w: int, step: int = 3) -> list[tuple[int, int]]:
    seeds = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)]
    seeds += [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    return seeds


def local_background(img: np.ndarray, bg: np.ndarray, sigma: float = 4.0) -> np.ndarray:
    """Color de fondo estimado en cada píxel (convolución normalizada)."""
    m = bg.astype(np.float32)
    num = cv2.GaussianBlur(img * m[..., None], (0, 0), sigma)
    den = cv2.GaussianBlur(m, (0, 0), sigma)[..., None]
    return num / np.maximum(den, 1e-4)


def flood_from_border(work: np.ndarray, tol: int, fixed: bool = False) -> np.ndarray:
    """Relleno por inundación desde todo el borde.

    Por defecto usa rango flotante (sigue degradados suaves); con `fixed`
    compara cada píxel con el color de la semilla (fondos lisos).
    """
    h, w = work.shape[:2]
    border = np.concatenate([work[0], work[-1], work[:, 0], work[:, -1]]).astype(np.float32)
    ref = np.median(border, axis=0)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
    if fixed:
        flags |= cv2.FLOODFILL_FIXED_RANGE
    diff = (tol, tol, tol)
    for x, y in border_seeds(h, w):
        if mask[y + 1, x + 1] != 0:
            continue
        if np.linalg.norm(work[y, x].astype(np.float32) - ref) > 70:
            continue  # el borde toca la ilustración: no sembrar ahí
        cv2.floodFill(work, mask, (x, y), 0, diff, diff, flags)
    return mask[1:-1, 1:-1] == 255


def light_neutral(img: np.ndarray, min_level: int = 200, max_sat: int = 28) -> np.ndarray:
    mx = img.max(axis=2).astype(np.int16)
    mn = img.min(axis=2).astype(np.int16)
    return (mn >= min_level) & ((mx - mn) <= max_sat)


def grow_connected(seed: np.ndarray, allowed: np.ndarray) -> np.ndarray:
    """Píxeles de `allowed` conectados (8-vecindad) con `seed`."""
    region = (seed | allowed).astype(np.uint8)
    n, labels = cv2.connectedComponents(region, connectivity=8)
    hit = np.unique(labels[seed])
    hit = hit[hit != 0]
    return np.isin(labels, hit) & (allowed | seed)


def matte(img_u8: np.ndarray, bg: np.ndarray, halo_tol: float) -> tuple[np.ndarray, np.ndarray]:
    """Limpia el halo, calcula un alfa suave en los bordes y descontamina el color."""
    img = img_u8.astype(np.float32)
    bg = bg.copy()
    kernel = np.ones((3, 3), np.uint8)
    B = local_background(img, bg)
    for _ in range(4):
        band = cv2.dilate(bg.astype(np.uint8), kernel).astype(bool) & ~bg
        dist = np.linalg.norm(img - B, axis=2)
        add = band & (dist < halo_tol)
        if not add.any():
            break
        bg |= add
        B = local_background(img, bg)

    subject = ~bg
    inside = cv2.distanceTransform(subject.astype(np.uint8), cv2.DIST_L2, 3)
    dist = np.linalg.norm(img - B, axis=2)
    alpha = np.where(subject, 1.0, 0.0).astype(np.float32)
    edge = subject & (inside <= 1.5)
    soft = np.clip((dist - 6.0) / 60.0, 0.0, 1.0)
    alpha[edge] = soft[edge]

    # Recupera el color real del trazo en los píxeles semitransparentes.
    a = np.clip(alpha, 0.08, 1.0)[..., None]
    fg = np.clip(B + (img - B) / a, 0, 255)
    rgb = np.where(edge[..., None], fg, img)
    return rgb, alpha


def drop_islands(alpha: np.ndarray, min_island: int, drop_boxes) -> np.ndarray:
    solid = (alpha > 0.5).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    if n <= 1:
        return alpha
    keep = np.zeros(n, bool)
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        cx, cy = x + w / 2, y + h / 2
        if any(x0 <= cx <= x1 and y0 <= cy <= y1 for x0, y0, x1, y1 in drop_boxes):
            continue
        keep[i] = area >= min_island
    kept = keep[labels]
    near = cv2.dilate(kept.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
    return np.where(near, alpha, 0.0).astype(np.float32)


def to_rgba(rgb: np.ndarray, alpha: np.ndarray, pad: int = 6) -> Image.Image:
    a8 = np.clip(alpha * 255 + 0.5, 0, 255).astype(np.uint8)
    rgba = np.dstack([np.clip(rgb + 0.5, 0, 255).astype(np.uint8), a8])
    ys, xs = np.nonzero(a8 > 4)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, a8.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, a8.shape[1])
    rgba = rgba[y0:y1, x0:x1]
    # Los píxeles totalmente transparentes no necesitan color (mejor compresión).
    rgba[rgba[..., 3] == 0, :3] = 0
    return Image.fromarray(rgba, "RGBA")


# ---------------------------------------------------------------------------
# Recorte de ilustraciones sueltas
# ---------------------------------------------------------------------------


def cut_character(img: np.ndarray, spec: Spec) -> Image.Image:
    work = cv2.medianBlur(img, 3)
    bg = flood_from_border(work, spec.tol, spec.fixed)
    if spec.strip_white_border:
        # El borde blanco de pegatina y su sombra gris se unen al fondo.
        bg = grow_connected(bg, light_neutral(work))
    rgb, alpha = matte(img, bg, spec.halo_tol)
    alpha = drop_islands(alpha, spec.min_island, spec.drop_boxes)
    return to_rgba(rgb, alpha)


# ---------------------------------------------------------------------------
# Hoja de pegatinas
# ---------------------------------------------------------------------------


def distance_to_segment(colors: np.ndarray, a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Distancia de cada color al segmento a-b (mezclas del fondo y los lunares)."""
    ab = b - a
    t = np.clip(((colors - a) @ ab) / float(ab @ ab), 0.0, 1.0)
    closest = a + t[..., None] * ab
    return np.linalg.norm(colors - closest, axis=-1)


def cut_sheet(img: np.ndarray) -> list[tuple[tuple[int, int], Image.Image]]:
    """Devuelve [(centro_xy, imagen)] de cada pegatina de la hoja."""
    work = cv2.medianBlur(img, 3)
    luma = cv2.cvtColor(work, cv2.COLOR_RGB2YCrCb)[..., 0]
    h, w = luma.shape

    # 1) Blanco exterior (fuera de la hoja), unido al borde de la imagen.
    white = light_neutral(work, min_level=225, max_sat=30)
    edge_seed = np.zeros_like(white)
    edge_seed[0, :] = edge_seed[-1, :] = edge_seed[:, 0] = edge_seed[:, -1] = True
    outer = grow_connected(edge_seed & white, white)

    # 2) Fondo naranja con lunares, detectado por su color. El trazo oscuro de
    #    cada dibujo hace de barrera aunque el borde blanco tenga huecos.
    orange_like = distance_to_segment(work.astype(np.float32), SHEET_BG, SHEET_DOT) < 26
    n, labels, stats, _ = cv2.connectedComponentsWithStats(orange_like.astype(np.uint8), connectivity=4)
    orange = labels == (1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA])))

    # 3) Cada pegatina (borde blanco + dibujo) queda aislada por el naranja.
    stickers = (~orange & ~outer).astype(np.uint8)
    stickers = cv2.morphologyEx(stickers, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(stickers, connectivity=8)

    results = []
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        if area < 2500 or x + bw / 2 < 190:  # restos o el título vertical
            continue
        x0, y0 = max(x - 8, 0), max(y - 8, 0)
        x1, y1 = min(x + bw + 8, w), min(y + bh + 8, h)
        crop = img[y0:y1, x0:x1]
        comp = labels[y0:y1, x0:x1] == i
        # Fondo = lo que no es la pegatina + su borde blanco (por luminancia:
        # el submuestreo de color del JPEG tiñe de naranja los bordes finos).
        outside = ~comp
        ring = grow_connected(outside, (luma[y0:y1, x0:x1] >= 226) & comp)
        rgb, alpha = matte(crop, ring | outside, 20.0)
        alpha = drop_islands(alpha, 40, [])
        if (alpha > 0.5).sum() < 1500:
            continue
        results.append(((int(x + bw / 2), int(y + bh / 2)), to_rgba(rgb, alpha)))
    return results


def name_for(center: tuple[int, int]) -> str | None:
    """Nombre de la pegatina cuyo centro esperado está más cerca."""
    best, best_d = None, 1e9
    for name, (cx, cy) in SHEET_STICKERS:
        d = (cx - center[0]) ** 2 + (cy - center[1]) ** 2
        if d < best_d:
            best, best_d = name, d
    return best if best_d < 90**2 else None


# ---------------------------------------------------------------------------
# Salida
# ---------------------------------------------------------------------------


def save(img: Image.Image, name: str) -> None:
    MASTER_DIR.mkdir(parents=True, exist_ok=True)
    WEB_DIR.mkdir(parents=True, exist_ok=True)
    img.save(MASTER_DIR / f"{name}.png", optimize=True)
    web = img.copy()
    if max(web.size) > WEB_MAX_SIDE:
        web.thumbnail((WEB_MAX_SIDE, WEB_MAX_SIDE), Image.LANCZOS)
    web.save(WEB_DIR / f"{name}.webp", "WEBP", quality=90, method=6)


def contact_sheet(items: list[tuple[str, Image.Image]], path: Path) -> None:
    cell = 260
    cols = 4
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell * 2, rows * cell), (255, 255, 255))
    for idx, (_, im) in enumerate(items):
        r, c = divmod(idx, cols)
        thumb = im.copy()
        thumb.thumbnail((cell - 16, cell - 16), Image.LANCZOS)
        for k, color in enumerate([(244, 234, 224), (78, 47, 33)]):
            tile = Image.new("RGB", (cell, cell), color)
            ox = (cell - thumb.width) // 2
            oy = (cell - thumb.height) // 2
            tile.paste(thumb, (ox, oy), thumb)
            sheet.paste(tile, (c * cell * 2 + k * cell, r * cell))
    sheet.save(path)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--src", type=Path, default=ROOT / "assets-src" / "originals", help="Carpeta con las ilustraciones originales (por defecto, assets-src/originals)")
    parser.add_argument("--preview", type=Path, help="Ruta de una hoja de contactos PNG para revisar")
    parser.add_argument("--only", help="Procesa solo el recurso con este nombre")
    args = parser.parse_args()

    done: list[tuple[str, Image.Image]] = []
    for spec in CHARACTERS:
        if args.only and args.only != spec.out:
            continue
        src = find_source(args.src, spec.match)
        out = cut_character(load_rgb(src), spec)
        save(out, spec.out)
        done.append((spec.out, out))
        print(f"  {spec.out:28} {out.size[0]}x{out.size[1]}")

    sheet_names = {name for name, _ in SHEET_STICKERS}
    if not args.only or args.only in sheet_names:
        sheet = cut_sheet(load_rgb(find_source(args.src, SHEET_MATCH)))
        for center, im in sheet:
            name = name_for(center)
            if name is None:
                print(f"  (pegatina sin nombre en {center}, se ignora)")
                continue
            if args.only and args.only != name:
                continue
            save(im, name)
            done.append((name, im))
            print(f"  {name:28} {im.size[0]}x{im.size[1]}")

    if args.preview:
        contact_sheet(done, args.preview)
        print(f"Hoja de contactos: {args.preview}")


if __name__ == "__main__":
    main()
