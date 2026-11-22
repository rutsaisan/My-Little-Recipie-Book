"""Genera los iconos de la app instalable (PWA) a partir del gorro de cocinero.

Uso: python tools/make_pwa_icons.py

Crea en `public/`:
  pwa-192.png, pwa-512.png      iconos normales (con marco cosido)
  pwa-maskable-512.png          icono «adaptable» de Android: el dibujo cabe
                                en la zona segura (círculo del 80 %)
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets-src" / "characters" / "gorro-chef.png"
OUT = ROOT / "public"

CARAMELO = (142, 96, 62, 255)  # #8E603E
BEIGE_ROSADO = (187, 156, 134, 255)  # #BB9C86


def hat(size: int) -> Image.Image:
    img = Image.open(SOURCE).convert("RGBA")
    img = img.crop(img.getbbox())
    img.thumbnail((size, size), Image.LANCZOS)
    return img


def icon(size: int, content: float, frame: bool) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), CARAMELO)
    if frame:
        draw = ImageDraw.Draw(canvas)
        inset = round(size * 0.045)
        width = max(1, round(size / 128))
        draw.rectangle([inset, inset, size - inset - 1, size - inset - 1], outline=BEIGE_ROSADO, width=width)
    art = hat(round(size * content))
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2 + round(size * 0.02)))
    return canvas


def main() -> None:
    icon(192, 0.72, True).save(OUT / "pwa-192.png", optimize=True)
    icon(512, 0.72, True).save(OUT / "pwa-512.png", optimize=True)
    # Android recorta el icono adaptable en círculo o «squircle»: sin marco y más pequeño.
    icon(512, 0.56, False).save(OUT / "pwa-maskable-512.png", optimize=True)
    print("Iconos creados en", OUT)


if __name__ == "__main__":
    main()
