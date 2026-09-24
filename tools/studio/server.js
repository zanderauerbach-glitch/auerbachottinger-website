#!/usr/bin/env node
/* The studio.
 *
 *     npm run studio        →  http://127.0.0.1:4000
 *
 * A small server that runs on your own machine. It reads and writes
 * content/projects/*.json, rebuilds the site after every save, shows you the
 * real page beside what you are editing, and commits when you say so.
 *
 * It listens on 127.0.0.1 only. Nothing outside this machine can reach it, so
 * there is no login — and there must never be one bound to a public address
 * without one.
 */
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const run = promisify(execFile);
const ROOT = path.resolve(__dirname, '..', '..');
const CONTENT = path.join(ROOT, 'content', 'projects');
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.STUDIO_PORT || 4000);

const lib = require('./lib/library');
const frames = require('./lib/frames');
const REVIEW = path.join(__dirname, 'review');

/* Stars, notes and the draft layout for one project. One file each, so two
   people editing different projects never collide, and a change to a single
   star is a single line in a diff. */
async function readReview(slug) {
  try {
    return JSON.parse(await fsp.readFile(path.join(REVIEW, slugOf(slug) + '.json'), 'utf8'));
  } catch {
    return { slug, layout: null, marks: {} };
  }
}

async function writeReview(slug, mutate) {
  const doc = await readReview(slug);
  mutate(doc);
  doc.marks = Object.fromEntries(Object.keys(doc.marks || {}).sort().map((k) => [k, doc.marks[k]]));
  await fsp.mkdir(REVIEW, { recursive: true });
  await fsp.writeFile(path.join(REVIEW, slugOf(slug) + '.json'),
    JSON.stringify(doc, null, 1) + '\n', 'utf8');
  return doc;
}

const git = (...args) => run('git', args, { cwd: ROOT, maxBuffer: 1 << 26 });

/* ---------------------------------------------------------------- content */

const slugOf = (s) => {
  if (!/^[a-z0-9-]+$/.test(s)) throw new Error(`not a slug: ${JSON.stringify(s)}`);
  return s;
};
const fileFor = (slug) => path.join(CONTENT, slugOf(slug) + '.json');

async function readProjects() {
  const names = (await fsp.readdir(CONTENT)).filter((f) => f.endsWith('.json'));
  const docs = await Promise.all(names.map(async (n) =>
    JSON.parse(await fsp.readFile(path.join(CONTENT, n), 'utf8'))));
  return docs.sort((a, b) => a.order - b.order);
}

/* The fields the studio is allowed to change. Anything else in a content file
   — order, slug, page, the gallery — is left exactly as it was, so a bug here
   cannot quietly rewrite a part of the file nobody was editing. */
const EDITABLE = {
  card: ['name', 'location', 'tagline', 'status', 'alt', 'press', 'lat', 'lng'],
  page_content: ['title', 'metaDescription', 'heading', 'body', 'details', 'hero', 'gallery'],
  schema: ['description', 'about'],
};

async function saveProject(slug, incoming) {
  const file = fileFor(slug);
  const doc = JSON.parse(await fsp.readFile(file, 'utf8'));
  const changed = [];

  for (const [section, keys] of Object.entries(EDITABLE)) {
    const from = incoming[section];
    if (!from || typeof from !== 'object') continue;
    for (const k of keys) {
      if (!(k in from)) continue;
      const before = JSON.stringify(doc[section]?.[k] ?? null);
      const after = JSON.stringify(from[k] ?? null);
      if (before === after) continue;
      doc[section] = doc[section] || {};
      doc[section][k] = from[k];
      changed.push(`${section}.${k}`);
    }
  }
  if (!changed.length) return { changed };

  // Classes are a set. A browser that sends "wide wide" gets "wide" stored,
  // so a bug in the page cannot leave the content file saying something no
  // one meant.
  const tidy = (f) => {
    if (f && typeof f.classes === 'string') {
      f.classes = [...new Set(f.classes.split(/\s+/).filter(Boolean))].join(' ');
    }
    return f;
  };
  if (doc.page_content) {
    tidy(doc.page_content.hero);
    (doc.page_content.gallery || []).forEach(tidy);
  }

  // Coordinates are town-level by intent: the map page is public and the
  // houses are private. Three or four decimals is a village; six is a door.
  for (const k of ['lat', 'lng']) {
    const v = doc.card[k];
    if (typeof v === 'number') doc.card[k] = Number(v.toFixed(4));
  }

  await fsp.writeFile(file, JSON.stringify(doc, null, 1) + '\n', 'utf8');
  return { changed };
}

/* ------------------------------------------------------------------ build */

let building = null;
let pushing = false;
async function build() {
  if (building) return building;
  building = (async () => {
    try {
      await run('npx', ['@11ty/eleventy'], { cwd: ROOT, maxBuffer: 1 << 26 });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e.stderr || e.stdout || e.message).toString().slice(-4000) };
    } finally {
      building = null;
    }
  })();
  return building;
}

/* -------------------------------------------------------------------- git */

/* Ask the remote where it is, rather than trusting what this clone last
   heard. Without this, "behind" is only as fresh as the last fetch — which is
   how a commit gets made on a stale base and the push is the first thing to
   notice. Cheap, and it fails quietly when there is no network. */
async function refresh() {
  try { await git('fetch', '--quiet', 'origin'); } catch { /* offline is fine */ }
}

async function status() {
  const [{ stdout: porcelain }, { stdout: branch }] = await Promise.all([
    git('status', '--porcelain'),
    git('rev-parse', '--abbrev-ref', 'HEAD'),
  ]);
  const files = porcelain.split('\n').filter(Boolean)
    .map((l) => ({ state: l.slice(0, 2).trim(), path: l.slice(3) }))
    .filter((f) => !f.path.startsWith('_site/'));
  let behind = 0;
  let ahead = 0;
  try {
    const { stdout } = await git('rev-list', '--left-right', '--count', `@{upstream}...HEAD`);
    [behind, ahead] = stdout.trim().split(/\s+/).map(Number);
  } catch { /* no upstream yet */ }
  return { branch: branch.trim(), files, behind, ahead };
}

async function commit(message) {
  await refresh();
  const st = await status();
  if (!st.files.length) throw new Error('nothing to commit');
  // Someone else has pushed since this clone last looked. Committing on top
  // is fine; pushing without merging is what goes wrong, so stop here and say
  // so rather than letting the push fail halfway.
  if (st.behind > 0) {
    throw new Error(`${st.behind} commit${st.behind === 1 ? '' : 's'} on the remote that this clone does not have. ` +
      'Pull first, then commit.');
  }
  const subject = (message || '').trim() || 'Studio: content edits';
  // Not tools/studio/review: this repository is public, and the review notes
  // (stars, remarks on who is in a photograph, where the library lives) are
  // working notes, not site content. They are git-ignored and stay on the
  // machine that made them.
  await git('add', '--', 'content', 'data', 'images');
  await git('commit', '-m', subject);
  return status();
}

/* ----------------------------------------------------------------- server */

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

const send = (res, code, body, type = 'application/json; charset=utf-8') => {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  res.writeHead(code, {
    'content-type': type,
    'cache-control': 'no-store',
    'content-length': buf.length,
  });
  res.end(buf);
};

/* Serve a file from `base`, refusing anything that resolves outside it. */
async function sendFile(res, base, rel) {
  const full = path.resolve(base, '.' + path.posix.normalize('/' + rel));
  if (full !== base && !full.startsWith(base + path.sep)) return send(res, 403, { error: 'no' });
  let target = full;
  try {
    if ((await fsp.stat(target)).isDirectory()) target = path.join(target, 'index.html');
  } catch { return send(res, 404, { error: 'not found' }); }
  try {
    const body = await fsp.readFile(target);
    send(res, 200, body, TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream');
  } catch { send(res, 404, { error: 'not found' }); }
}

const readBody = (req) => new Promise((resolve, reject) => {
  let s = '';
  req.on('data', (c) => {
    s += c;
    if (s.length > 4e6) reject(new Error('too big'));
  });
  req.on('end', () => {
    try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); }
  });
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const p = url.pathname;
  try {
    if (p === '/api/state') {
      await refresh();
      return send(res, 200, {
        projects: await readProjects(),
        taxonomy: JSON.parse(await fsp.readFile(path.join(ROOT, 'content', 'taxonomy.json'), 'utf8')),
        git: await status(),
        libraries: lib.libraries(),
      });
    }
    if (p.startsWith('/api/project/') && req.method === 'PUT') {
      const slug = p.slice('/api/project/'.length);
      const { changed } = await saveProject(slug, await readBody(req));
      const built = changed.length ? await build() : { ok: true };
      return send(res, 200, { changed, build: built, git: await status() });
    }
    if (p === '/api/build' && req.method === 'POST') {
      return send(res, 200, { build: await build(), git: await status() });
    }
    if (p === '/api/commit' && req.method === 'POST') {
      const { message } = await readBody(req);
      return send(res, 200, { git: await commit(message) });
    }
    if (p === '/api/push' && req.method === 'POST') {
      if (pushing) throw new Error('a push is already running — give it a moment');
      pushing = true;
      try {
        await refresh();
        const st = await status();
        if (st.behind > 0) {
          throw new Error(
            `${st.behind} commit${st.behind === 1 ? '' : 's'} arrived on the remote since this clone ` +
            'last looked. Your work is committed and safe; pull those in, then push again.');
        }
        await git('push', '-u', 'origin', st.branch);
        return send(res, 200, { git: await status() });
      } finally {
        pushing = false;
      }
    }
    if (p.startsWith('/api/library/')) {
      const slug = p.slice('/api/library/'.length);
      const review = await readReview(slug);
      const source = lib.sourceFor(slug, review);
      const photos = await lib.listPhotos(source);
      return send(res, 200, {
        source: source && { kind: source.kind, label: source.label, looked: source.looked || [] },
        photos: photos.map(({ id, folder, file }) => ({ id, folder, file })),
        marks: review.marks || {},
        layout: review.layout,
      });
    }
    if (p.startsWith('/api/thumb/')) {
      const [slug, ...rest] = p.slice('/api/thumb/'.length).split('/');
      const id = decodeURIComponent(rest.join('/'));
      const source = lib.sourceFor(slug, await readReview(slug));
      const photo = (await lib.listPhotos(source)).find((x) => x.id === id);
      if (!photo) return send(res, 404, { error: 'no such photograph' });
      const width = Number(url.searchParams.get('w') || 520);
      return send(res, 200, await lib.thumb(photo.path, Math.min(2000, Math.max(80, width))), 'image/jpeg');
    }
    if (p.startsWith('/api/mark/') && req.method === 'PUT') {
      const [slug, ...rest] = p.slice('/api/mark/'.length).split('/');
      const id = decodeURIComponent(rest.join('/'));
      const { stars, note } = await readBody(req);
      const doc = await writeReview(slug, (d) => {
        d.marks = d.marks || {};
        const m = d.marks[id] || { stars: 0, note: '' };
        if (stars !== undefined) m.stars = Math.max(0, Math.min(5, Number(stars) || 0));
        if (note !== undefined) m.note = String(note);
        if (!m.stars && !m.note) delete d.marks[id];
        else d.marks[id] = m;
      });
      return send(res, 200, { marks: doc.marks, git: await status() });
    }
    if (p.startsWith('/api/layout/') && req.method === 'PUT') {
      const slug = p.slice('/api/layout/'.length);
      const layout = await readBody(req);
      const doc = await writeReview(slug, (d) => { d.layout = layout; });
      return send(res, 200, { layout: doc.layout, git: await status() });
    }
    /* Cut a photograph from the library to a frame's shape, write it into
       images/projects/ and put it on the page. */
    if (p.startsWith('/api/place/') && req.method === 'POST') {
      const slug = slugOf(p.slice('/api/place/'.length));
      const { photoId, target, crop, alt, allowUpscale } = await readBody(req);
      const review = await readReview(slug);
      const photo = (await lib.listPhotos(lib.sourceFor(slug, review)))
        .find((x) => x.id === photoId);
      if (!photo) throw new Error(`no photograph called ${photoId} in this library`);

      const doc = JSON.parse(await fsp.readFile(fileFor(slug), 'utf8'));
      const pc = doc.page_content;
      const hero = target === 'hero';
      const at = hero ? null : (target === 'new' ? (pc.gallery || []).length : Number(target));
      const slot = hero ? pc.hero : (pc.gallery || [])[at];
      const kind = hero ? 'hero' : ((slot && /\bwide\b/.test(slot.classes || '')) ? 'wide' : 'frame');

      const written = await frames.place({
        slug, kind, source: photo.path, crop, allowUpscale,
        existing: slot && slot.image,
      });

      const entry = {
        ...(slot || { classes: hero ? '' : '', focal: '50% 50%' }),
        image: written.path,
        alt: alt !== undefined ? alt : (slot && slot.alt) || '',
      };
      if (hero) pc.hero = entry;
      else {
        pc.gallery = pc.gallery || [];
        pc.gallery[at] = entry;
      }
      await fsp.writeFile(fileFor(slug), JSON.stringify(doc, null, 1) + '\n', 'utf8');
      const built = await build();
      return send(res, 200, { written, build: built, project: doc, git: await status() });
    }

    /* A source photograph at a size the cropping box can work on. */
    if (p.startsWith('/api/source/')) {
      const [slug, ...rest] = p.slice('/api/source/'.length).split('/');
      const id = decodeURIComponent(rest.join('/'));
      const photo = (await lib.listPhotos(lib.sourceFor(slug, await readReview(slug))))
        .find((x) => x.id === id);
      if (!photo) return send(res, 404, { error: 'no such photograph' });
      return send(res, 200, await lib.thumb(photo.path, 1400), 'image/jpeg');
    }

    if (p === '/api/shapes') return send(res, 200, frames.SHAPES);

    if (p === '/favicon.ico') return send(res, 204, '');
    if (p.startsWith('/preview/')) return sendFile(res, path.join(ROOT, '_site'), p.slice('/preview'.length));
    return sendFile(res, PUBLIC, p === '/' ? '/index.html' : p);
  } catch (e) {
    send(res, 400, { error: e.message });
  }
});

if (require.main === module) {
  (async () => {
    if (!fs.existsSync(path.join(ROOT, '_site', 'index.html'))) {
      process.stdout.write('building the site first… ');
      const b = await build();
      console.log(b.ok ? 'done' : 'FAILED\n' + b.error);
    }
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`\n  The studio is at http://127.0.0.1:${PORT}\n`);
      console.log('  It is on this machine only. Ctrl-C to stop.\n');
    });
  })();
}

module.exports = { server, readProjects, saveProject, status, commit, build };
