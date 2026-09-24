#!/usr/bin/env node
/* Turn the Finder tags on a project's photographs into stars.
 *
 *     npm run studio:tags                 every project, report only
 *     npm run studio:tags -- --write      write them
 *     npm run studio:tags -- calebs-pond --write
 *
 * It reports first and writes only when asked, because it reads a folder
 * nobody can see from here and the first run should be something to look at,
 * not something to undo.
 *
 * Adds and raises; never clears. A photograph starred in the studio but not
 * tagged in Finder keeps its stars — the two are different people's opinions
 * and neither is authoritative. --replace drops that and makes the tags the
 * whole truth.
 */
const fs = require('node:fs');
const path = require('node:path');

const tags = require('./lib/tags');
const lib = require('./lib/library');

const REVIEW = path.join(__dirname, 'review');
const args = process.argv.slice(2);
const write = args.includes('--write');
const replace = args.includes('--replace');
const only = args.filter((a) => !a.startsWith('--'));

(async () => {
  const slugs = fs.readdirSync(REVIEW).filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((s) => !only.length || only.includes(s));

  if (!tags.supported()) {
    console.log(`Finder tags are a macOS thing; this is ${process.platform}. Nothing to read.`);
    process.exit(0);
  }

  let changedFiles = 0;
  for (const slug of slugs) {
    const file = path.join(REVIEW, slug + '.json');
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const source = lib.sourceFor(slug, doc);
    if (!source || !source.dir) {
      console.log(`${slug}: no library on this machine — ${source && source.label}`);
      continue;
    }
    if (source.kind !== 'library') {
      console.log(`${slug}: skipped — ${source.label}. Tags live on the originals, not on copies.`);
      continue;
    }

    const { tagged } = await tags.read(source.dir);
    const marks = doc.marks || (doc.marks = {});
    const changes = [];
    const seen = new Set();

    for (const t of tagged) {
      const id = tags.idFor(source.dir, t.file);
      seen.add(id);
      const was = (marks[id] || {}).stars || 0;
      if (t.stars > was || (replace && t.stars !== was)) {
        changes.push({ id, was, now: t.stars, colours: t.colours.join(', ') });
        marks[id] = { stars: t.stars, note: (marks[id] || {}).note || '' };
      }
    }
    if (replace) {
      for (const [id, m] of Object.entries(marks)) {
        if (!seen.has(id) && m.stars) {
          changes.push({ id, was: m.stars, now: 0, colours: 'no tag' });
          if (m.note) marks[id] = { stars: 0, note: m.note };
          else delete marks[id];
        }
      }
    }

    console.log(`\n${slug} — ${tagged.length} tagged photograph${tagged.length === 1 ? '' : 's'} in the library`);
    if (!changes.length) {
      console.log('  nothing to change; the stars already match the tags');
      continue;
    }
    for (const c of changes) {
      console.log(`  ${c.id.padEnd(26)} ${String(c.was).padStart(1)} → ${c.now}   ${c.colours}`);
    }
    if (write) {
      doc.marks = Object.fromEntries(Object.keys(marks).sort().map((k) => [k, marks[k]]));
      fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n', 'utf8');
      changedFiles++;
    }
  }

  console.log(write
    ? `\nwritten to ${changedFiles} review file${changedFiles === 1 ? '' : 's'}.`
    : '\nnothing written — run again with --write to apply.');
})().catch((e) => {
  console.error('could not read the tags:', e.message);
  process.exit(1);
});
