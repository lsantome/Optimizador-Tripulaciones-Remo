#!/usr/bin/env python3
"""Regenera los iconos y las pantallas de arranque de la app Android a partir de icons/icon-maskable-512.png.
Uso (desde la raíz del repositorio):  python3 scripts/android-assets.py   (requiere Pillow)
Escribe en android/app/src/main/res: mipmap-*/ic_launcher*.png, drawable*/splash.png y el color de fondo del icono adaptativo.
Solo hace falta si cambias el icono; los archivos generados están versionados."""
import glob, os, re, sys
from PIL import Image, ImageDraw

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RES = os.path.join(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'android'), 'app', 'src', 'main', 'res')
FONDO = (14, 27, 36)  # #0E1B24, el mismo del manifest web
arte = Image.open(os.path.join(RAIZ, 'icons', 'icon-maskable-512.png')).convert('RGB')  # casco sobre fondo liso, dentro de la zona segura

def escalar(img, lado):
    return img.resize((lado, lado), Image.LANCZOS)

# Iconos (densidad: lado del icono clásico, lado de la capa del icono adaptativo = 108 dp)
for dens, (clasico, capa) in {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216), 'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}.items():
    d = os.path.join(RES, 'mipmap-' + dens)
    os.makedirs(d, exist_ok=True)
    # Clásico (Android < 8): cuadrado de esquinas redondeadas y su versión circular
    base = escalar(arte, clasico * 4)  # supermuestreo para suavizar el borde
    for nombre, forma in (('ic_launcher.png', 'rect'), ('ic_launcher_round.png', 'circulo')):
        mascara = Image.new('L', base.size, 0)
        dr = ImageDraw.Draw(mascara)
        if forma == 'rect': dr.rounded_rectangle([0, 0, base.width - 1, base.height - 1], radius=int(base.width * 0.18), fill=255)
        else: dr.ellipse([0, 0, base.width - 1, base.height - 1], fill=255)
        salida = Image.new('RGBA', base.size, (0, 0, 0, 0)); salida.paste(base, (0, 0), mascara)
        salida.resize((clasico, clasico), Image.LANCZOS).save(os.path.join(d, nombre))
    # Capa frontal del icono adaptativo: el arte al 83 % centrado (la zona visible es el 66,7 % central)
    fg = Image.new('RGB', (capa * 4, capa * 4), FONDO)
    lado = int(capa * 4 * 0.83)
    fg.paste(escalar(arte, lado), ((capa * 4 - lado) // 2,) * 2)
    fg.resize((capa, capa), Image.LANCZOS).save(os.path.join(d, 'ic_launcher_foreground.png'))

# Fondo del icono adaptativo
p = os.path.join(RES, 'values', 'ic_launcher_background.xml')
s = open(p, encoding='utf8').read()
open(p, 'w', encoding='utf8').write(re.sub(r'(<color name="ic_launcher_background">)[^<]*(</color>)', r'\g<1>#0E1B24\g<2>', s))
# La capa vectorial de plantilla ya no se usa (el adaptativo apunta a @mipmap/ic_launcher_foreground)
for f in glob.glob(os.path.join(RES, 'drawable-v24', 'ic_launcher_foreground.xml')): os.remove(f)

# Pantalla de arranque: fondo liso del color de la app con el casco centrado (sustituye al splash en blanco de la plantilla)
for f in glob.glob(os.path.join(RES, 'drawable*', 'splash.png')):
    w, h = Image.open(f).size
    img = Image.new('RGB', (w, h), FONDO)
    lado = int(min(w, h) * 0.38)
    img.paste(escalar(arte, lado), ((w - lado) // 2, (h - lado) // 2))
    img.save(f)
print('OK: iconos y splash regenerados en', os.path.normpath(RES))
