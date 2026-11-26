#!/usr/bin/env python3
"""
Builds the two map assets from a flat map image, so the 3D diorama always matches the illustration:

  public/assets/illustrations/tervete-map.webp         ground texture (2048 px wide)
  public/assets/illustrations/tervete-map-relief.png   R = height, G = where trees may grow, B = water

Heights come from the map's own colours (water scooped out, the park territory raised, the outer forest
low). The colour rules below fit the park's official map poster; a differently coloured final map needs
its thresholds adjusted (water hue, park-territory hue, banner/legend rectangles).

Usage:  python3 scripts/make-relief.py path/to/map.png
Needs:  pip install pillow numpy
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "illustrations"
# Rectangles (fractions of the sheet) where no trees may grow: title banner and legends.
NO_TREES = [(0, 0, 0.54, 0.34), (0, 0.62, 0.29, 1.0), (0.80, 0.64, 1.0, 1.0)]


def main(path: str) -> None:
    src = Image.open(path).convert("RGB")
    w, h = src.size
    OUT.mkdir(parents=True, exist_ok=True)

    tex = src.resize((2048, round(2048 * h / w)), Image.LANCZOS)
    tex.save(OUT / "tervete-map.webp", quality=82, method=6)

    rw, rh = 768, round(768 * h / w)
    small = src.resize((rw, rh), Image.LANCZOS)
    a = np.asarray(small).astype(np.float32) / 255.0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx, mn = a.max(-1), a.min(-1)
    d = mx - mn + 1e-6
    s, v = d / (mx + 1e-6), mx
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60.0

    # Water: opening removes thin rivers and icons, keeping the lake and ponds.
    water_raw = (hue > 185) & (hue < 235) & (s > 0.12)
    wm = Image.fromarray((water_raw * 255).astype(np.uint8))
    for f in (ImageFilter.MaxFilter(5), ImageFilter.MaxFilter(5), ImageFilter.MinFilter(5), ImageFilter.MinFilter(5), ImageFilter.MinFilter(9), ImageFilter.MaxFilter(9)):
        wm = wm.filter(f)
    water = np.asarray(wm) > 127

    territory = (hue >= 58) & (hue <= 88) & (s > 0.26) & (v > 0.5) & (v < 0.92)
    forest = (hue > 88) & (hue <= 135) & (s > 0.12) & (v > 0.3)
    dark = v < 0.38
    cream = (hue >= 45) & (hue <= 60) & (v > 0.9)

    height = np.full(mx.shape, 0.12, np.float32)
    height = np.where(forest, 0.10, height)
    height = np.where(territory, 0.26, height)
    height = np.where(dark, 0.10, height)
    height = np.where(cream, 0.04, height)
    height = np.where(water, -0.07, height)

    hi = Image.fromarray((np.clip((height + 0.1) / 0.5, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))
    ha = np.asarray(hi).astype(np.float32) / 255.0 * 0.5 - 0.1
    lum = np.asarray(small.convert("L").filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255.0
    ha += (lum - 0.7) * 0.05 * forest
    ha = np.where(water, np.minimum(ha, -0.05), ha)

    mask = forest & ~dark & ~cream & ~water
    yy, xx = np.mgrid[0:rh, 0:rw]
    u, vv = xx / rw, yy / rh
    for x0, y0, x1, y1 in NO_TREES:
        mask &= ~((u >= x0) & (u <= x1) & (vv >= y0) & (vv <= y1))
    m = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.GaussianBlur(1.0))

    out = np.zeros((rh, rw, 3), np.uint8)
    out[..., 0] = np.clip((ha + 0.1) / 0.5 * 255, 0, 255).astype(np.uint8)
    out[..., 1] = np.asarray(m)
    out[..., 2] = (water * 255).astype(np.uint8)
    Image.fromarray(out).save(OUT / "tervete-map-relief.png", optimize=True)
    print(f"wrote {OUT / 'tervete-map.webp'} and {OUT / 'tervete-map-relief.png'}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
