#!/usr/bin/env python3
"""
Generates SAMPLE marker-style annotation overlays so the toggle can be
previewed before Zander's real drawings arrive.

This is a prototype prop, not part of the production pipeline. The real
overlays come off Zander's tablet and are processed by extract_ink.py.
"""
import math
import random

# Marker colours: saturated but slightly muted, the way a whiteboard pen
# reads once it is photographed rather than straight out of the swatch book.
INK = {
    'blue':  '#2f62a8',
    'red':   '#c0392b',
    'green': '#4b7f52',
    'black': '#23282d',
}


def wobble(points, amount=3.0, seed=0):
    """Nudge each point off its ideal position so the line reads as hand drawn."""
    rnd = random.Random(seed)
    return [(x + rnd.uniform(-amount, amount), y + rnd.uniform(-amount, amount))
            for x, y in points]


def smooth_path(points, close=False):
    """Catmull-Rom through the points, emitted as cubic beziers."""
    if len(points) < 2:
        return ''
    pts = list(points)
    if close:
        pts = [points[-1]] + points + [points[0], points[1]]
    else:
        pts = [points[0]] + points + [points[-1]]
    d = 'M %.1f %.1f' % (pts[1][0], pts[1][1])
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6.0, p1[1] + (p2[1] - p0[1]) / 6.0)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6.0, p2[1] - (p3[1] - p1[1]) / 6.0)
        d += ' C %.1f %.1f, %.1f %.1f, %.1f %.1f' % (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    if close:
        d += ' Z'
    return d


def ellipse_points(cx, cy, rx, ry, n=40, rot=0.0, sweep=1.03):
    """Points round an ellipse, overshooting slightly so the loop crosses itself."""
    out = []
    for i in range(n + 1):
        t = (i / n) * (2 * math.pi * sweep) - math.pi / 2
        x, y = rx * math.cos(t), ry * math.sin(t)
        xr = x * math.cos(rot) - y * math.sin(rot)
        yr = x * math.sin(rot) + y * math.cos(rot)
        out.append((cx + xr, cy + yr))
    return out


def stroke(d, colour, width, seed, opacity=0.9):
    """A marker stroke: a soft wide pass for ink bleed, a crisp pass on top."""
    return (
        '    <path class="ink-stroke" pathLength="1" d="%s" fill="none" '
        'stroke="%s" stroke-width="%.1f" stroke-opacity="%.2f" '
        'stroke-linecap="round" stroke-linejoin="round"/>\n'
        '    <path class="ink-stroke" pathLength="1" d="%s" fill="none" '
        'stroke="%s" stroke-width="%.1f" stroke-opacity="%.2f" '
        'stroke-linecap="round" stroke-linejoin="round"/>\n'
        % (d, colour, width * 1.9, opacity * 0.30,
           d, colour, width, opacity)
    )


def arrow(x1, y1, x2, y2, colour, width, seed, bow=0.16):
    """A curved arrow with a two-stroke head, the way a pen actually draws one."""
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    dx, dy = x2 - x1, y2 - y1
    mx -= dy * bow
    my += dx * bow
    pts = wobble([(x1, y1), (mx, my), (x2, y2)], 4, seed)
    out = stroke(smooth_path(pts), colour, width, seed)

    ang = math.atan2(y2 - my, x2 - mx)
    head = max(26.0, width * 3.4)
    for side in (+1, -1):
        a = ang + math.pi + side * 0.42
        hx, hy = x2 + head * math.cos(a), y2 + head * math.sin(a)
        p = wobble([(x2, y2), (hx, hy)], 2, seed + side)
        out += stroke(smooth_path(p), colour, width, seed + side)
    return out


def bracket(x1, x2, y, colour, width, seed, depth=26, down=False):
    """A horizontal brace under (or over) a run of building."""
    s = -1 if down else 1
    pts = [(x1, y), (x1, y - depth * s), ((x1 + x2) / 2, y - depth * s * 1.5),
           (x2, y - depth * s), (x2, y)]
    return stroke(smooth_path(wobble(pts, 3, seed)), colour, width, seed)


def underline(x1, x2, y, colour, width, seed):
    pts = [(x1, y), ((x1 + x2) / 2, y + 4), (x2, y - 2)]
    return stroke(smooth_path(wobble(pts, 3, seed)), colour, width, seed)


def label(x, y, text, colour, size, rot=0, anchor='start'):
    """anchor='end' right-aligns, which is how you keep a note that sits on the
    right of the frame from running off the edge of the photograph."""
    esc = (text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))
    tf = ' transform="rotate(%s %s %s)"' % (rot, x, y) if rot else ''
    a = '' if anchor == 'start' else ' text-anchor="%s"' % anchor
    return ('    <text class="ink-label" x="%s" y="%s"%s%s fill="%s" '
            'font-size="%s">%s</text>\n' % (x, y, tf, a, colour, size, esc))


def svg(w, h, body, title):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
        'width="%d" height="%d" role="img" aria-label="%s">\n'
        '  <title>%s</title>\n'
        '  <style>\n'
        '    .ink-label {\n'
        '      font-family: "Caveat", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;\n'
        '      font-weight: 600;\n'
        '      paint-order: stroke;\n'
        '      stroke: rgba(255,255,255,0.55);\n'
        '      stroke-width: 6px;\n'
        '      stroke-linejoin: round;\n'
        '    }\n'
        '  </style>\n'
        '  <g class="ink">\n%s  </g>\n</svg>\n'
        % (w, h, w, h, title, title, body)
    )


# ---------------------------------------------------------------- pond-house-06
# Exterior, 2000 x 1335. Weathered cedar house under oaks.
W, H = 2000, 1335
b = ''
# planted roof
b += stroke(smooth_path(wobble(ellipse_points(1090, 715, 330, 62, rot=-0.03), 4, 1), close=True),
            INK['blue'], 9, 1)
b += arrow(1180, 560, 1120, 668, INK['blue'], 8, 11)
b += label(880, 535, 'planted roof — the mass', INK['blue'], 62)
b += label(880, 600, 'disappears from the marsh', INK['blue'], 62)
# cedar siding
b += arrow(250, 1120, 400, 940, INK['red'], 8, 21, bow=-0.18)
b += label(90, 1190, 'untreated cedar,', INK['red'], 58)
b += label(90, 1248, 'left to silver', INK['red'], 58)
# piers
b += bracket(1420, 1760, 1105, INK['green'], 8, 31, depth=30, down=True)
b += underline(1430, 1745, 1225, INK['green'], 6, 32)
b += label(1950, 1212, 'helical piles — it can move uphill', INK['green'], 54, anchor='end')
open('images/annotations/pond-house-06-ink.svg', 'w').write(
    svg(W, H, b, "Architect's notes over the Pond House exterior"))

# ---------------------------------------------------------------- pond-house-02
# Interior, 2000 x 1333. Living room, stair, fireplace.
W, H = 2000, 1333
b = ''
# clerestory band
b += stroke(smooth_path(wobble([(560, 330), (900, 312), (1240, 300), (1520, 300)], 4, 41)),
            INK['blue'], 9, 41)
b += stroke(smooth_path(wobble([(560, 372), (900, 354), (1240, 342), (1520, 342)], 4, 42)),
            INK['blue'], 9, 42)
b += arrow(760, 200, 900, 300, INK['blue'], 8, 43, bow=0.1)
b += label(430, 170, 'clerestory — you look out, then up', INK['blue'], 56)
# stair
b += stroke(smooth_path(wobble(ellipse_points(1290, 500, 230, 190, rot=0.5), 5, 51), close=True),
            INK['red'], 9, 51)
b += label(1950, 560, 'stair reads as', INK['red'], 56, anchor='end')
b += label(1950, 618, 'furniture, not wall', INK['red'], 56, anchor='end')
# hearth
b += bracket(1640, 1930, 880, INK['green'], 8, 61, depth=28)
b += label(1950, 1030, 'hearth anchors the whole room', INK['green'], 52, anchor='end')
open('images/annotations/pond-house-02-ink.svg', 'w').write(
    svg(W, H, b, "Architect's notes over the Pond House living room"))

print('wrote images/annotations/pond-house-06-ink.svg')
print('wrote images/annotations/pond-house-02-ink.svg')

# ---------------------------------------------------------------- pond-house-22
# Covered porch over the marsh, 2000 x 1333. Skylit roof, doors to dining.
W, H = 2000, 1333
b = ''
# skylights in the porch roof
b += stroke(smooth_path(wobble(ellipse_points(900, 235, 390, 155, rot=-0.13), 5, 71), close=True),
            INK['blue'], 9, 71)
b += arrow(430, 470, 660, 330, INK['blue'], 8, 72, bow=0.12)
b += label(110, 520, 'skylights — shade', INK['blue'], 58)
b += label(110, 580, 'without gloom', INK['blue'], 58)
# the marsh: the porch as midground
b += underline(130, 900, 1010, INK['green'], 7, 81)
b += label(130, 1100, 'the porch is the midground', INK['green'], 54)
# sliding doors
b += arrow(1700, 470, 1300, 610, INK['red'], 8, 91, bow=0.1)
b += label(1950, 380, 'doors stack away —', INK['red'], 56, anchor='end')
b += label(1950, 440, 'the room becomes the deck', INK['red'], 56, anchor='end')
open('images/annotations/pond-house-22-ink.svg', 'w').write(
    svg(W, H, b, "Architect's notes over the Pond House porch"))

print('wrote images/annotations/pond-house-22-ink.svg')
