#!/usr/bin/env node
/* The home-page project filters, in a browser.
 *
 *     npm run build && npm run filters:test
 *
 * Written when Martha's Vineyard cards were taught to answer to Massachusetts
 * as well. The filters had no test at all until then: the chips, the counts,
 * the shareable URL and the deep link were only ever checked by looking at
 * them, which is no way to notice that a region stopped matching.
 *
 * It serves the built _site rather than a fixture, so what is tested is what
 * would be published.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..', '_site');
const TYPE = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
               '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png',
               '.webp': 'image/webp', '.svg': 'image/svg+xml' };

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) { pass++; console.log(`  ok    ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
};

/* Playwright finds its own browser on a normal machine. This container keeps
   one at a fixed path instead, so use that only when it is really there —
   hardcoding it made this suite unrunnable anywhere else. */
const launch = () => {
  const inContainer = '/opt/pw-browsers/chromium';
  return chromium.launch(fs.existsSync(inContainer) ? { executablePath: inContainer } : {});
};

(async () => {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
    console.error('no _site/index.html — run: npm run build');
    process.exit(1);
  }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('not found');
    }
    res.writeHead(200, { 'content-type': TYPE[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  const shown = () => page.$$eval('.project-grid .project-card:not(.is-hidden)',
    (els) => els.map((e) => e.getAttribute('href')));
  const chip = (group, value) => page.click(`.filter-chip[data-group="${group}"][data-value="${value}"]`);
  const openFilters = async () => {
    if (await page.$eval('.filter-bar', (b) => b.hidden)) await page.click('.filter-toggle');
  };

  await page.goto(base + '/index.html', { waitUntil: 'networkidle' });

  const all = await shown();
  ok('every card shows before filtering', all.length === 14, `${all.length} cards`);
  ok('the chips start closed', await page.$eval('.filter-bar', (b) => b.hidden));

  /* The change this file was written for. */
  await openFilters();
  await chip('region', 'massachusetts');
  const mass = await shown();
  ok('Massachusetts includes the Vineyard projects', mass.length === 9, `${mass.length} cards`);
  ok('  …Pond House among them (Chappaquiddick)', mass.includes('pond-house.html'));
  ok('  …and Carriage House (Brookline, mainland)', mass.includes('carriage-house.html'));
  ok('  …but not Colony Lane (Maine)', !mass.includes('colony-lane.html'));
  ok('  …nor White Feather (California)', !mass.includes('white-feather.html'));
  ok('the count reads what is on screen',
    (await page.textContent('.filter-count')).trim() === '9 projects',
    (await page.textContent('.filter-count')).trim());

  await chip('region', 'vineyard');
  const mv = await shown();
  ok('Martha\'s Vineyard stays the island alone', mv.length === 7, `${mv.length} cards`);
  ok('  …Carriage House is not on the island', !mv.includes('carriage-house.html'));
  ok('Massachusetts is the wider of the two', mass.length > mv.length && mv.every((p) => mass.includes(p)));

  /* Region and type still combine. */
  await chip('region', 'massachusetts');
  await chip('type', 'preservation');
  const both = await shown();
  ok('region and type narrow together', both.length === 1 && both[0] === 'carriage-house.html',
    both.join(', ') || 'nothing');
  ok('the toggle says how many groups are set',
    (await page.textContent('.filter-toggle')).includes('2'),
    await page.textContent('.filter-toggle'));

  /* The URL is the shareable part. */
  ok('the address bar carries the selection',
    page.url().includes('region=massachusetts') && page.url().includes('type=preservation'),
    page.url().replace(base, ''));

  await page.click('.filter-reset');
  ok('reset shows everything again', (await shown()).length === 14);
  ok('reset clears the query string', !page.url().includes('region='), page.url().replace(base, ''));

  /* Arriving on a shared link. */
  await page.goto(base + '/index.html?region=massachusetts', { waitUntil: 'networkidle' });
  ok('a shared Massachusetts link opens filtered', (await shown()).length === 9);
  ok('  …and opens the chips, so the short grid is explained',
    !(await page.$eval('.filter-bar', (b) => b.hidden)));
  ok('  …with the chip lit',
    await page.$eval('.filter-chip[data-group="region"][data-value="massachusetts"]',
      (c) => c.classList.contains('active')));

  /* A region nobody has heard of must not silently filter everything away. */
  await page.goto(base + '/index.html?region=narnia', { waitUntil: 'networkidle' });
  ok('an unknown region is ignored, not obeyed', (await shown()).length === 14);
  ok('  …and is dropped from the address bar', !page.url().includes('narnia'),
    page.url().replace(base, ''));

  await browser.close();
  server.close();
  console.log(`\n${pass + fail} checks, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
