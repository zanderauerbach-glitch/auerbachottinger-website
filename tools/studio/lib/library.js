/* The photo libraries.
 *
 * A site-visit library is a folder of folders — Drone, Exterior, Interior —
 * sitting in Dropbox. It is read where it lies: nothing is copied into the
 * repository, nothing is uploaded, and the originals are never written to.
 *
 * The same library has a different path on each machine, so libraries.json
 * records them all and this uses whichever exists here. A machine with none
 * of them falls back to the resized copies under tools/review/build/copies,
 * which is what the artifact studio left behind — enough to keep working, and
 * marked as such so nobody mistakes it for the real thing.
 *
 * A photo's id is <Folder>_<filename without extension>, which is what the
 * marks have always been keyed on. Changing it would orphan every star.
 */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const STUDIO = path.resolve(__dirname, '..');
const THUMBS = path.join(STUDIO, '.thumbs');
const COPIES = path.join(ROOT, 'tools', 'review', 'build', 'copies');
const PHOTO = /\.(jpe?g|png)$/i;

/* A Dropbox folder that is not "available offline" holds placeholders, not
   photographs. Reading one asks Dropbox to fetch it, which can fail or take
   long enough to look like a hang — and the error it raises says nothing about
   Dropbox. This puts the likely cause where somebody will see it. */
function offline(file, e) {
  let size = null;
  try { size = fs.statSync(file).size; } catch { /* gone */ }
  const hint = 'If this folder is still online-only in Dropbox, right-click it in Finder '
    + 'and choose "Make Available Offline", then try again.';
  return `could not read ${path.basename(file)}${size === 0 ? ' (it is an empty placeholder)' : ''}: `
    + `${e.message.split('\n')[0]}. ${hint}`;
}

const os = require('node:os');
const home = (p) => (p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p);

/* Look for a folder by name instead of being told where it is.
 *
 * Dropbox puts a shared folder somewhere different on every machine —
 * ~/Dropbox on an older install, ~/Library/CloudStorage/Dropbox on a newer
 * one, and a team space adds another level. Writing those paths down means
 * getting them wrong, so this searches the few places it can be: the home
 * directory, and one level inside each CloudStorage provider.
 */
const dirs = (d) => {
  try {
    return fs.readdirSync(d, { withFileTypes: true })
      .filter((e) => e.isDirectory() || e.isSymbolicLink())
      .map((e) => path.join(d, e.name));
  } catch { return []; }
};

let discovered = null;
function discover(name) {
  if (!discovered) {
    const h = os.homedir();
    const bases = [h, ...dirs(path.join(h, 'Library', 'CloudStorage'))];
    discovered = new Map();
    for (const base of bases) {
      for (const d of dirs(base)) {
        const key = path.basename(d).toLowerCase();
        if (!discovered.has(key)) discovered.set(key, d);
      }
    }
  }
  return discovered.get(String(name).toLowerCase()) || null;
}

/* Each root lists every path it might be at, because the same Dropbox folder
   sits somewhere different on each machine. The first one that exists wins.
   STUDIO_LIBRARY overrides the lot, for a folder somewhere unexpected. */
function libraries() {
  const file = path.join(STUDIO, 'libraries.json');
  const doc = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { roots: [] };
  const roots = (doc.roots || []).map((r) => {
    const candidates = [...(r.paths || [])];
    // A folder found by name beats a path written down, because it is where
    // the folder actually is on this machine rather than where we guessed.
    if (r.find) {
      const hit = discover(r.find);
      if (hit) candidates.unshift(r.then ? path.join(hit, r.then) : hit);
    }
    const tried = candidates.map((p) => ({ path: home(p), exists: fs.existsSync(home(p)) }));
    const found = tried.find((t) => t.exists);
    return { ...r, tried, path: found ? found.path : null, present: !!found };
  });
  if (process.env.STUDIO_LIBRARY) {
    const p = home(process.env.STUDIO_LIBRARY);
    roots.unshift({
      id: 'env', label: 'STUDIO_LIBRARY', paths: [p],
      tried: [{ path: p, exists: fs.existsSync(p) }],
      path: fs.existsSync(p) ? p : null, present: fs.existsSync(p),
    });
  }
  return roots;
}

/* Where this machine can read <slug>'s photographs, and how good they are. */
function sourceFor(slug, review) {
  const where = (review && review.library) || null;
  const looked = [];
  if (where && where.relative) {
    for (const root of libraries()) {
      if (where.root && root.id !== where.root && root.id !== 'env') continue;
      for (const t of root.tried) {
        const dir = path.join(t.path, where.relative);
        const exists = t.exists && fs.existsSync(dir);
        looked.push({ path: dir, exists });
        if (exists) return { dir, kind: 'library', label: root.label, looked };
      }
    }
  }
  const copies = path.join(COPIES, slug);
  looked.push({ path: copies, exists: fs.existsSync(copies) });
  if (fs.existsSync(copies)) {
    return { dir: copies, kind: 'copies', looked,
      label: 'resized copies — the full-size library is not on this machine' };
  }
  // Nothing found. Say what was looked for; a wrong path in libraries.json is
  // the likeliest reason, and guessing is no help to anybody.
  return { dir: null, kind: 'missing', looked,
    label: where && where.relative
      ? 'the library folder is not on this machine'
      : 'this project has no library declared' };
}

/* Every photograph in a source, as {id, folder, file, path}. */
async function listPhotos(source) {
  if (!source || !source.dir) return [];
  const out = [];
  const entries = await fsp.readdir(source.dir, { withFileTypes: true });

  if (source.kind === 'copies') {
    // Already flattened by the artifact studio: Drone_DJI_0054.jpg
    for (const e of entries) {
      if (!e.isFile() || !PHOTO.test(e.name)) continue;
      const id = e.name.replace(PHOTO, '');
      out.push({ id, folder: id.split('_')[0], file: e.name, path: path.join(source.dir, e.name) });
    }
  } else {
    for (const d of entries) {
      if (!d.isDirectory()) continue;
      let files;
      try { files = await fsp.readdir(path.join(source.dir, d.name)); } catch { continue; }
      for (const f of files) {
        if (!PHOTO.test(f)) continue;
        const folder = d.name.replace(/\s+/g, '-');
        out.push({
          id: `${folder}_${f.replace(PHOTO, '')}`,
          folder,
          file: f,
          path: path.join(source.dir, d.name, f),
        });
      }
    }
  }
  out.sort((a, b) => (a.id < b.id ? -1 : 1));
  return out;
}

/* A thumbnail, made once and kept outside the repository. Keyed on the file's
   path, size and modification time, so editing a photograph makes a new one
   rather than serving a stale square. */
async function thumb(file, width = 520) {
  const st = await fsp.stat(file);
  const key = crypto.createHash('sha1')
    .update(`${file}|${st.size}|${st.mtimeMs}|${width}`).digest('hex');
  const cached = path.join(THUMBS, key + '.jpg');
  try { return await fsp.readFile(cached); } catch { /* not made yet */ }
  let buf;
  try {
    buf = await sharp(file).rotate().resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 78 }).toBuffer();
  } catch (e) {
    throw new Error(offline(file, e));
  }
  await fsp.mkdir(THUMBS, { recursive: true });
  await fsp.writeFile(cached, buf);
  return buf;
}

module.exports = { libraries, sourceFor, listPhotos, thumb, THUMBS };
