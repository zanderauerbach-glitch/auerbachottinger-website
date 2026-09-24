/* Architect's notes — numbered annotations drawn over project photos.
   Data lives in data/annotations.js keyed by image path. A visitor
   turns them on or off with the toggle in the bottom-right corner;
   the choice is remembered in the browser. */
(function () {
  if (!window.AA || (!AA.annotations && !AA.drawings)) return;

  var KEY = 'aa-notes-on';

  /* Unapproved notes are not published, exactly as with Field Notes. A visitor
     never sees one. journal.js resolves ?drafts=1 and leaves the answer on AA;
     fall back to reading it here for pages that do not load journal.js. */
  var showDrafts = AA.showDrafts;
  if (showDrafts === undefined) {
    try {
      var q = new URLSearchParams(window.location.search).get('drafts');
      if (q === '1' || q === '0') localStorage.setItem('aa-drafts', q);
      showDrafts = (q !== null ? q : localStorage.getItem('aa-drafts')) === '1';
    } catch (e) { showDrafts = false; }
  }

  var notesData = {};
  Object.keys(AA.annotations || {}).forEach(function (k) {
    var kept = AA.annotations[k].filter(function (n) { return showDrafts || !n.draft; });
    if (kept.length) notesData[k] = kept;
  });
  var inkData = {};
  Object.keys(AA.drawings || {}).forEach(function (k) {
    if (showDrafts || !AA.drawings[k].draft) inkData[k] = AA.drawings[k];
  });
  var imgs = Array.prototype.slice.call(document.querySelectorAll('.gallery-item img, .project-hero img'));
  var annotated = [];
  var pending = [];

  /* A drawn note only means anything if it sits exactly where it was drawn.
     The gallery crops photographs to fit its tiles, and some tiles shift the
     crop as well, so the ink has to be cropped by the identical rule or it
     slides off whatever it was pointing at. Copying the photograph's own
     computed object-fit and object-position does that, whatever the tile. */
  function matchCrop(inkImg, photo) {
    var s = window.getComputedStyle(photo);
    inkImg.style.objectFit = s.objectFit || 'cover';
    inkImg.style.objectPosition = s.objectPosition || '50% 50%';
  }

  /* Pins are written as percentages of the photograph, not of the tile
     that shows it. A tile crops the photograph (cover), and the hero crops
     it differently on every screen, so each pin is mapped through the same
     crop before it is placed. A pin that falls in the cropped-away part is
     hidden rather than pinned to the wrong thing. */
  function posFraction(v) {
    if (!v) return 0.5;
    if (v.slice(-1) === '%') return parseFloat(v) / 100;
    return { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 }[v] !== undefined
      ? { left: 0, top: 0, center: 0.5, right: 1, bottom: 1 }[v] : 0.5;
  }
  function placePins(host) {
    var photo = host.querySelector(':scope > img');
    var layer = host.querySelector('.anno-layer');
    if (!photo || !layer || !photo.naturalWidth) return;
    var W = layer.clientWidth, H = layer.clientHeight;
    if (!W || !H) return;
    var s = window.getComputedStyle(photo);
    var iw = photo.naturalWidth, ih = photo.naturalHeight;
    var scale = (s.objectFit === 'contain')
      ? Math.min(W / iw, H / ih) : Math.max(W / iw, H / ih);
    var dw = iw * scale, dh = ih * scale;
    var pos = (s.objectPosition || '50% 50%').split(/\s+/);
    var ox = (W - dw) * posFraction(pos[0]);
    var oy = (H - dh) * posFraction(pos[1]);
    layer.querySelectorAll('.anno-pin').forEach(function (pin) {
      var left = ox + dw * (+pin.dataset.x) / 100;
      var top = oy + dh * (+pin.dataset.y) / 100;
      var lx = left / W * 100, ty = top / H * 100;
      pin.style.left = lx + '%';
      pin.style.top = ty + '%';
      pin.hidden = lx < 2 || lx > 98 || ty < 2 || ty > 98;
      var note = pin.querySelector('.anno-note');
      note.classList.toggle('anno-note-left', lx > 60);
      note.classList.toggle('anno-note-up', ty > 70);
    });
  }

  imgs.forEach(function (img) {
    var src = img.getAttribute('src');
    var ink = inkData[src];
    /* Where Zander has drawn on a photograph, the drawing speaks for it.
       Showing numbered pins over the top of it as well only fights. */
    var notes = ink ? null : notesData[src];
    if (!ink && (!notes || !notes.length)) return;
    var host = img.closest('.gallery-item, .project-hero');
    if (!host) return;
    host.classList.add('has-notes');

    if (ink) {
      host.classList.add('has-ink');

      var scrim = document.createElement('div');
      scrim.className = 'anno-scrim';
      host.appendChild(scrim);

      var layer = document.createElement('div');
      layer.className = 'anno-ink';
      var inkImg = document.createElement('img');
      inkImg.alt = ink.alt || '';
      if (!ink.alt) inkImg.setAttribute('aria-hidden', 'true');
      inkImg.decoding = 'async';
      /* Held back until the visitor actually asks for the notes, so a
         visitor who never turns them on never pays for them. */
      inkImg.dataset.src = ink.src;
      matchCrop(inkImg, img);
      layer.appendChild(inkImg);
      host.appendChild(layer);

      pending.push(inkImg);
      annotated.push(host);

      if (img.complete) matchCrop(inkImg, img);
      else img.addEventListener('load', function () { matchCrop(inkImg, img); });
      return;
    }
    var layer = document.createElement('div');
    layer.className = 'anno-layer';
    notes.forEach(function (n, i) {
      var pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'anno-pin';
      pin.dataset.x = n.x;
      pin.dataset.y = n.y;
      pin.setAttribute('aria-label', 'Note ' + (i + 1));
      pin.innerHTML = '<span class="anno-num">' + (i + 1) + '</span>' +
                      '<span class="anno-note">' +
                        (n.draft ? '<span class="anno-draft">Draft</span>' : '') +
                        n.text +
                      '</span>';
      pin.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var open = pin.classList.contains('open');
        layer.querySelectorAll('.anno-pin.open').forEach(function (p) { p.classList.remove('open'); });
        if (!open) pin.classList.add('open');
      });
      layer.appendChild(pin);
    });
    host.appendChild(layer);
    annotated.push(host);
    if (img.complete && img.naturalWidth) placePins(host);
    else img.addEventListener('load', function () { placePins(host); });
  });

  if (!annotated.length) return;

  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'anno-toggle';
  toggle.setAttribute('aria-pressed', 'false');
  toggle.innerHTML = '<span class="anno-toggle-dot"></span><span class="anno-toggle-text">Architect’s notes</span><span class="anno-toggle-state">Off</span>';
  document.body.appendChild(toggle);

  function loadInk() {
    pending.splice(0).forEach(function (im) {
      if (im.dataset.src) { im.src = im.dataset.src; delete im.dataset.src; }
    });
  }

  function set(on) {
    if (on) loadInk();
    document.body.classList.toggle('notes-on', on);
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggle.querySelector('.anno-toggle-state').textContent = on ? 'On' : 'Off';
    if (!on) document.querySelectorAll('.anno-pin.open').forEach(function (p) { p.classList.remove('open'); });
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
  }

  /* A tile can change shape on resize — the wide banner becomes a single
     column on a phone — so the ink has to be re-matched to the new crop. */
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      document.querySelectorAll('.has-ink').forEach(function (host) {
        var photo = host.querySelector(':scope > img');
        var inkImg = host.querySelector('.anno-ink img');
        if (photo && inkImg) matchCrop(inkImg, photo);
      });
      document.querySelectorAll('.has-notes:not(.has-ink)').forEach(placePins);
    }, 150);
  });

  toggle.addEventListener('click', function () { set(!document.body.classList.contains('notes-on')); });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.anno-pin')) document.querySelectorAll('.anno-pin.open').forEach(function (p) { p.classList.remove('open'); });
  });

  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  set(saved === '1');
})();
