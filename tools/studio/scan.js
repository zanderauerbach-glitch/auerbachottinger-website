#!/usr/bin/env node
/* Which site-visit libraries exist, and which the studio knows about.
 *
 *     npm run studio:scan
 *
 * Red Coat Hill sat in Dropbox with ninety-odd photographs and no review file
 * for weeks, because nothing looked. This looks: it walks each library root
 * for a "… Site Visit/Photos" folder and says which project it belongs to, or
 * that it belongs to none.
 */
const fs = require('node:fs');
const path = require('node:path');
const lib = require('./lib/library');

const ROOT = path.resolve(__dirname, '..', '..');
const REVIEW = path.join(__dirname, 'review');
const CONTENT = path.join(ROOT, 'content', 'projects');

const dirs = (d) => {
  try {
    return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory())
      .map((e) => path.join(d, e.name));
  } catch { return []; }
};

const declared = new Map();      // absolute Photos folder -> slug
for (const f of fs.readdirSync(REVIEW).filter((x) => x.endsWith('.json'))) {
  const doc = JSON.parse(fs.readFileSync(path.join(REVIEW, f), 'utf8'));
  const s = lib.sourceFor(doc.slug, doc);
  declared.set(doc.slug, s && s.kind === 'library' ? s.dir : null);
}

const projects = fs.readdirSync(CONTENT).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')));
const nameOf = (slug) => (projects.find((p) => p.slug === slug) || {}).card?.name || slug;

const roots = lib.libraries().filter((r) => r.present);
if (!roots.length) {
  console.log('No library root is on this machine, so there is nothing to scan.');
  console.log('The studio looks in your home directory and each CloudStorage provider.');
  process.exit(0);
}

const found = [];
for (const root of roots) {
  for (const area of dirs(root.path)) {          // Marthas Vineyard, Portfolio, …
    for (const project of dirs(area)) {          // Calebs Pond, Red Coat Hill, …
      for (const visit of dirs(project)) {       // 2026.08.31 Site Visit
        if (!/site visit/i.test(path.basename(visit))) continue;
        const photos = path.join(visit, 'Photos');
        if (!fs.existsSync(photos)) continue;
        const folders = dirs(photos);
        const count = folders.reduce((n, f) => n + fs.readdirSync(f)
          .filter((x) => /\.(jpe?g|png)$/i.test(x)).length, 0);
        found.push({ photos, project: path.basename(project), visit: path.basename(visit), count, folders });
      }
    }
  }
}

console.log(`${found.length} site-visit librar${found.length === 1 ? 'y' : 'ies'} on this machine\n`);
let orphans = 0;
for (const f of found) {
  const slug = [...declared].find(([, dir]) => dir === f.photos)?.[0];
  console.log(`  ${f.project} — ${f.visit}, ${f.count} photographs in ${f.folders.length} folders`);
  console.log(slug
    ? `    → ${nameOf(slug)} (${slug})`
    : '    → no project claims it. Add a review file with this library path to review it.');
  if (!slug) orphans++;
}

const unreachable = [...declared].filter(([, dir]) => !dir).map(([s]) => s);
if (unreachable.length) {
  console.log(`\n  declared but not on this machine: ${unreachable.join(', ')}`);
}
console.log(orphans ? `\n${orphans} librar${orphans === 1 ? 'y is' : 'ies are'} not claimed by any project.` : '');
