/* Field Notes — renders the feed on journal.html and the
   "From the field" section on project pages. Data: data/journal.js. */
(function () {
  if (!window.AA || !AA.journal) return;

  /* Draft entries are not published. A visitor never sees one.
     Reviewers open any page with ?drafts=1 to reveal them; the choice sticks
     in this browser until ?drafts=0 clears it, so you can move around the
     site while reading them. Nothing about this is visible to anyone who has
     not deliberately asked for it. */
  var DKEY = 'aa-drafts';
  var showDrafts = (function () {
    var q = new URLSearchParams(window.location.search).get('drafts');
    try {
      if (q === '1' || q === '0') localStorage.setItem(DKEY, q);
      return (q !== null ? q : localStorage.getItem(DKEY)) === '1';
    } catch (e) { return q === '1'; }
  })();
  AA.showDrafts = showDrafts;
  var live = AA.journal.filter(function (e) { return showDrafts || !e.draft; });

  function fmtDate(iso) {
    var d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function entryHTML(e, opts) {
    var p = e.project && AA.projectBySlug ? AA.projectBySlug(e.project) : null;
    var proj = p ? '<a class="fn-project" href="' + p.page + '">' + p.name + '</a>' : '<span class="fn-project fn-general">Practice</span>';
    var img = e.image ? '<div class="fn-image"><img src="' + e.image + '" alt=""></div>' : '';
    return '<article class="fn-entry fn-' + e.category + '">' +
      '<div class="fn-meta">' +
        '<time datetime="' + e.date + '">' + fmtDate(e.date) + '</time>' +
        '<span class="fn-cat">' + (AA.CATEGORIES[e.category] || e.category) + '</span>' +
        (opts && opts.hideProject ? '' : proj) +
        (e.draft ? '<span class="fn-draft">Draft</span>' : '') +
      '</div>' +
      '<h3 class="fn-title">' + e.title + '</h3>' +
      img +
      '<div class="fn-body">' + e.body +
        (e.draft && e.draftNote ? '<p class="fn-draftnote"><em>[' + e.draftNote + ']</em></p>' : '') +
      '</div>' +
    '</article>';
  }

  var sorted = live.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });

  /* A standing reminder, so nobody mistakes a review session for the live site. */
  if (showDrafts && AA.journal.some(function (e) { return e.draft; })) {
    var bar = document.createElement('div');
    bar.className = 'fn-draftbar';
    bar.innerHTML = 'Showing unpublished drafts. Visitors do not see these. ' +
                    '<a href="?drafts=0">Hide them</a>';
    document.addEventListener('DOMContentLoaded', function () {
      document.body.insertBefore(bar, document.body.firstChild);
    });
  }

  // ---- Feed page ----
  var feed = document.getElementById('journal-feed');
  if (feed) {
    var state = { category: 'all', project: 'all' };
    var q = new URLSearchParams(window.location.search);
    if (q.get('project')) state.project = q.get('project');
    if (q.get('category')) state.category = q.get('category');

    var projSel = document.getElementById('journal-project');
    if (projSel && AA.projects) {
      // Built from what is published, not from everything: a project whose
      // only notes are drafts must not appear in the picker, or the list
      // quietly says which projects have writing a visitor cannot read.
      var seen = {};
      live.forEach(function (e) { if (e.project) seen[e.project] = true; });
      AA.projects.forEach(function (p) {
        if (!seen[p.slug]) return;
        var o = document.createElement('option');
        o.value = p.slug; o.textContent = p.name;
        projSel.appendChild(o);
      });
      projSel.value = state.project;
      projSel.addEventListener('change', function () { state.project = projSel.value; render(); });
    }

    var chips = document.querySelectorAll('.journal-filters .filter-chip');
    chips.forEach(function (c) {
      c.classList.toggle('active', c.dataset.value === state.category);
      c.addEventListener('click', function () {
        state.category = c.dataset.value;
        chips.forEach(function (x) { x.classList.toggle('active', x === c); });
        render();
      });
    });

    var render = function () {
      var items = sorted.filter(function (e) {
        return (state.category === 'all' || e.category === state.category) &&
               (state.project === 'all' || e.project === state.project);
      });
      var held = AA.journal.length - live.length;
      feed.innerHTML = items.length
        ? items.map(function (e) { return entryHTML(e); }).join('')
        : '<p class="fn-empty">' + (held && state.category === 'all' && state.project === 'all'
            ? 'The first notes are being written. Check back shortly.'
            : 'No notes yet for this selection.') + '</p>';
    };
    render();
  }

  // ---- Project page section ----
  var sec = document.getElementById('field-notes');
  if (sec) {
    var slug = sec.dataset.project;
    var items = sorted.filter(function (e) { return e.project === slug; });
    if (!items.length) { sec.remove(); return; }
    sec.innerHTML = '<div class="section-inner">' +
      '<div class="section-header"><span class="label">From the field</span>' +
      '<h2>Notes on this project</h2></div>' +
      '<div class="fn-list">' + items.slice(0, 3).map(function (e) { return entryHTML(e, { hideProject: true }); }).join('') + '</div>' +
      '<a class="fn-more" href="journal.html?project=' + slug + '">All field notes' + (items.length > 3 ? ' (' + items.length + ')' : '') + '</a>' +
      '</div>';
  }
})();
