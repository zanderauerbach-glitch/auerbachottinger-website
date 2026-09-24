#!/usr/bin/env python3
"""
extract_ink.py — pull Zander's pen marks off a flattened tablet export.

Zander draws over a project photo on the Windows tablet and exports a single
flat image with the ink burned in. That flat image is no use to the website on
its own: to fade the notes in and out we need the ink by itself, on a
transparent background, exactly registered to the original photograph.

This works it out by comparison. Wherever the exported file differs from the
original photograph, that difference is ink. How far it differs gives the
opacity; solving back through the blend gives the pen's true colour.

    python3 tools/extract_ink.py \
        images/projects/pond-house-06.jpg \
        ~/Downloads/pond-house-06-marked.png \
        images/annotations/pond-house-06-ink.png

Add --proof to write a contact sheet alongside the output so you can check the
extraction before it goes near the site.

The only thing Zander has to get right is not cropping or rotating the photo
before he draws on it. Scaling is fine and is corrected automatically.
"""
import argparse
import os
import sys

try:
    import numpy as np
    from PIL import Image, ImageFilter
except ImportError:
    sys.exit('Needs Pillow and numpy:  pip install pillow numpy')


def load_pair(clean_path, marked_path):
    clean = Image.open(clean_path).convert('RGB')
    marked = Image.open(marked_path).convert('RGB')

    if marked.size != clean.size:
        ar_c = clean.size[0] / clean.size[1]
        ar_m = marked.size[0] / marked.size[1]
        if abs(ar_c - ar_m) > 0.01:
            print('  ! aspect ratio differs (%s vs %s). The export was probably '
                  'cropped, so the ink will not line up. Re-export without '
                  'cropping.' % (clean.size, marked.size))
        print('  resizing export %s -> %s' % (marked.size, clean.size))
        marked = marked.resize(clean.size, Image.LANCZOS)

    return clean, marked


def extract(clean, marked, lo=16.0, hi=70.0, despeckle=True, min_alpha=0.12):
    """Return an RGBA array of ink only.

    lo  difference below this is treated as compression noise, not ink
    hi  difference at or above this is treated as a fully laid-down stroke
    """
    c = np.asarray(clean).astype(np.float32)
    m = np.asarray(marked).astype(np.float32)

    # How far each pixel moved. Max across channels catches a coloured pen on a
    # similarly bright background, which a plain luminance difference misses.
    diff = np.abs(m - c).max(axis=2)

    alpha = np.clip((diff - lo) / max(hi - lo, 1.0), 0.0, 1.0)

    if despeckle:
        # A median pass removes isolated JPEG artefacts without eating the
        # thin end of a stroke.
        a_img = Image.fromarray((alpha * 255).astype(np.uint8), 'L')
        a_img = a_img.filter(ImageFilter.MedianFilter(3))
        alpha = np.asarray(a_img).astype(np.float32) / 255.0

    # Solve the blend backwards. The export is  m = a*ink + (1-a)*c,
    # so the pen's own colour is  ink = (m - (1-a)*c) / a.
    a3 = alpha[..., None]
    safe = np.maximum(a3, min_alpha)
    ink = (m - (1.0 - a3) * c) / safe
    ink = np.clip(ink, 0, 255)

    # Where there is almost no ink the division above is meaningless. Filling
    # those pixels with the average pen colour does two jobs: a flat field
    # compresses to almost nothing, and it stops a pale fringe appearing around
    # the strokes when the browser scales the overlay down.
    strong = alpha > 0.5
    fill = ink[strong].mean(axis=0) if strong.any() else np.array([60.0, 60.0, 60.0])
    ink = np.where(a3 < min_alpha, fill, ink)

    out = np.dstack([ink, alpha * 255.0]).astype(np.uint8)
    return out, alpha


def trim_to_content(rgba, pad=8):
    """Crop to the drawn area and report where it sat, so the overlay file
    stays small. Returns (image, box) with box in fractions of the original."""
    alpha = rgba[..., 3]
    ys, xs = np.nonzero(alpha > 8)
    if len(xs) == 0:
        return None, None
    h, w = alpha.shape
    x0, x1 = max(int(xs.min()) - pad, 0), min(int(xs.max()) + pad + 1, w)
    y0, y1 = max(int(ys.min()) - pad, 0), min(int(ys.max()) + pad + 1, h)
    return rgba[y0:y1, x0:x1], (x0 / w, y0 / h, (x1 - x0) / w, (y1 - y0) / h)


def checkerboard(size, step=24):
    w, h = size
    yy, xx = np.mgrid[0:h, 0:w]
    tile = (((xx // step) + (yy // step)) % 2).astype(np.uint8)
    base = np.where(tile[..., None] == 0, 235, 205).astype(np.uint8)
    return Image.fromarray(np.repeat(base, 3, axis=2), 'RGB')


def write_proof(path, clean, marked, rgba):
    ink = Image.fromarray(rgba, 'RGBA')
    over_check = checkerboard(clean.size)
    over_check.paste(ink, (0, 0), ink)

    recomposed = clean.copy()
    recomposed.paste(ink, (0, 0), ink)

    panels = [('original', clean), ('tablet export', marked),
              ('extracted ink', over_check), ('recomposed', recomposed)]
    tw = 640
    th = int(tw * clean.size[1] / clean.size[0])
    sheet = Image.new('RGB', (tw * 2, th * 2), 'white')
    for i, (_, im) in enumerate(panels):
        sheet.paste(im.convert('RGB').resize((tw, th), Image.LANCZOS),
                    ((i % 2) * tw, (i // 2) * th))
    sheet.save(path, quality=88)
    print('  proof sheet -> %s' % path)
    print('  panels: original / tablet export / extracted ink / recomposed')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('clean', help='the original photograph already on the site')
    ap.add_argument('marked', help='the flattened export off the tablet')
    ap.add_argument('out', help='where to write the transparent ink PNG')
    ap.add_argument('--lo', type=float, default=16.0,
                    help='difference below this counts as noise (default 16)')
    ap.add_argument('--hi', type=float, default=70.0,
                    help='difference at or above this counts as solid ink (default 70)')
    ap.add_argument('--no-despeckle', action='store_true')
    ap.add_argument('--trim', action='store_true',
                    help='crop the PNG to the drawn area and print its placement')
    ap.add_argument('--proof', action='store_true',
                    help='also write a four-panel check sheet next to the output')
    args = ap.parse_args()

    print('reading %s' % args.clean)
    clean, marked = load_pair(args.clean, args.marked)

    rgba, alpha = extract(clean, marked, args.lo, args.hi,
                          despeckle=not args.no_despeckle)

    covered = float((alpha > 0.08).mean()) * 100.0
    print('  ink covers %.2f%% of the frame' % covered)
    if covered < 0.02:
        print('  ! almost nothing found. Either the export has no ink on it, or '
              'it is not the same photograph.')
    elif covered > 45:
        print('  ! most of the frame reads as ink. The export was probably '
              'resized, re-cropped or re-saved at a different exposure.')

    os.makedirs(os.path.dirname(args.out) or '.', exist_ok=True)

    if args.trim:
        trimmed, box = trim_to_content(rgba)
        if trimmed is None:
            sys.exit('  nothing to write: no ink found.')
        Image.fromarray(trimmed, 'RGBA').save(args.out)
        print('  place at  left %.2f%%  top %.2f%%  width %.2f%%  height %.2f%%'
              % (box[0] * 100, box[1] * 100, box[2] * 100, box[3] * 100))
    else:
        Image.fromarray(rgba, 'RGBA').save(args.out)

    print('  wrote %s (%.0f KB)' % (args.out, os.path.getsize(args.out) / 1024))

    if args.proof:
        write_proof(os.path.splitext(args.out)[0] + '-proof.jpg', clean, marked, rgba)


if __name__ == '__main__':
    main()
