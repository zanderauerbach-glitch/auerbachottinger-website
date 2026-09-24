/* Nunjucks autoescaping is off in .eleventy.js, because the filters there do
   the escaping and doing both would double it. That trade is only safe while
   every value in a template goes through one of them, so this checks it.

       node tools/build/lint-templates.js
*/
const fs = require('node:fs');
const path = require('node:path');

const SAFE = new Set(['t', 'a', 'img', 'schema', 'js', 'num', 'key', 'tag']);
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.njk')) files.push(p);
  }
})('src');

let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/\{\{(.+?)\}\}/g)) {
      const expr = m[1].trim();
      // A literal, a loop helper, or a value that ends in one of the filters.
      if (/^"[^"]*"$/.test(expr) || /^'[^']*'$/.test(expr)) continue;
      if (/^"[^"]*" if /.test(expr) || /^", " if /.test(expr)) continue;
      const last = expr.split('|').pop().trim().split('(')[0].trim();
      if (SAFE.has(last)) continue;
      console.log(`  ! ${f}:${i + 1}  {{ ${expr} }} — no escaping filter`);
      bad++;
    }
  });
}
console.log(bad
  ? `\n${bad} unescaped insertion${bad === 1 ? '' : 's'} — add | t (text) or | a (attribute)`
  : `${files.length} templates checked — every insertion is escaped`);
process.exit(bad ? 1 : 0);
