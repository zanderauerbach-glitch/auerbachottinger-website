#!/usr/bin/env node
/* Move the review state out of the artifact database and into the repository.
 *
 *     node tools/studio/migrate-review.js --from tools/studio/.export
 *
 * The export is whatever the ArtifactData tool wrote:
 *   <dir>/marks/<slug>__<photo id>.json   {stars, note}
 *   <dir>/layout/<slug>.json              {hero, slots}
 *
 * They become one file per project in tools/studio/review/, which is where
 * the studio reads and writes them from now on. Every star Zander placed is
 * in there, so this checks that each one arrives rather than assuming it.
 *
 * One way, and only once. It refuses to overwrite a project file that already
 * holds marks, because by then the repository is the source and the export is
 * a stale copy of it.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'review');

const arg = (name, fallback) => {
  const i = process.argv.indexOf('--' + name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const from = path.resolve(ROOT, arg('from', 'tools/studio/.export'));
const force = process.argv.includes('--force');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
/* The tool writes either the bare document or an {id, data, version} envelope. */
const unwrap = (d) => (d && typeof d === 'object' && 'data' in d && 'id' in d ? d.data : d);

const byProject = new Map();
const project = (slug) => {
  if (!byProject.has(slug)) byProject.set(slug, { slug, layout: null, marks: {} });
  return byProject.get(slug);
};

let markCount = 0;
const marksDir = path.join(from, 'marks');
for (const f of fs.existsSync(marksDir) ? fs.readdirSync(marksDir) : []) {
  if (!f.endsWith('.json')) continue;
  const id = f.replace(/\.json$/, '');
  const at = id.indexOf('__');
  if (at === -1) throw new Error(`cannot tell which project ${f} belongs to`);
  const slug = id.slice(0, at);
  const photo = id.slice(at + 2);
  project(slug).marks[photo] = unwrap(readJson(path.join(marksDir, f)));
  markCount++;
}

let layoutCount = 0;
const layoutDir = path.join(from, 'layout');
for (const f of fs.existsSync(layoutDir) ? fs.readdirSync(layoutDir) : []) {
  if (!f.endsWith('.json')) continue;
  project(f.replace(/\.json$/, '')).layout = unwrap(readJson(path.join(layoutDir, f)));
  layoutCount++;
}

fs.mkdirSync(OUT, { recursive: true });
const written = [];
for (const [slug, doc] of [...byProject].sort()) {
  const target = path.join(OUT, slug + '.json');
  if (fs.existsSync(target) && !force) {
    const held = readJson(target);
    if (Object.keys(held.marks || {}).length) {
      console.error(`  ! ${slug} already has ${Object.keys(held.marks).length} marks in the repository.`);
      console.error('    The repository is the source now; this export is older than it.');
      console.error('    Pass --force only if you mean to throw those away.');
      process.exit(1);
    }
  }
  // Sorted keys so a later change shows as one line in a diff, not a reshuffle.
  const marks = Object.fromEntries(Object.keys(doc.marks).sort().map((k) => [k, doc.marks[k]]));
  fs.writeFileSync(target, JSON.stringify({ slug, layout: doc.layout, marks }, null, 1) + '\n');
  written.push({ slug, marks: Object.keys(marks).length, layout: !!doc.layout });
}

/* Read it all back and check every mark survived, value for value. */
let recovered = 0;
let starred = 0;
for (const { slug } of written) {
  const doc = readJson(path.join(OUT, slug + '.json'));
  for (const [photo, m] of Object.entries(doc.marks)) {
    const original = unwrap(readJson(path.join(marksDir, `${slug}__${photo}.json`)));
    if (JSON.stringify(m) !== JSON.stringify(original)) {
      console.error(`  ! ${slug}/${photo} did not survive: ${JSON.stringify(original)} became ${JSON.stringify(m)}`);
      process.exit(1);
    }
    recovered++;
    if ((m.stars || 0) > 0) starred++;
  }
  if (doc.layout) {
    const original = unwrap(readJson(path.join(layoutDir, `${slug}.json`)));
    if (JSON.stringify(doc.layout) !== JSON.stringify(original)) {
      console.error(`  ! ${slug} layout did not survive`);
      process.exit(1);
    }
  }
}

for (const w of written) {
  console.log(`  ${w.slug.padEnd(16)} ${String(w.marks).padStart(3)} marks` +
    (w.layout ? ', a draft layout' : ', no layout'));
}
if (recovered !== markCount) {
  console.error(`  ! ${markCount} marks exported but ${recovered} arrived`);
  process.exit(1);
}
console.log(`\n${markCount} marks and ${layoutCount} layouts moved into ` +
  `${path.relative(ROOT, OUT)}, all ${recovered} read back identical (${starred} starred).`);
