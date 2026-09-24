/* Prove the generated site is the site we already had.
 *
 *     node tools/build/compare.js            compare _site against HEAD
 *     node tools/build/compare.js --ref X    ...against some other commit
 *
 * Source formatting differs — the hand-written pages are not consistent with
 * each other, let alone with a template — so this compares what a browser
 * builds, not what the file looks like:
 *
 *   - every element, in order, with its tag and its attributes
 *   - the text, with runs of whitespace collapsed
 *   - JSON-LD compared as parsed objects, since key order carries no meaning
 *
 * A difference here is a real difference. Whitespace and attribute order are
 * not, and are the only things it forgives.
 *
 * Some differences are meant. ACCEPTED.json records those, each against a
 * fingerprint of the exact lines that differ, so an accepted difference stays
 * quiet and anything else on the same page still fails. Adding an entry is
 * deliberate:
 *
 *     node tools/build/compare.js --accept   then write the "why" by hand
 *
 * An entry whose page has stopped differing fails too. Otherwise the list
 * would fill up with exemptions nobody rechecks, and a regression would hide
 * behind one.
 */
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { parseHTML } = require('linkedom');
const vm = require('node:vm');

const ref = (() => {
  const i = process.argv.indexOf('--ref');
  if (i !== -1) return process.argv[i + 1];
  // The commit the site had before any of this, so the comparison keeps
  // meaning once the hand-written pages are deleted.
  return fs.readFileSync(__dirname + '/BASELINE', 'utf8').trim();
})();

const fromGit = (p) => {
  try {
    return execFileSync('git', ['show', `${ref}:${p}`], { encoding: 'utf8', maxBuffer: 1 << 28 });
  } catch {
    return null;
  }
};

const norm = (s) => s.replace(/\s+/g, ' ').trim();

/* A page as a list of facts a browser would agree with. */
function facts(html, label) {
  const { document } = parseHTML(html);
  const out = [];
  const walk = (el, path) => {
    // Adjacent text nodes are one run of text to a reader. A named entity such
    // as &lsquo; can parse into a node of its own, which is a difference in the
    // parse tree and no difference at all on the page.
    let pending = '';
    const flushText = () => {
      const t = norm(pending);
      if (t) out.push(`${path} #text ${t}`);
      pending = '';
    };
    for (const node of el.childNodes) {
      if (node.nodeType === 3) { pending += node.textContent; continue; }
      if (node.nodeType === 8) continue; // comments carry nothing to a reader
      if (node.nodeType !== 1) continue;
      flushText();
      const tag = node.tagName.toLowerCase();
      const attrs = [...node.attributes]
        .map((a) => [a.name, a.name === 'class' ? norm(a.value) : a.value])
        .sort((x, y) => (x[0] < y[0] ? -1 : 1))
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ');
      const here = `${path}/${tag}`;

      // JSON-LD is data, not text: compare it parsed.
      if (tag === 'script' && node.getAttribute('type') === 'application/ld+json') {
        let parsed;
        try {
          parsed = JSON.stringify(sortDeep(JSON.parse(node.textContent)));
        } catch (e) {
          parsed = `UNPARSEABLE in ${label}: ${e.message}`;
        }
        out.push(`${here} <${attrs}> json ${parsed}`);
        continue;
      }
      out.push(`${here} <${attrs}>`);
      if (tag === 'script' || tag === 'style') {
        const t = norm(node.textContent);
        if (t) out.push(`${here} #raw ${t}`);
        continue;
      }
      walk(node, here);
    }
    flushText();
  };
  walk(document, '');
  return out;
}

const sortDeep = (v) => {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortDeep(v[k])]));
  }
  return v;
};

const ACCEPTED_FILE = __dirname + '/ACCEPTED.json';
const accepted = fs.existsSync(ACCEPTED_FILE) ? JSON.parse(fs.readFileSync(ACCEPTED_FILE, 'utf8')) : {};
const writeAccept = process.argv.includes('--accept');
const fingerprint = (diffs) => crypto.createHash('sha256').update(JSON.stringify(diffs)).digest('hex').slice(0, 16);
const found = {};                       // what actually differs on this run

const built = fs.readdirSync('_site').filter((f) => f.endsWith('.html')).sort();
let differing = 0;
let allowed = 0;
let missing = 0;
let dataAccepted = false;
let dataDiffers = false;

for (const page of built) {
  const before = fromGit(page);
  if (before === null) {
    console.log(`  + ${page} is new — nothing at ${ref} to compare it with`);
    missing++;
    continue;
  }
  const a = facts(before, `${ref}:${page}`);
  const b = facts(fs.readFileSync(`_site/${page}`, 'utf8'), `_site/${page}`);
  if (a.length === b.length && a.every((line, i) => line === b[i])) continue;

  const diffs = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) diffs.push([a[i] ?? null, b[i] ?? null]);
  }
  const fp = fingerprint(diffs);
  found[page] = fp;

  if (accepted[page] && accepted[page].fingerprint === fp) {
    allowed++;
    console.log(`  = ${page} — accepted: ${accepted[page].why}`);
    continue;
  }

  differing++;
  console.log(`\n  ! ${page}`);
  if (accepted[page]) {
    console.log(`      this page has an accepted difference on record, and this is not it`);
    console.log(`      (was ${accepted[page].fingerprint}, now ${fp})`);
  }
  diffs.slice(0, 6).forEach(([was, now]) => {
    console.log(`      was  ${was === null ? '(nothing)' : was.slice(0, 150)}`);
    console.log(`      now  ${now === null ? '(nothing)' : now.slice(0, 150)}`);
  });
  const more = a.length !== b.length ? ` (${a.length} facts before, ${b.length} now)` : '';
  if (diffs.length > 6) console.log(`      …and ${diffs.length - 6} more${more}`);
}

/* data/projects.js is generated too. Formatting there carries no meaning
   either — 41.40 and 41.4 are the same coordinate — so compare what the
   browser ends up with, not the text. */
function evalProjects(src, label) {
  // `window.AA = …` has to create a global the way it does in a browser,
  // because the next line is a bare `AA.TYPES = …`.
  const ctx = {};
  ctx.window = ctx;
  try {
    vm.createContext(ctx);
    vm.runInContext(src, ctx);
  } catch (e) {
    console.log(`  ! ${label} does not run: ${e.message}`);
    return null;
  }
  return ctx.AA;
}
const dataBefore = evalProjects(fromGit('data/projects.js') || '', `${ref}:data/projects.js`);
const dataAfter = evalProjects(fs.readFileSync('_site/data/projects.js', 'utf8'), '_site/data/projects.js');
if (dataBefore && dataAfter) {
  const shape = (a) => JSON.stringify(sortDeep({
    TYPES: a.TYPES, STATUS: a.STATUS, REGIONS: a.REGIONS,
    projects: a.projects.map((p) => sortDeep(p)),
  }));
  if (shape(dataBefore) !== shape(dataAfter)) {
    const A = dataBefore.projects, B = dataAfter.projects;
    const lines = [];
    if (A.length !== B.length) lines.push([`${A.length} projects`, `${B.length} projects`]);
    for (let i = 0; i < Math.min(A.length, B.length); i++) {
      for (const k of new Set([...Object.keys(A[i]), ...Object.keys(B[i])])) {
        if (JSON.stringify(A[i][k]) !== JSON.stringify(B[i][k])) {
          lines.push([`${A[i].slug}.${k} ${JSON.stringify(A[i][k])}`, `${A[i].slug}.${k} ${JSON.stringify(B[i][k])}`]);
        }
      }
    }
    const fp = fingerprint(lines);
    found['data/projects.js'] = fp;
    const acc = accepted['data/projects.js'];
    if (acc && acc.fingerprint === fp) {
      dataAccepted = true;            // not a page, so not counted among them
      console.log(`  = data/projects.js — accepted: ${acc.why}`);
    } else {
      dataDiffers = true;             // fails the run, but is not a page
      console.log('\n  ! data/projects.js');
      if (acc) console.log(`      an accepted difference is on record, and this is not it (was ${acc.fingerprint}, now ${fp})`);
      lines.forEach(([was, now]) => console.log(`      was  ${was}\n      now  ${now}`));
    }
  } else {
    console.log('  data/projects.js — 16 projects, every field identical');
  }
}

/* An exemption for something that no longer differs is worse than no
   exemption: it is a place for a future regression to hide. */
const stale = Object.keys(accepted).filter((k) => !(k in found));
if (stale.length) {
  console.log(`\n  ! accepted differences are recorded for ${stale.join(', ')}, which no longer differ.`);
  console.log('    Remove them from tools/build/ACCEPTED.json.');
}

if (writeAccept) {
  const next = {};
  for (const [k, fp] of Object.entries(found)) {
    next[k] = { fingerprint: fp, why: (accepted[k] || {}).why || 'TODO — say why this difference is intended' };
  }
  fs.writeFileSync(ACCEPTED_FILE, JSON.stringify(next, null, 1) + '\n');
  console.log(`\nwrote ${ACCEPTED_FILE} with ${Object.keys(next).length} entr${Object.keys(next).length === 1 ? 'y' : 'ies'}.`);
  console.log('Fill in every "why" before committing — an exemption nobody can explain is not one.');
  process.exit(0);
}

const alsoInRepo = execFileSync('git', ['ls-tree', '--name-only', ref], { encoding: 'utf8' })
  .split('\n').filter((f) => f.endsWith('.html'));
const dropped = alsoInRepo.filter((f) => !built.includes(f));
if (dropped.length) console.log(`\n  ! pages that existed at ${ref} and are not built: ${dropped.join(', ')}`);

console.log(`\n${built.length} pages compared against ${ref} — ` +
  `${built.length - differing - allowed - missing} identical, ${allowed} accepted, ` +
  `${differing} differing, ${missing} new` +
  (dataAccepted ? '; data/projects.js accepted' : '') +
  (dataDiffers ? '; data/projects.js DIFFERS' : '') +
  (dropped.length ? `, ${dropped.length} missing` : ''));
process.exit(differing || dataDiffers || dropped.length || stale.length ? 1 : 0);
