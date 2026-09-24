#!/usr/bin/env node
/* The project map, in a browser.
 *
 *     npm run build && npm run map:test
 *
 * Written when the names printed on top of each other: at the Northeast zoom
 * the page opens with, seven Vineyard projects sat within a few pixels and
 * their labels came out as one smudge. The map had no test at all, so nothing
 * would have said so.
 *
 * The real assertion is geometric — no two visible labels may share pixels —
 * because that is the actual requirement, and any other check (a class, a
 * count) can pass while the map still looks wrong.
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

const launch = () => {
  const inContainer = '/opt/pw-browsers/chromium';
  return chromium.launch(fs.existsSync(inContainer) ? { executablePath: inContainer } : {});
};

/* Every label the eye can actually see, with where it sits.

   Bounded to the map's own box: Leaflet keeps a marker in the DOM when it
   scrolls out of view and clips it, so an unbounded query counts names nobody
   can see — it reported all fifteen on the Vineyard view, where only seven are
   on screen. */
const VISIBLE = `(() => {
  const m = document.getElementById('project-map').getBoundingClientRect();
  return Array.from(document.querySelectorAll('.aa-marker-label'))
    .filter((l) => getComputedStyle(l).visibility !== 'hidden' && l.offsetParent !== null)
    .map((l) => { const r = l.getBoundingClientRect();
      return { name: l.textContent.trim(), l: r.left, t: r.top, r: r.right, b: r.bottom }; })
    .filter((r) => r.l < m.right && r.r > m.left && r.t < m.bottom && r.b > m.top);
})()`;

const OFFICES = ['Lincoln office', 'Vineyard office'];

const overlaps = (boxes) => {
  const hits = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t) hits.push(`${a.name} × ${b.name}`);
    }
  }
  return hits;
};

(async () => {
  if (!fs.existsSync(path.join(ROOT, 'map.html'))) {
    console.error('no _site/map.html — run: npm run build');
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  /* Load the map with data/projects.js altered by `edit` — how the checks for
     hostile text and for a project outside the Northeast get a project that
     the real content does not have. */
  const withData = async (edit) => {
    const p2 = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await p2.route('**/data/projects.js', async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: (await res.text()) + '\n' + edit });
    });
    await p2.goto(base + '/map.html', { waitUntil: 'networkidle' });
    await p2.waitForTimeout(2000);
    return p2;
  };
  const boxes = () => page.evaluate(VISIBLE);
  const view = async (name) => {
    await page.click(`.map-view[data-view="${name}"]`);
    await page.waitForTimeout(1200);
  };

  await page.goto(base + '/map.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const dots = await page.$$eval('.aa-marker-wrap', (e) => e.length);
  ok('every project with coordinates has a marker', dots === 15, `${dots} markers`);

  for (const v of ['northeast', 'vineyard', 'all']) {
    if (v !== 'northeast') await view(v);
    const b = await boxes();
    const hits = overlaps(b);
    ok(`${v}: no two names share pixels`, hits.length === 0,
      hits.length ? hits.join('; ') : `${b.length} names shown`);
  }

  /* Hiding a name must never hide the project. Counted over project names
     only: office names are placed first and are a separate question. */
  await view('northeast');
  const projectNames = async () => (await boxes()).filter((b) => !OFFICES.includes(b.name)).length;
  const shownNames = await projectNames();
  ok('some project names are held back when crowded', shownNames < 15, `${shownNames} of 15 shown`);
  const stillDots = await page.$$eval('.aa-marker-wrap .aa-marker', (e) => e.length);
  ok('  …but every dot is still on the map', stillDots === 15, `${stillDots} dots`);

  /* Zooming into the cluster is what gets the held-back names back. The
     island names are the ones suppressed at Northeast zoom, so they are what
     the Vineyard view has to restore. Zooming with the + control instead would
     zoom toward the centre of the Northeast view, which is open ocean, and
     prove nothing. */
  const island = await page.evaluate(
    `AA.projects.filter((p) => p.region === 'vineyard' && p.lat).map((p) => p.name)`);
  const islandShown = async () => (await boxes()).filter((b) => island.includes(b.name)).length;

  await view('northeast');
  const farOff = await islandShown();
  ok('  …and it is the island cluster that gets thinned', farOff < island.length,
    `${farOff} of ${island.length} island names at Northeast zoom`);
  await view('vineyard');
  const closeUp = await islandShown();
  ok('the island names come back when you zoom to the island',
    closeUp > farOff, `${farOff} → ${closeUp} of ${island.length}`);
  ok('  …all of them, once there is room', closeUp === island.length,
    `${closeUp} of ${island.length}`);
  ok('  …and they still do not collide', overlaps(await boxes()).length === 0,
    overlaps(await boxes()).join('; ') || 'clear');

  /* A dot with no name is still a project you can open. */
  await view('northeast');
  const hidden = await page.evaluate(`Array.from(document.querySelectorAll('.aa-marker-label'))
    .filter((l) => getComputedStyle(l).visibility === 'hidden').length`);
  ok('crowded names are hidden, not deleted', hidden > 0, `${hidden} held back`);
  await page.click('.aa-marker-wrap');
  await page.waitForTimeout(600);
  ok('clicking a marker still opens its popup',
    await page.$eval('.aa-popup', (e) => !!e).catch(() => false));

  /* The offices. */
  await page.goto(base + '/map.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const squares = await page.$$eval('.aa-office-wrap .aa-office', (e) => e.length);
  ok('both offices are on the map', squares === 2, `${squares} office markers`);
  ok('  …drawn as squares, not project dots',
    await page.$eval('.aa-office-wrap .aa-office', (e) => getComputedStyle(e).borderRadius === '0px'));
  const officeNames = (await boxes()).filter((b) => OFFICES.includes(b.name)).map((b) => b.name);
  ok('  …and named in the default view', officeNames.length === 2, officeNames.join(', ') || 'neither');
  await view('vineyard');
  ok('the Vineyard office is on the island view',
    (await boxes()).some((b) => b.name === 'Vineyard office'));
  ok('the legend has an entry for offices',
    await page.$eval('.map-legend', (e) => /office/i.test(e.textContent)));

  const firstGroup = await page.$eval('.map-list-region .label', (e) => e.textContent.trim());
  ok('the list starts with the offices', firstGroup === 'Offices', firstGroup);
  await page.click('.map-list-item[data-slug="office:lincoln"]');
  await page.waitForTimeout(1600);
  const popup = await page.$eval('.leaflet-popup-content', (e) => e.textContent).catch(() => '');
  ok('choosing the Lincoln office opens its address', /25 Lincoln Road/.test(popup),
    popup.replace(/\s+/g, ' ').trim().slice(0, 80));

  /* Every list entry has a marker behind it, so none is a dead button. */
  const counts = await page.evaluate(() => ({
    listed: document.querySelectorAll('.map-list-item').length,
    marked: document.querySelectorAll('.aa-marker-wrap, .aa-office-wrap').length,
  }));
  ok('every list entry has a marker behind it', counts.listed === counts.marked,
    `${counts.listed} entries, ${counts.marked} markers`);

  /* Text from the content files is text, never markup. */
  const hostile = await withData(
    'AA.projects[0].tagline = ' + JSON.stringify('Quote " and <b id="injected">bold</b> & more') + ';' +
    'AA.projects[0].alt = ' + JSON.stringify('A "quoted" alt') + ';');
  const firstSlug = await hostile.evaluate(() => AA.projects[0].slug);
  await hostile.click(`.map-list-item[data-slug="${firstSlug}"]`);
  await hostile.waitForTimeout(1600);
  const shown = await hostile.evaluate(() => ({
    injected: !!document.getElementById('injected'),
    text: (document.querySelector('.leaflet-popup-content') || {}).textContent || '',
    alt: ((document.querySelector('.leaflet-popup-content img') || {}).alt) || '',
  }));
  ok('a tagline with markup in it is shown as text, not run as markup',
    !shown.injected && shown.text.includes('<b id="injected">bold</b> & more'),
    shown.injected ? 'the <b> became an element' : 'text intact');
  ok('  …and a quote in the alt text does not break the image tag', shown.alt === 'A "quoted" alt',
    JSON.stringify(shown.alt));
  await hostile.close();

  /* Northeast is the regions it names, not "everything but California". A
     project in Montana must leave the Northeast view where it was; under the
     old rule the map zoomed out to take it in. Exercises map.js itself — a
     test that restated the rule would pass whatever map.js said. */
  const west = await withData('AA.projects.push(' + JSON.stringify({
    slug: 'probe-montana', name: 'Montana probe', page: '#', location: 'Big Sky, Montana',
    region: 'montana', lat: 45.28, lng: -111.4, status: 'design', types: [], image: null, alt: '', tagline: '',
  }) + ');');
  const probe = await west.evaluate(() => {
    const m = document.getElementById('project-map').getBoundingClientRect();
    const icon = [...document.querySelectorAll('.aa-marker-wrap')]
      .find((i) => i.textContent.includes('Montana probe'));
    if (!icon) return 'no marker';
    const r = icon.getBoundingClientRect();
    return r.left < m.right && r.right > m.left && r.top < m.bottom && r.bottom > m.top ? 'in view' : 'out of view';
  });
  ok('the Northeast view leaves out a project outside the regions it names', probe === 'out of view', probe);
  await west.close();

  await browser.close();
  server.close();
  console.log(`\n${pass + fail} checks, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
