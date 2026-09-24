/* The studio's browser side.
 *
 * Edits are saved as you make them: a change waits three quarters of a second
 * for you to stop typing, then goes to the server, which writes the content
 * file, rebuilds the site and hands back what changed. The preview then shows
 * the real page, not an approximation of it.
 */
const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'text') n.textContent = v;
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const kid of [].concat(kids)) if (kid) n.appendChild(kid);
  return n;
};

let STATE = { projects: [], taxonomy: {}, git: {} };
let current = null;          // the project being edited, as a working copy
let pending = null;          // debounce handle

const toast = (msg, bad = false) => {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('bad', bad);
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, bad ? 9000 : 2200);
};

const api = async (url, opts) => {
  const r = await fetch(url, opts);
  const body = await r.json().catch(() => ({ error: `${r.status}` }));
  if (!r.ok) throw new Error(body.error || `${r.status}`);
  return body;
};

/* ------------------------------------------------------------------ state */

function paintGit(g) {
  STATE.git = g;
  const n = g.files.length;
  $('#gitstate').innerHTML = `on <b>${g.branch}</b> · ` +
    (n ? `<b>${n}</b> file${n === 1 ? '' : 's'} changed` : 'nothing to commit') +
    (g.ahead ? ` · <b>${g.ahead}</b> to push` : '') +
    (g.behind ? ` · <b>${g.behind}</b> behind the remote` : '');
  $('#commit').disabled = n === 0;
  $('#push').disabled = !g.ahead;
}

async function load() {
  STATE = await api('/api/state');
  const pick = $('#pick');
  pick.textContent = '';
  for (const p of STATE.projects) pick.appendChild(el('option', { value: p.slug, text: p.card.name }));
  const remembered = localStorage.getItem('studio-project');
  const slug = STATE.projects.some((p) => p.slug === remembered) ? remembered : STATE.projects[0].slug;
  pick.value = slug;
  paintGit(STATE.git);
  show(slug);
}

function show(slug) {
  localStorage.setItem('studio-project', slug);
  current = JSON.parse(JSON.stringify(STATE.projects.find((p) => p.slug === slug)));
  $('#livelink').href = '/preview/' + current.page;
  $('#previewpath').textContent = current.page;
  $('#frame').src = '/preview/' + current.page;
  render();
  loadLibrary(slug).then(() => {
    const want = localStorage.getItem('studio-tab') || 'words';
    tab(LIB || want === 'words' ? want : 'words');
  });
}

/* ------------------------------------------------------------------- form */

const field = (label, value, onInput, { area = false, type = 'text' } = {}) => {
  const input = area
    ? el('textarea', { rows: Math.max(3, Math.ceil((value || '').length / 68)) })
    : el('input', { type });
  input.value = value === null || value === undefined ? '' : value;
  input.addEventListener('input', () => onInput(input.value));
  return el('label', {}, [el('span', { text: label }), input]);
};

function render() {
  const f = $('#form');
  f.textContent = '';
  const c = current.card;
  const pc = current.page_content;

  f.appendChild(el('h2', { text: 'The page' }));
  f.appendChild(field('Heading', pc.heading, (v) => set(() => { pc.heading = v; })));

  for (const [i, b] of (pc.body || []).entries()) {
    const kind = el('select');
    for (const t of ['p', 'h3']) {
      kind.appendChild(el('option', { value: t, text: t === 'p' ? 'Paragraph' : 'Sub-heading', selected: b.tag === t }));
    }
    kind.value = b.tag;
    kind.addEventListener('change', () => set(() => { b.tag = kind.value; }));

    const up = el('button', { type: 'button', class: 'tiny', text: '↑', title: 'Move up' });
    const down = el('button', { type: 'button', class: 'tiny', text: '↓', title: 'Move down' });
    const del = el('button', { type: 'button', class: 'tiny', text: 'Remove' });
    up.disabled = i === 0;
    down.disabled = i === pc.body.length - 1;
    const move = (to) => set(() => { const [x] = pc.body.splice(i, 1); pc.body.splice(to, 0, x); }, true);
    up.onclick = () => move(i - 1);
    down.onclick = () => move(i + 1);
    del.onclick = () => set(() => { pc.body.splice(i, 1); }, true);

    const text = el('textarea', { rows: Math.max(3, Math.ceil((b.text || '').length / 68)) });
    text.value = b.text || '';
    text.addEventListener('input', () => set(() => { b.text = text.value; }));

    f.appendChild(el('div', { class: 'block' }, [
      el('div', { class: 'blockhead' }, [kind, el('span', { class: 'grow' }), up, down, del]),
      text,
    ]));
  }
  const add = el('button', { type: 'button', class: 'tiny', text: 'Add a paragraph' });
  add.onclick = () => set(() => { (pc.body = pc.body || []).push({ tag: 'p', style: '', text: '' }); }, true);
  f.appendChild(add);

  f.appendChild(el('h2', { text: 'Project details' }));
  for (const [i, row] of (pc.details || []).entries()) {
    const k = el('input'); k.value = row.key || '';
    const v = el('input'); v.value = row.value || '';
    k.addEventListener('input', () => set(() => { row.key = k.value; }));
    v.addEventListener('input', () => set(() => { row.value = v.value; }));
    const del = el('button', { type: 'button', class: 'tiny', text: 'Remove' });
    del.onclick = () => set(() => { pc.details.splice(i, 1); }, true);
    f.appendChild(el('div', { class: 'tri' }, [
      el('label', {}, [el('span', { text: i === 0 ? 'Label' : '' }), k]),
      el('label', {}, [el('span', { text: i === 0 ? 'Value' : '' }), v]),
      el('label', {}, [el('span', { text: '' }), del]),
    ]));
  }
  const addRow = el('button', { type: 'button', class: 'tiny', text: 'Add a detail' });
  addRow.onclick = () => set(() => { (pc.details = pc.details || []).push({ key: '', value: '', valueClasses: '' }); }, true);
  f.appendChild(addRow);

  f.appendChild(el('h2', { text: 'On the home page and the map' }));
  f.appendChild(field('Name', c.name, (v) => set(() => { c.name = v; })));
  f.appendChild(field('Location', c.location, (v) => set(() => { c.location = v; })));
  f.appendChild(field('Tagline', c.tagline, (v) => set(() => { c.tagline = v; })));

  const status = el('select');
  for (const [k, label] of Object.entries(STATE.taxonomy.STATUS)) {
    status.appendChild(el('option', { value: k, text: label }));
  }
  status.value = c.status;
  status.addEventListener('change', () => set(() => { c.status = status.value; }, true));
  f.appendChild(el('label', {}, [el('span', { text: 'Status' }), status]));

  const coords = el('div', { class: 'pair' }, [
    field('Latitude', c.lat, (v) => set(() => { c.lat = v === '' ? null : Number(v); })),
    field('Longitude', c.lng, (v) => set(() => { c.lng = v === '' ? null : Number(v); })),
  ]);
  f.appendChild(coords);
  f.appendChild(el('label', {}, [el('span', {
    text: 'Coordinates are the town, not the house — the map page is public. Four decimals is a village; six is a front door.',
  })]));

  f.appendChild(el('h2', { text: 'For search engines' }));
  f.appendChild(field('Page title', pc.title, (v) => set(() => { pc.title = v; })));
  f.appendChild(field('Search description', pc.metaDescription, (v) => set(() => { pc.metaDescription = v; }), { area: true }));
  f.appendChild(field('Structured-data description', current.schema.description,
    (v) => set(() => { current.schema.description = v; }), { area: true }));
}

/* ------------------------------------------------------------------- save */

/* Re-render whichever view is showing. This used to call the Words renderer
   whatever tab you were on, so a change made in Photographs mutated the data
   and left the buttons holding a stale idea of it — clicking Half/Full width
   twice appended "wide" twice, because each button remembered the width the
   frame had when it was drawn. */
const REDRAW = { words: () => render(), photos: () => renderPhotos(),
                 lib: () => renderLibrary(), draft: () => renderDraft() };

function set(mutate, rerender = false) {
  mutate();
  if (rerender) (REDRAW[activeTab] || render)();
  clearTimeout(pending);
  pending = setTimeout(save, 750);
}

async function save() {
  const slug = current.slug;
  try {
    const r = await api('/api/project/' + slug, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ card: current.card, page_content: current.page_content, schema: current.schema }),
    });
    if (!r.changed.length) return;
    if (!r.build.ok) return toast('Saved, but the site did not build:\n' + r.build.error, true);
    const saved = $('#saved');
    saved.hidden = false;
    setTimeout(() => { saved.hidden = true; }, 1400);
    const src = STATE.projects.find((p) => p.slug === slug);
    Object.assign(src.card, current.card);
    Object.assign(src.page_content, current.page_content);
    Object.assign(src.schema, current.schema);
    if (r.changed.includes('card.name')) {
      [...$('#pick').options].find((o) => o.value === slug).textContent = current.card.name;
    }
    paintGit(r.git);
    refresh();
  } catch (e) {
    toast('Could not save: ' + e.message, true);
  }
}

const refresh = () => { $('#frame').src = '/preview/' + current.page + '?t=' + Date.now(); };

/* ------------------------------------------------------------------ wires */

$('#pick').addEventListener('change', (e) => show(e.target.value));
$('#reload').addEventListener('click', refresh);
$('#commit').addEventListener('click', async () => {
  try {
    const { git } = await api('/api/commit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: $('#msg').value }),
    });
    $('#msg').value = '';
    paintGit(git);
    toast('Committed.');
  } catch (e) { toast(e.message, true); }
});
$('#push').addEventListener('click', async () => {
  const b = $('#push');
  if (b.disabled) return;
  b.disabled = true;                      // one push at a time; two race
  try {
    const { git } = await api('/api/push', { method: 'POST' });
    paintGit(git);
    toast('Pushed. The site updates a minute or two after it reaches master.');
  } catch (e) {
    toast(e.message, true);
  } finally {
    b.disabled = !STATE.git.ahead;
  }
});

load().catch((e) => toast('Could not start: ' + e.message, true));

/* ------------------------------------------------------- the photo library */

let LIB = null;               // {source, photos, marks, layout} for the project shown
let filter = { folder: 'all', starred: false };

const views = { words: '#view-words', photos: '#view-photos', lib: '#view-lib', draft: '#view-draft' };

let activeTab = 'words';

function tab(name) {
  activeTab = name;
  for (const [k, sel] of Object.entries(views)) {
    $(sel).hidden = k !== name;
    $('#tab-' + k).setAttribute('aria-selected', String(k === name));
  }
  localStorage.setItem('studio-tab', name);
  if (name === 'photos') renderPhotos();
  if (name === 'lib') renderLibrary();
  if (name === 'draft') renderDraft();
}

async function loadLibrary(slug) {
  LIB = null;
  $('#tab-lib').hidden = true;
  $('#tab-draft').hidden = true;
  try {
    const r = await api('/api/library/' + slug);
    LIB = r;
    filter = { folder: 'all', starred: false };
    const n = r.photos.length;
    // The tab appears even when the folder cannot be found, because a missing
    // folder is something to fix, and hiding it just leaves people guessing.
    $('#tab-lib').hidden = false;
    $('#tab-draft').hidden = n === 0;
    const starred = Object.values(r.marks).filter((m) => m.stars).length;
    $('#tab-lib').textContent = n ? `Review library (${n})` : 'Review library';
    $('#libsource').textContent = n
      ? `${n} photographs, ${starred} starred — ${r.source.label}`
      : r.source.label;
  } catch (e) { toast('Could not read the library: ' + e.message, true); }
}

const visible = () => (LIB ? LIB.photos.filter((p) =>
  (filter.folder === 'all' || p.folder === filter.folder) &&
  (!filter.starred || (LIB.marks[p.id] || {}).stars)) : []);

function renderLibrary() {
  if (!LIB) return;
  const chips = $('#libfolders');
  chips.textContent = '';
  for (const f of ['all', ...new Set(LIB.photos.map((p) => p.folder))]) {
    const b = el('button', { type: 'button', text: f === 'all' ? 'All' : f,
      'aria-pressed': String(filter.folder === f) });
    b.onclick = () => { filter.folder = f; renderLibrary(); };
    chips.appendChild(b);
  }
  $('#onlystars').setAttribute('aria-pressed', String(filter.starred));

  const grid = $('#grid');
  grid.textContent = '';

  // Nothing found: say where it looked, so the wrong path can be corrected.
  if (!LIB.photos.length) {
    const tried = el('div', { class: 'diag' }, [
      el('p', { text: LIB.source.label + '. It looked for:' }),
      el('ul', {}, (LIB.source.looked || []).map((x) =>
        el('li', { class: x.exists ? 'found' : '', text: x.path }))),
      el('p', { text: 'Fix the path in tools/studio/libraries.json, or start the studio with '
        + 'STUDIO_LIBRARY=/path/to/the/folder, then reload.' }),
    ]);
    grid.appendChild(tried);
    return;
  }

  for (const photo of visible()) {
    const mark = LIB.marks[photo.id] || { stars: 0, note: '' };
    const img = el('img', { loading: 'lazy', alt: photo.id,
      src: `/api/thumb/${current.slug}/${encodeURIComponent(photo.id)}` });

    const stars = el('div', { class: 'stars' });
    for (let n = 1; n <= 5; n++) {
      const s = el('button', { type: 'button', text: '★', title: `${n} star${n === 1 ? '' : 's'}`,
        class: n <= (mark.stars || 0) ? 'lit' : '' });
      s.onclick = () => setMark(photo.id, { stars: mark.stars === n ? 0 : n });
      stars.appendChild(s);
    }
    const note = el('textarea', { placeholder: 'Note', rows: 1 });
    note.value = mark.note || '';
    let t;
    note.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => setMark(photo.id, { note: note.value }, false), 700);
    });

    grid.appendChild(el('div', { class: 'shot' + (mark.stars ? ' on' : '') }, [
      img,
      el('div', { class: 'shotfoot' }, [el('span', { class: 'shotid', text: photo.id }), stars]),
      note,
    ]));
  }
  if (!grid.children.length) {
    grid.appendChild(el('p', { class: 'saved', text: 'Nothing matches that filter.' }));
  }
}

async function setMark(id, patch, rerender = true) {
  try {
    const r = await api(`/api/mark/${current.slug}/${encodeURIComponent(id)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch),
    });
    LIB.marks = r.marks;
    paintGit(r.git);
    const starred = Object.values(LIB.marks).filter((m) => m.stars).length;
    $('#libsource').textContent =
      `${LIB.photos.length} photographs, ${starred} starred — ${LIB.source.label}`;
    if (rerender) renderLibrary();
  } catch (e) { toast('Could not save that mark: ' + e.message, true); }
}

$('#onlystars').addEventListener('click', () => { filter.starred = !filter.starred; renderLibrary(); });

/* --------------------------------------------------------- the draft layout */

const DEFAULT_LAYOUT = () => ({
  hero: null,
  slots: [true, false, false, true, false, false, true].map((wide) => ({ kind: 'photo', id: null, wide })),
});

function renderDraft() {
  if (!LIB) return;
  const layout = LIB.layout || (LIB.layout = DEFAULT_LAYOUT());
  const starred = LIB.photos.filter((p) => (LIB.marks[p.id] || {}).stars);
  $('#drafthint').textContent = starred.length
    ? `${starred.length} starred photographs to choose from. This is the page as it would be, not as it is.`
    : 'Star some photographs in the review library first — they are what this offers.';

  const chooser = (value, onPick) => {
    const sel = el('select');
    sel.appendChild(el('option', { value: '', text: '—' }));
    for (const p of starred) sel.appendChild(el('option', { value: p.id, text: p.id, selected: p.id === value }));
    sel.value = value || '';
    sel.addEventListener('change', () => onPick(sel.value || null));
    return sel;
  };
  const shot = (id) => (id
    ? el('img', { alt: id, src: `/api/thumb/${current.slug}/${encodeURIComponent(id)}` })
    : el('div', { class: 'slotlabel', text: 'empty' }));

  const wrap = $('#draft');
  wrap.textContent = '';
  wrap.appendChild(el('div', { class: 'slot wide' }, [
    el('span', { class: 'slotlabel', text: 'Hero' }),
    shot(layout.hero),
    chooser(layout.hero, (v) => { layout.hero = v; saveLayout(); }),
  ]));

  const slots = el('div', { class: 'slots' });
  layout.slots.forEach((s, i) => {
    const wide = el('button', { type: 'button', class: 'tiny', text: s.wide ? 'Full width' : 'Half width' });
    wide.onclick = () => { s.wide = !s.wide; saveLayout(); };
    slots.appendChild(el('div', { class: 'slot' + (s.wide ? ' wide' : '') }, [
      el('span', { class: 'slotlabel', text: `Frame ${i + 1}` }),
      shot(s.id),
      chooser(s.id, (v) => { s.id = v; saveLayout(); }),
      wide,
    ]));
  });
  wrap.appendChild(slots);
}

async function saveLayout() {
  try {
    const r = await api('/api/layout/' + current.slug, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(LIB.layout),
    });
    LIB.layout = r.layout;
    paintGit(r.git);
    renderDraft();
  } catch (e) { toast('Could not save the layout: ' + e.message, true); }
}

for (const name of Object.keys(views)) {
  $('#tab-' + name).addEventListener('click', () => tab(name));
}

/* -------------------------------------------------- photographs on the page */

let SHAPES = null;
const shapeOf = (frame, isHero) => (isHero ? 'hero' : (/\bwide\b/.test(frame.classes || '') ? 'wide' : 'frame'));

function renderPhotos() {
  const pc = current.page_content;
  const wrap = $('#photos');
  wrap.textContent = '';

  const frameCard = (frame, isHero, index) => {
    const kind = shapeOf(frame, isHero);
    const shape = (SHAPES || {})[kind] || {};
    const box = el('div', { class: 'framebox' });
    if (frame.image) {
      const img = el('img', { src: '/preview/' + frame.image + '?t=' + Date.now(), alt: frame.alt || '' });
      if (frame.focal && frame.focal !== '50% 50%') img.style.objectPosition = frame.focal;
      // Clicking sets the focal point — the part that must survive a phone crop.
      box.addEventListener('click', (e) => {
        const r = box.getBoundingClientRect();
        const focal = `${Math.round(((e.clientX - r.left) / r.width) * 100)}% ` +
                      `${Math.round(((e.clientY - r.top) / r.height) * 100)}%`;
        set(() => { frame.focal = focal; }, true);
      });
      box.appendChild(img);
      if (frame.focal && frame.focal !== '50% 50%') {
        const [fx, fy] = frame.focal.split(' ');
        box.appendChild(el('span', { class: 'xhair', style: `left:${fx};top:${fy}` }));
      }
    } else {
      box.appendChild(el('div', { class: 'slotlabel', text: 'no photograph yet' }));
    }

    const alt = el('input', { placeholder: 'What the photograph shows' });
    alt.value = frame.alt || '';
    alt.addEventListener('input', () => set(() => { frame.alt = alt.value; }));

    const tools = el('div', { class: 'ftools' });
    const replace = el('button', { type: 'button', class: 'tiny', text: frame.image ? 'Replace' : 'Choose' });
    replace.onclick = () => openPicker(isHero ? 'hero' : index, kind);
    tools.appendChild(replace);

    if (!isHero) {
      const wide = el('button', { type: 'button', class: 'tiny', text: 'Full width',
        'aria-pressed': String(kind === 'wide') });
      wide.onclick = () => set(() => {
        // Read the frame as it stands, not as it was when this button was
        // drawn, and keep the classes a set rather than a list.
        const now = new Set((frame.classes || '').split(/\s+/).filter(Boolean));
        if (now.has('wide')) now.delete('wide'); else now.add('wide');
        frame.classes = [...now].join(' ');
      }, true);
      const up = el('button', { type: 'button', class: 'tiny', text: '↑' });
      const down = el('button', { type: 'button', class: 'tiny', text: '↓' });
      up.disabled = index === 0;
      down.disabled = index === pc.gallery.length - 1;
      const move = (to) => set(() => { const [x] = pc.gallery.splice(index, 1); pc.gallery.splice(to, 0, x); }, true);
      up.onclick = () => move(index - 1);
      down.onclick = () => move(index + 1);
      const del = el('button', { type: 'button', class: 'tiny', text: 'Remove' });
      del.onclick = () => set(() => { pc.gallery.splice(index, 1); }, true);
      const centre = el('button', { type: 'button', class: 'tiny', text: 'Centre' });
      centre.onclick = () => set(() => { frame.focal = '50% 50%'; }, true);
      tools.append(wide, up, down, centre, del);
    } else {
      const centre = el('button', { type: 'button', class: 'tiny', text: 'Centre' });
      centre.onclick = () => set(() => { frame.focal = '50% 50%'; }, true);
      tools.appendChild(centre);
    }

    return el('div', { class: 'frame' + (kind === 'wide' ? ' wide' : '') }, [
      el('span', { class: 'slotlabel',
        text: `${isHero ? 'Hero' : 'Frame ' + (index + 1)} · ${shape.width || ''}${shape.height ? '×' + shape.height : ' wide'}` }),
      box, alt, tools,
    ]);
  };

  wrap.appendChild(el('h2', { text: 'The banner' }));
  wrap.appendChild(frameCard(pc.hero || (pc.hero = { classes: '', focal: '50% 50%', alt: '', image: null }), true));

  wrap.appendChild(el('h2', { text: 'The gallery' }));
  const grid = el('div', { class: 'frames' });
  (pc.gallery || []).forEach((f, i) => grid.appendChild(frameCard(f, false, i)));
  wrap.appendChild(grid);

  const add = el('button', { type: 'button', class: 'tiny', text: 'Add a frame' });
  add.onclick = () => set(() => {
    (pc.gallery = pc.gallery || []).push({ classes: '', image: null, alt: '', focal: '50% 50%' });
  }, true);
  wrap.appendChild(add);

  wrap.appendChild(el('p', { class: 'saved',
    text: 'Click a photograph to set its focal point — the part that must survive when a phone squeezes the frame.' }));
}

/* ------------------------------------------------------- choosing and cropping */

let cropState = null;

function openPicker(target, kind) {
  if (!LIB || !LIB.photos.length) {
    const looked = ((LIB && LIB.source && LIB.source.looked) || []).map((x) => '  ' + x.path).join('\n');
    return toast(
      `No photographs to choose from — ${(LIB && LIB.source && LIB.source.label) || 'no library'}.` +
      (looked ? '\n\nIt looked in:\n' + looked +
        '\n\nFix the path in tools/studio/libraries.json and reload.' : ''), true);
  }
  const starred = LIB.photos.filter((p) => (LIB.marks[p.id] || {}).stars);
  const pool = starred.length ? starred : LIB.photos;
  const dlg = $('#picker');
  const grid = $('#pickgrid');
  grid.textContent = '';
  $('#pickhint').textContent = starred.length
    ? `${starred.length} starred photographs. Pick one to cut to this frame.`
    : 'Nothing is starred yet, so this is the whole library.';
  for (const photo of pool) {
    const b = el('button', { type: 'button', class: 'pick' }, [
      el('img', { loading: 'lazy', alt: photo.id,
        src: `/api/thumb/${current.slug}/${encodeURIComponent(photo.id)}` }),
      el('span', { class: 'shotid', text: photo.id }),
    ]);
    b.onclick = () => { dlg.close(); openCrop(photo, target, kind); };
    grid.appendChild(b);
  }
  dlg.showModal();
}

function openCrop(photo, target, kind) {
  const dlg = $('#cropper');
  const stage = $('#cropstage');
  stage.textContent = '';
  const ratio = (SHAPES[kind] || {}).ratio;
  const img = el('img', { id: 'cropimg', src: `/api/source/${current.slug}/${encodeURIComponent(photo.id)}` });
  const rect = el('div', { class: 'croprect' });
  stage.append(img, rect);
  $('#crophint').textContent = ratio
    ? `${photo.id} — drag to move, the slider changes how much is kept.`
    : `${photo.id} — the banner keeps the whole photograph.`;
  $('#cropsize').hidden = !ratio;
  cropState = { photo, target, kind, ratio, size: 1, cx: 0.5, cy: 0.5 };

  const draw = () => {
    if (!ratio) { rect.hidden = true; return; }
    rect.hidden = false;
    const iw = img.clientWidth;
    const ih = img.clientHeight;
    let w = iw * cropState.size;
    let h = w / ratio;
    if (h > ih) { h = ih; w = h * ratio; }
    const x = Math.min(Math.max(cropState.cx * iw - w / 2, 0), iw - w);
    const y = Math.min(Math.max(cropState.cy * ih - h / 2, 0), ih - h);
    Object.assign(rect.style, {
      left: img.offsetLeft + x + 'px', top: img.offsetTop + y + 'px',
      width: w + 'px', height: h + 'px',
    });
    cropState.frac = { x: x / iw, y: y / ih, w: w / iw, h: h / ih };
  };
  img.onload = draw;
  $('#cropsize').oninput = (e) => { cropState.size = Number(e.target.value) / 100; draw(); };
  $('#cropsize').value = 100;
  $('#allowsoft').checked = false;
  $('#softwrap').hidden = true;

  let dragging = false;
  const move = (e) => {
    if (!dragging || !ratio) return;
    const r = img.getBoundingClientRect();
    cropState.cx = (e.clientX - r.left) / r.width;
    cropState.cy = (e.clientY - r.top) / r.height;
    draw();
  };
  stage.onpointerdown = (e) => { dragging = true; stage.setPointerCapture(e.pointerId); move(e); };
  stage.onpointermove = move;
  stage.onpointerup = () => { dragging = false; };
  dlg.showModal();
}

$('#cropuse').addEventListener('click', async () => {
  const c = cropState;
  $('#cropper').close();
  try {
    const r = await api('/api/place/' + current.slug, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photoId: c.photo.id, target: c.target, crop: c.frac || null,
        allowUpscale: $('#allowsoft').checked }),
    });
    current.page_content = r.project.page_content;
    Object.assign(STATE.projects.find((p) => p.slug === current.slug).page_content, r.project.page_content);
    paintGit(r.git);
    renderPhotos();
    refresh();
    toast(`${r.written.path} — ${r.written.width}×${r.written.height}, ${Math.round(r.written.bytes / 1024)}KB`);
  } catch (e) {
    toast(e.message, true);
    // Enlarging is refused by default. Offer the way past it here, unticked,
    // so taking it is a decision rather than a click-through.
    if (/soft picture/.test(e.message)) {
      cropState = c;
      $('#softwrap').hidden = false;
      $('#cropper').showModal();
    }
  }
});
$('#cropcancel').addEventListener('click', () => $('#cropper').close());
$('#pickcancel').addEventListener('click', () => $('#picker').close());

api('/api/shapes').then((s) => { SHAPES = s; }).catch(() => {});
