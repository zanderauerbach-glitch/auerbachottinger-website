#!/usr/bin/env node
/* Every `npm run …` a README tells someone to type must exist.
 *
 *     node tools/build/check-scripts.js
 *
 * Written after `npm run studio` — the one command the studio's README opens
 * with — turned out not to exist. Tidying package.json had replaced the whole
 * scripts block, and nothing noticed, because the tests start the server by
 * path rather than through npm. The documented way in was the one way in that
 * was never exercised.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts || {};

const docs = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '_site' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.md')) docs.push(p);
  }
})(ROOT);

let bad = 0;
const seen = new Set();
for (const doc of docs) {
  const text = fs.readFileSync(doc, 'utf8');
  for (const m of text.matchAll(/npm run ([a-z][a-z0-9:-]*)/g)) {
    const name = m[1];
    seen.add(name);
    if (!(name in scripts)) {
      const line = text.slice(0, m.index).split('\n').length;
      console.log(`  ! ${path.relative(ROOT, doc)}:${line} says "npm run ${name}", which package.json does not have`);
      bad++;
    }
  }
}

console.log(bad
  ? `\n${bad} documented command${bad === 1 ? '' : 's'} do not exist`
  : `${docs.length} README${docs.length === 1 ? '' : 's'} checked — all ${seen.size} documented commands exist`);
process.exit(bad ? 1 : 0);
