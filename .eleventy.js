/* The site build.
 *
 * The 16 project pages are generated from content/projects/*.json. Everything
 * else is copied through untouched — the 17 bespoke pages, the stylesheet, the
 * scripts, the images.
 *
 * Escaping matches what the hand-written pages already do: `&`, `<` and `>` in
 * text, plus `"` in an attribute, and nothing else. Nunjucks autoescaping is
 * off, because these filters do the escaping and doing both would double it.
 * `npm run check` fails the build if any `{{ … }}` in a template is missing a
 * filter, which is what keeps that safe.
 */
const encText = (s) =>
  String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const encAttr = (s) => encText(s).replace(/"/g, '&quot;');

/* The same file src/_data/taxonomy.js serves to the templates. Read here too,
   because a filter runs outside the data cascade and cannot reach it. */
const TAXONOMY = () => JSON.parse(
  require('node:fs').readFileSync(require('node:path').join(__dirname, 'content', 'taxonomy.json'), 'utf8'));

module.exports = function (eleventyConfig) {
  // Only .njk files are templates. Every .html in the repository is a
  // hand-written page and is copied as it stands.
  eleventyConfig.setTemplateFormats(['njk']);
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: false, trimBlocks: false });

  eleventyConfig.addFilter('t', encText);
  // A JS string literal, quoted the way the file already does it: single
  // quotes unless the value contains one, in which case double.
  eleventyConfig.addFilter('js', (v) => {
    if (v === null || v === undefined) return 'null';
    const s = String(v);
    return s.includes("'") && !s.includes('"')
      ? JSON.stringify(s)
      : "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  });
  // `key: value` padded to a column, the way the file is already written.
  eleventyConfig.addFilter('key', (k, width) => k + ':' + ' '.repeat(Math.max(1, width - k.length - 1)));
  // A description block is a heading or a paragraph and nothing else. This is
  // the one place a content file decides an element name, so it is the one
  // place that needs saying out loud.
  eleventyConfig.addFilter('tag', (t) => {
    if (!['h2', 'h3', 'p'].includes(t)) throw new Error(`description block tag ${JSON.stringify(t)} is not allowed`);
    return t;
  });
  eleventyConfig.addFilter('num', (v) => (v === null || v === undefined ? 'null' : String(v)));
  eleventyConfig.addFilter('a', encAttr);

  /* A card carries its region and everything that region sits inside, so
     filtering by Massachusetts finds the Vineyard projects too — Martha's
     Vineyard is in Massachusetts, and a visitor looking for work in the state
     should not have to know to look under the island as well.

     The containment is recorded once, in taxonomy.json REGION_WITHIN. Adding
     it to each project's region instead would mean every new island project
     needing somebody to remember, and eventually one of them would not. */
  eleventyConfig.addFilter('regions', (key) => {
    const within = TAXONOMY().REGION_WITHIN || {};
    const chain = [];
    let k = key;
    while (k && !chain.includes(k)) { chain.push(k); k = within[k]; }
    return chain;
  });

  // An <img> exactly as the pages write it: a focal point only when it is not
  // centred, because centred is the default and writes no style at all.
  eleventyConfig.addFilter('img', (f) => {
    const focal = (f.focal || '').trim();
    const style = focal && focal !== '50% 50%' ? ` style="object-position:${focal}"` : '';
    return `<img src="${encAttr(f.image)}" alt="${encAttr(f.alt || '')}"${style}>`;
  });

  // The JSON-LD block. What every project shares is stated here once; the rest
  // comes from the content file.
  eleventyConfig.addFilter('schema', (p) => {
    const d = {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: p.card.name,
      description: p.schema.description,
      creator: {
        '@type': 'Organization',
        name: 'Auerbach Architecture',
        url: 'https://auerbacharchitecture.com',
      },
      locationCreated: p.schema.locationCreated,
      about: p.schema.about,
      url: 'https://auerbacharchitecture.com/' + p.page,
    };
    for (const k of ['size', 'award', 'material']) {
      if (p.schema[k] !== undefined) d[k] = p.schema[k];
    }
    return JSON.stringify(d, null, 2).replace(/</g, '\\u003c');
  });

  for (const f of ['CNAME', 'images', 'styles.css', 'sitemap.xml', 'data/annotations.js',
    'data/journal.js', 'annotate.js', 'filters.js', 'journal.js', 'map.js',
    'nav.js', 'slideshow.js']) {
    eleventyConfig.addPassthroughCopy(f);
  }
  // The bespoke pages, copied as they stand. Listed by subtraction rather
  // than by glob: a glob would also copy a project page still sitting in the
  // repository and race with the generated one of the same name.
  const fs = require('node:fs');
  const generated = new Set(fs.readdirSync('content/projects')
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync('content/projects/' + f, 'utf8')).page));
  generated.add('index.html');   // src/index.njk builds the home page
  for (const f of fs.readdirSync('.').filter((f) => f.endsWith('.html'))) {
    if (!generated.has(f)) eleventyConfig.addPassthroughCopy(f);
  }

  return {
    dir: { input: '.', output: '_site', includes: 'src/_includes', data: 'src/_data' },
  };
};
