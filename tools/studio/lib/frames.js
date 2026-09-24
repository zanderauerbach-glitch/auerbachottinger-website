/* Putting a photograph on a page.
 *
 * A frame on the site is a fixed shape — the gallery is 4:3, a full-width
 * frame is 16:7, the hero is whatever the file is — so a photograph has to be
 * cut to fit. Until now Claude chose every one of those crops by hand. This is
 * the same job done by whoever is looking at the photograph.
 *
 * The sizes match what is already in images/projects/, so a new frame sits
 * beside the old ones without anyone being able to tell which was which.
 */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const IMAGES = path.join(ROOT, 'images', 'projects');

/* width, height, and the aspect the cropping box is held to. `null` height on
   the hero means: keep the photograph's own shape, just make it 2000 across. */
const SHAPES = {
  hero: { width: 2000, height: null, ratio: null, quality: 88 },
  wide: { width: 1800, height: 788, ratio: 1800 / 788, quality: 86 },
  frame: { width: 1600, height: 1200, ratio: 4 / 3, quality: 86 },
};

const shapeFor = (kind) => SHAPES[kind] || SHAPES.frame;

/* A stable name for a frame, so reordering the gallery never renames a file.
   Order lives in the content file; names identify. */
async function nameFor(slug, kind, existing) {
  if (kind === 'hero') return `${slug}-hero.jpg`;
  if (existing && existing.startsWith(`images/projects/${slug}-`)) return path.basename(existing);
  const taken = new Set((await fsp.readdir(IMAGES).catch(() => []))
    .filter((f) => f.startsWith(slug + '-')));
  for (let n = 1; n < 400; n++) {
    const name = `${slug}-${String(n).padStart(2, '0')}.jpg`;
    if (!taken.has(name)) return name;
  }
  throw new Error('no free frame number left');
}

/* `crop` is fractions of the source, {x, y, w, h} each 0..1 — not pixels. The
   browser shows a scaled-down copy, so pixels there mean nothing here; a
   fraction means the same thing in both. Left out, the largest centred
   rectangle of the right shape is used. */
const UPSCALE_LIMIT = 1.02;

async function place({ slug, kind, source, crop, existing, allowUpscale = false }) {
  const shape = shapeFor(kind);
  const img = sharp(source).rotate();
  let meta;
  try {
    meta = await img.metadata();
  } catch (e) {
    throw new Error(`could not read ${path.basename(source)}: ${e.message.split('\n')[0]}. `
      + 'If this folder is still online-only in Dropbox, right-click it in Finder and '
      + 'choose "Make Available Offline", then try again.');
  }
  const sw = meta.width;
  const sh = meta.height;

  let box = crop && {
    x: crop.x * sw, y: crop.y * sh, w: crop.w * sw, h: crop.h * sh,
  };
  if (!box) {
    if (shape.ratio) {
      const w = Math.min(sw, Math.round(sh * shape.ratio));
      const h = Math.round(w / shape.ratio);
      box = { x: Math.round((sw - w) / 2), y: Math.round((sh - h) / 2), w, h };
    } else {
      box = { x: 0, y: 0, w: sw, h: sh };
    }
  }
  box = {
    x: Math.max(0, Math.min(sw - 1, Math.round(box.x))),
    y: Math.max(0, Math.min(sh - 1, Math.round(box.y))),
    w: Math.max(1, Math.round(box.w)),
    h: Math.max(1, Math.round(box.h)),
  };
  box.w = Math.min(box.w, sw - box.x);
  box.h = Math.min(box.h, sh - box.y);

  // How far the crop has to be stretched to fill the frame. Above 1 it is
  // being enlarged, which adds no detail and makes a soft picture — the same
  // thing that makes the home-page slideshow soft on a 4K screen. Worth
  // refusing rather than discovering later on the live site.
  const upscale = shape.width / box.w;

  let pipe = img.extract({ left: box.x, top: box.y, width: box.w, height: box.h });
  pipe = shape.height
    ? pipe.resize(shape.width, shape.height, { fit: 'fill' })
    : pipe.resize({ width: shape.width, withoutEnlargement: true });

  if (upscale > UPSCALE_LIMIT && !allowUpscale) {
    const e = new Error(
      `that crop is ${box.w}px wide and the frame wants ${shape.width}px, so it would be ` +
      `enlarged ${upscale.toFixed(2)}×. Enlarging adds no detail — it makes a soft picture. ` +
      'Keep more of the photograph, or use the full-size library rather than the resized copies.');
    e.upscale = Number(upscale.toFixed(3));
    throw e;
  }

  const name = await nameFor(slug, kind, existing);
  await fsp.mkdir(IMAGES, { recursive: true });
  const out = path.join(IMAGES, name);
  await pipe.jpeg({ quality: shape.quality, progressive: true, mozjpeg: false }).toFile(out);
  const written = await sharp(out).metadata();
  return {
    upscale: Number(upscale.toFixed(3)),
    path: `images/projects/${name}`,
    width: written.width,
    height: written.height,
    bytes: fs.statSync(out).size,
    crop: box,
    source: { width: sw, height: sh },
  };
}

module.exports = { SHAPES, shapeFor, place, IMAGES, UPSCALE_LIMIT };
