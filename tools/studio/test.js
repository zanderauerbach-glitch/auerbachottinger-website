#!/usr/bin/env node
/* Drives the studio in a real browser and checks the round trip.
 *
 *     npm run studio:test
 *
 * It edits a real content file — there is no point testing against a fake one
 * — and puts it back afterwards, whether it passes or not.
 */
const { chromium } = require('playwright');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const tagsLib = require('./lib/tags');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 4123;
const B = `http://127.0.0.1:${PORT}`;
const SUBJECT = path.join(ROOT, 'content', 'projects', 'tisbury.json');
const REVIEW = path.join(__dirname, 'review', 'pennywise-path.json');
const before = fs.readFileSync(SUBJECT, 'utf8');
// The library checks run against the real review notes and the resized photo
// copies. Neither is committed here (this repository is public), so without
// them there is nothing honest to test against.
for (const need of [REVIEW, path.join(ROOT, 'tools/review/build/copies/pennywise-path')]) {
  if (!fs.existsSync(need)) {
    console.error(`studio:test needs ${path.relative(ROOT, need)}, which is not committed here.\n` +
      'Copy tools/studio/review/ (from the archived staging repository) and tools/review/build/copies/ from a machine that has them.');
    process.exit(1);
  }
}
const reviewBefore = fs.readFileSync(REVIEW, 'utf8');
const otherReview = path.join(__dirname, 'review', 'calebs-pond.json');
const otherBefore = fs.readFileSync(otherReview, 'utf8');
const PW = path.join(ROOT, 'content', 'projects', 'pennywise-path.json');
const pwBefore = fs.readFileSync(PW, 'utf8');
const written = [];   // image files the test creates, deleted again at the end

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    cwd: ROOT, env: { ...process.env, STUDIO_PORT: String(PORT) }, stdio: 'ignore',
  });
  let browser;
  try {
    for (let i = 0; i < 60; i++) {
      try { await fetch(`${B}/api/state`); break; } catch { await wait(500); }
    }

    // Playwright finds its own browser on a normal machine; this container
    // keeps one at a fixed path. Hardcoding it made this unrunnable on a Mac.
    const inContainer = '/opt/pw-browsers/chromium';
    browser = await chromium.launch(fs.existsSync(inContainer) ? { executablePath: inContainer } : {});
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

    await page.goto(B, { waitUntil: 'networkidle' });
    await page.selectOption('#pick', 'tisbury');
    await wait(500);

    check('every project is listed', await page.locator('#pick option').count() === 16);
    check('the words load', (await page.locator('#form input').first().inputValue())
      .startsWith('A lookout over the north shore'));

    const NEW = 'A heading typed in the studio.';
    await page.fill('#form input', NEW);
    await page.waitForSelector('#saved:not([hidden])', { timeout: 20000 });
    await wait(1200);

    const onDisk = JSON.parse(fs.readFileSync(SUBJECT, 'utf8')).page_content.heading;
    check('the edit reaches the content file', onDisk === NEW, onDisk);

    const built = fs.readFileSync(path.join(ROOT, '_site', 'tisbury.html'), 'utf8');
    check('the site is rebuilt', built.includes(NEW));

    const inFrame = await page.frameLocator('#frame').locator('.project-description h2').textContent();
    check('the preview shows the real page', inFrame === NEW, inFrame);

    // a paragraph added and taken away again leaves no trace
    const n0 = await page.locator('.block').count();
    await page.click('text=Add a paragraph');
    await wait(300);
    const n1 = await page.locator('.block').count();
    await page.locator('.block').last().locator('text=Remove').click();
    await wait(1400);
    check('paragraphs can be added and removed', n1 === n0 + 1 && await page.locator('.block').count() === n0);

    // the gallery is not in this phase, and must come through untouched
    const doc = JSON.parse(fs.readFileSync(SUBJECT, 'utf8'));
    const was = JSON.parse(before);
    check('the gallery is left alone',
      JSON.stringify(doc.page_content.gallery) === JSON.stringify(was.page_content.gallery));
    check('slug, page and order are left alone',
      doc.slug === was.slug && doc.page === was.page && doc.order === was.order);

    // coordinates are rounded to the town, never the house
    await page.fill('#form input[type=text]:below(:text("Latitude"))', '').catch(() => {});
    const latBox = page.locator('label:has(span:text-is("Latitude")) input');
    await latBox.fill('41.4412345');
    await wait(1800);
    const lat = JSON.parse(fs.readFileSync(SUBJECT, 'utf8')).card.lat;
    check('coordinates are rounded to four decimals', lat === 41.4412, String(lat));

    check('no console errors', errs.length === 0, errs.join(' | '));

    const traversal = await fetch(`${B}/preview/../../CLAUDE.md`);
    check('the preview cannot serve files outside _site', traversal.status === 404);

    /* ---- the photo library ---- */
    await page.selectOption('#pick', 'pennywise-path');
    await wait(1800);
    check('the library tabs appear for a project that has one',
      !(await page.locator('#tab-lib').isHidden()));

    await page.click('#tab-lib');
    await wait(2500);
    const tiles = await page.locator('.shot').count();
    const held = JSON.parse(reviewBefore);
    const starredOnDisk = Object.values(held.marks).filter((m) => m.stars).length;
    check('every photograph in the library is shown', tiles === 256, String(tiles));
    check("Zander's stars survived the migration",
      (await page.locator('.shot .stars button.lit').count()) > 0 && starredOnDisk === 29,
      `${starredOnDisk} starred on disk`);

    const thumb = await fetch(`${B}/api/thumb/pennywise-path/Interior_071A1689`);
    const thumbBytes = (await thumb.arrayBuffer()).byteLength;
    check('thumbnails are served',
      thumb.status === 200 && thumb.headers.get('content-type') === 'image/jpeg' &&
      thumbBytes > 5000 && Number(thumb.headers.get('content-length')) === thumbBytes,
      `${thumbBytes} bytes`);

    await page.click('#onlystars');
    await wait(900);
    check('the starred filter works', (await page.locator('.shot').count()) === starredOnDisk);

    // star something unstarred, then put it back
    await page.click('#onlystars');
    await wait(900);
    const victim = 'Drone_DJI_0054';
    const card = page.locator('.shot', { has: page.locator(`.shotid:text-is("${victim}")`) });
    await card.locator('.stars button').nth(3).click();
    await wait(1200);
    const afterStar = JSON.parse(fs.readFileSync(REVIEW, 'utf8'));
    check('a star reaches the review file', afterStar.marks[victim]?.stars === 4,
      JSON.stringify(afterStar.marks[victim]));
    await card.locator('.stars button').nth(3).click();
    await wait(1200);
    const afterUnstar = JSON.parse(fs.readFileSync(REVIEW, 'utf8'));
    check('unstarring removes the mark entirely', !(victim in afterUnstar.marks));
    check('the marks are otherwise unchanged',
      JSON.stringify(afterUnstar.marks) === JSON.stringify(held.marks));
    check('another project\'s review file is untouched',
      fs.readFileSync(otherReview, 'utf8') === otherBefore);

    /* ---- the draft layout ---- */
    await page.click('#tab-draft');
    await wait(1500);
    check('the draft layout shows the hero and seven frames',
      (await page.locator('.slot').count()) === 8);
    const firstSelect = page.locator('#draft select').first();
    await firstSelect.selectOption('Drone_DJI_0072');
    await wait(1200);
    const laidOut = JSON.parse(fs.readFileSync(REVIEW, 'utf8'));
    check('the layout reaches the review file', laidOut.layout.hero === 'Drone_DJI_0072');
    await firstSelect.selectOption(held.layout.hero);
    await wait(1200);
    check('the layout goes back',
      JSON.parse(fs.readFileSync(REVIEW, 'utf8')).layout.hero === held.layout.hero);

    /* ---- photographs on the page ---- */
    await page.click('#tab-photos');
    await wait(1500);
    check('the photographs tab shows the banner and every frame',
      (await page.locator('.frame').count()) === 8);

    // Place into a new frame so nothing that is already on the site is
    // overwritten. The file it writes is deleted again below.
    const placed = await (await fetch(`${B}/api/place/pennywise-path`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: 'Interior_071A1689', target: 'new', alt: 'A test frame',
        // This machine only has the 1400px copies, so filling a 1600px frame
        // means enlarging. The guard is checked on its own below.
        allowUpscale: true }),
    })).json();
    written.push(path.join(ROOT, placed.written.path));
    check('a 4:3 frame is written at 1600×1200',
      placed.written.width === 1600 && placed.written.height === 1200,
      `${placed.written.width}×${placed.written.height}, ${Math.round(placed.written.bytes / 1024)}KB`);
    check('the file is really there', fs.existsSync(path.join(ROOT, placed.written.path)));
    const gal = JSON.parse(fs.readFileSync(PW, 'utf8')).page_content.gallery;
    check('the gallery entry is written',
      gal[gal.length - 1].image === placed.written.path && gal[gal.length - 1].alt === 'A test frame');
    check('the page is rebuilt with it',
      fs.readFileSync(path.join(ROOT, '_site', 'pennywise-path.html'), 'utf8')
        .includes(placed.written.path));
    check('it took a free number rather than overwriting a frame',
      !/pennywise-path-0[1-7]\.jpg$/.test(placed.written.path), placed.written.path);

    // a full-width frame is a different shape, cut from the same photograph
    const wide = await (await fetch(`${B}/api/place/pennywise-path`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: 'Interior_071A1689', target: 0,
        crop: { x: 0, y: 0.2, w: 1, h: 0.4 }, allowUpscale: true }),
    })).json();
    check('a full-width frame is written at 1800×788',
      wide.written.width === 1800 && wide.written.height === 788,
      `${wide.written.width}×${wide.written.height}`);
    check('replacing a frame keeps its filename',
      wide.written.path === 'images/projects/pennywise-path-01.jpg', wide.written.path);
    check('the crop is honoured', wide.written.crop.y > 0 && wide.written.crop.h < wide.written.source.height,
      JSON.stringify(wide.written.crop));

    const soft = await (await fetch(`${B}/api/place/pennywise-path`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: 'Interior_071A1689', target: 'new' }),
    })).json();
    check('enlarging a photograph to fill a frame is refused',
      !!soft.error && /soft picture/.test(soft.error), soft.error);

    /* ---- finding the library rather than being told where it is ---- */
    const fake = path.join(os.tmpdir(), 'studio-find-test');
    fs.rmSync(fake, { recursive: true, force: true });
    const deep = path.join(fake, 'Library', 'CloudStorage', 'Dropbox', 'Auerbach x Arlin',
      'Projects', 'Marthas Vineyard', 'Pennywise Path', '2026.08.31 Site Visit', 'Photos', 'Drone');
    fs.mkdirSync(deep, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'tools/review/build/copies/pennywise-path/Drone_DJI_0068.jpg'),
      path.join(deep, 'DJI_0068.jpg'));
    const found = JSON.parse(execFileSync(process.execPath, ['-e', `
      const l = require(${JSON.stringify(path.join(__dirname, 'lib', 'library.js'))});
      const fs = require('fs');
      const rev = JSON.parse(fs.readFileSync(${JSON.stringify(path.join(__dirname, 'review', 'pennywise-path.json'))}, 'utf8'));
      const s = l.sourceFor('pennywise-path', rev);
      l.listPhotos(s).then((p) => console.log(JSON.stringify({ kind: s.kind, ids: p.map((x) => x.id) })));
    `], { env: { ...process.env, HOME: fake }, encoding: 'utf8' }));
    check('a Dropbox folder is found by name, not by a path written down',
      found.kind === 'library' && found.ids.join() === 'Drone_DJI_0068',
      `${found.kind}: ${found.ids.join(', ')}`);
    fs.rmSync(fake, { recursive: true, force: true });

    /* ---- the width toggle, from the tab it lives on ---- */
    await page.click('#tab-photos');
    await wait(1200);
    const widthBtn = page.locator('.frame').nth(1).locator('.ftools button', { hasText: 'Full width' });
    const classesNow = () => JSON.parse(fs.readFileSync(PW, 'utf8')).page_content.gallery[0].classes;
    const wasWide = classesNow();
    await widthBtn.click();
    await wait(1400);
    const flipped = classesNow();
    await widthBtn.click();
    await wait(1400);
    const backAgain = classesNow();
    check('the width toggle flips rather than accumulating',
      flipped !== wasWide && backAgain === wasWide,
      `${JSON.stringify(wasWide)} → ${JSON.stringify(flipped)} → ${JSON.stringify(backAgain)}`);

    // whatever the browser sends, a class cannot be stored twice
    const dup = await (await fetch(`${B}/api/project/pennywise-path`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ page_content: { gallery:
        JSON.parse(fs.readFileSync(PW, 'utf8')).page_content.gallery
          .map((g, i) => (i === 0 ? { ...g, classes: 'wide wide  wide' } : g)) } }),
    })).json();
    check('a duplicated class is refused storage', classesNow() === 'wide',
      JSON.stringify(classesNow()));

    /* ---- noticing a library nobody has claimed ---- */
    const scanHome = path.join(os.tmpdir(), 'studio-scan-test');
    fs.rmSync(scanHome, { recursive: true, force: true });
    const base = path.join(scanHome, 'Library', 'CloudStorage', 'Dropbox',
      'Auerbach x Arlin', 'Projects', 'Marthas Vineyard');
    for (const proj of ['Pennywise Path', 'Jericho Path']) {
      const dir = path.join(base, proj, '2026.08.31 Site Visit', 'Photos', 'Drone');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'DJI_0001.jpg'), '');
    }
    const scan = execFileSync(process.execPath, [path.join(__dirname, 'scan.js')],
      { cwd: ROOT, env: { ...process.env, HOME: scanHome }, encoding: 'utf8' });
    check('a declared library is matched to its project',
      /Pennywise Path \(pennywise-path\)/.test(scan));
    check('a library no project claims is reported, not ignored',
      /Jericho Path/.test(scan) && /no project claims it/.test(scan));
    check('a project whose library is elsewhere is listed as such',
      /declared but not on this machine/.test(scan) && /calebs-pond/.test(scan));
    fs.rmSync(scanHome, { recursive: true, force: true });

    /* ---- Finder tags ---- */
    // The reader used to report failure whenever the last file in a folder
    // carried no tag, because a while loop's exit status is its last
    // command's. This reproduces that exactly: no xattr here, so every test
    // is false and the loop ends on one.
    const tagDir = path.join(os.tmpdir(), 'studio-tag-exit');
    fs.rmSync(tagDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(tagDir, 'Drone'), { recursive: true });
    fs.writeFileSync(path.join(tagDir, 'Drone', 'a.jpg'), '');
    let tagExit = 0;
    try {
      execFileSync('bash', ['-c', tagsLib.SCRIPT, 'tags', tagDir], { stdio: 'pipe' });
    } catch (e) { tagExit = e.status; }
    check('reading tags succeeds even when the last file has none', tagExit === 0,
      tagExit === 0 ? '' : `exited ${tagExit}`);
    fs.rmSync(tagDir, { recursive: true, force: true });

    const tagLines = [
      '/lib/Drone/DJI_0002.jpg\t["Red\\n6"]',
      '/lib/Drone/DJI_0010.jpg\t["Yellow\\n5"]',
      '/lib/Guest House/IMG_1.jpg\t["Red\\n6","Important\\n0"]',
      '/lib/Interior/071A1478.jpg\t[]',
      'a line with no tab at all',
    ].join('\n');
    const parsed = tagsLib.parse(tagLines);
    check('Finder tags are read, and an untagged or malformed line is dropped',
      parsed.length === 3, `${parsed.length} of 5 lines`);
    check('red is a select and yellow a maybe',
      parsed[0].stars === 5 && parsed[1].stars === 3,
      `${parsed[0].colours} → ${parsed[0].stars}, ${parsed[1].colours} → ${parsed[1].stars}`);
    check('a tagged file maps to the id the marks already use',
      tagsLib.idFor('/lib', parsed[0].file) === 'Drone_DJI_0002' &&
      tagsLib.idFor('/lib', parsed[2].file) === 'Guest-House_IMG_1',
      tagsLib.idFor('/lib', parsed[2].file));

    const missing = await (await fetch(`${B}/api/place/pennywise-path`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: 'Nope_1234', target: 'new' }),
    })).json();
    check('an unknown photograph is refused', !!missing.error, missing.error);
  } finally {
    fs.writeFileSync(SUBJECT, before, 'utf8');
    fs.writeFileSync(REVIEW, reviewBefore, 'utf8');
    fs.writeFileSync(PW, pwBefore, 'utf8');
    for (const f of written) { try { fs.unlinkSync(f); } catch { /* never made */ } }
    // Any site image the test overwrote comes back from git, not from memory.
    try { execFileSync('git', ['checkout', '--', 'images/projects'], { cwd: ROOT, stdio: 'ignore' }); } catch { /* nothing to undo */ }
    fs.writeFileSync(otherReview, otherBefore, 'utf8');
    try { execFileSync('npx', ['@11ty/eleventy'], { cwd: ROOT, stdio: 'ignore' }); } catch { /* reported below */ }
    if (browser) await browser.close();
    server.kill();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length} checks, ${failed.length} failed`);
  process.exit(failed.length ? 1 : 0);
})();
