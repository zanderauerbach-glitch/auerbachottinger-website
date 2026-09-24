#!/usr/bin/env node
/* What does this branch change on the built site?
 *
 *     npm run compare                       against master, as it is on GitHub
 *     node tools/build/compare.js --ref X   ...against some other commit
 *
 * Builds X in a temporary checkout, then compares every page with this
 * checkout's _site (npm run compare builds that first). Use it after a
 * template, stylesheet or script change that should leave the pages alone, and
 * to confirm a content edit touched only the pages it meant to.
 *
 * Source formatting differs from build to build, so this compares what a
 * browser builds, not what the file looks like:
 *
 *   - every element, in order, with its tag and its attributes
 *   - the text, with runs of whitespace collapsed
 *   - JSON-LD compared as parsed objects, since key order carries no meaning
 *
 * A difference here is a real difference. It exits 1 when anything differs, so
 * "identical" is something a script can rely on; whether a difference is the
 * one you meant is yours to read.
 *
 * It used to measure every page against the hand-written site from before
 * Eleventy, with an allow-list for intended differences. That guarded the
 * migration. Once the site was live, every ordinary content edit failed it.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseHTML } = require('linkedom');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = path.join(ROOT, '_site');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const ref = (() => {
  const i = process.argv.indexOf('--ref');
  if (i !== -1) return process.argv[i + 1];
  try { git('fetch', '--quiet', 'origin', 'master'); } catch { /* offline: use what we have */ }
  return 'origin/master';
})();

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('No _site to compare. Run `npm run compare`, which builds first.');
  process.exit(2);
}

/* Build the base in a checkout of its own, so this one is never touched. */
const sha = git('rev-parse', '--verify', `${ref}^{commit}`);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aa-compare-'));
let BASE;
try {
  git('worktree', 'add', '--detach', '--force', tmp, sha);
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(tmp, 'node_modules'), 'dir');
  execFileSync(path.join(ROOT, 'node_modules', '.bin', 'eleventy'), ['--quiet'], { cwd: tmp, stdio: 'ignore' });
  BASE = path.join(tmp, '_site');
} catch (e) {
  cleanup();
  console.error(`Could not build ${ref}: ${e.message}`);
  process.exit(2);
}
function cleanup() {
  try { git('worktree', 'remove', '--force', tmp); } catch { fs.rmSync(tmp, { recursive: true, force: true }); }
}

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

const pagesIn = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
const built = pagesIn(SITE);
const base = pagesIn(BASE);
let differing = 0;

for (const page of built) {
  if (!base.includes(page)) { console.log(`  + ${page} is new`); continue; }
  const a = facts(fs.readFileSync(path.join(BASE, page), 'utf8'), `${ref}:${page}`);
  const b = facts(fs.readFileSync(path.join(SITE, page), 'utf8'), `_site/${page}`);
  if (a.length === b.length && a.every((line, i) => line === b[i])) continue;
  differing++;
  const diffs = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) diffs.push([a[i] ?? null, b[i] ?? null]);
  }
  console.log(`\n  ~ ${page}`);
  diffs.slice(0, 6).forEach(([was, now]) => {
    console.log(`      was  ${was === null ? '(nothing)' : was.slice(0, 150)}`);
    console.log(`      now  ${now === null ? '(nothing)' : now.slice(0, 150)}`);
  });
  const more = a.length !== b.length ? ` (${a.length} facts before, ${b.length} now)` : '';
  if (diffs.length > 6) console.log(`      …and ${diffs.length - 6} more${more}`);
}
const dropped = base.filter((f) => !built.includes(f));
dropped.forEach((f) => console.log(`\n  - ${f} is built at ${ref} and not here`));

/* data/projects.js drives the filters, the map and Field Notes. Formatting
   there carries no meaning either — 41.40 and 41.4 are the same coordinate —
   so compare what the browser ends up with, not the text. */
let dataDiffers = false;
const dataBefore = evalProjects(fs.readFileSync(path.join(BASE, 'data/projects.js'), 'utf8'), `${ref}:data/projects.js`);
const dataAfter = evalProjects(fs.readFileSync(path.join(SITE, 'data/projects.js'), 'utf8'), '_site/data/projects.js');
if (!dataBefore || !dataAfter) {
  dataDiffers = true;
} else {
  const lines = [];
  for (const k of ['TYPES', 'STATUS', 'REGIONS', 'offices']) {
    if (JSON.stringify(sortDeep(dataBefore[k])) !== JSON.stringify(sortDeep(dataAfter[k]))) lines.push(`AA.${k} changed`);
  }
  const bySlug = (list) => new Map((list || []).map((p) => [p.slug, p]));
  const A = bySlug(dataBefore.projects), B = bySlug(dataAfter.projects);
  for (const slug of new Set([...A.keys(), ...B.keys()])) {
    if (!A.has(slug)) { lines.push(`${slug} added`); continue; }
    if (!B.has(slug)) { lines.push(`${slug} removed`); continue; }
    for (const k of new Set([...Object.keys(A.get(slug)), ...Object.keys(B.get(slug))])) {
      const was = JSON.stringify(sortDeep(A.get(slug)[k])), now = JSON.stringify(sortDeep(B.get(slug)[k]));
      if (was !== now) lines.push(`${slug}.${k}  ${was} → ${now}`);
    }
  }
  if (lines.length) {
    dataDiffers = true;
    console.log('\n  ~ data/projects.js');
    lines.forEach((l) => console.log(`      ${l.slice(0, 200)}`));
  }
}

cleanup();
const added = built.filter((f) => !base.includes(f)).length;
const same = built.length - differing - added;
console.log(`\n${built.length} pages compared against ${ref} (${sha.slice(0, 7)}) — ` +
  `${same} identical, ${differing} differing, ${added} new, ${dropped.length} gone` +
  (dataDiffers ? '; data/projects.js differs' : '; data/projects.js identical'));
process.exit(differing || added || dropped.length || dataDiffers ? 1 : 0);
