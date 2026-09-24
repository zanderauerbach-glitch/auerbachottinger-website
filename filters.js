/* Home-page project filters.
   Filters the static .project-card elements by their data-types,
   data-status and data-region attributes. Cards stay in the HTML
   (good for search engines); this script only shows and hides them.

   The chips start closed. Every change is written into the address bar, so
   the view you are looking at is the view you can send someone. */
(function () {
  var bar = document.querySelector('.filter-bar');
  var cards = document.querySelectorAll('.project-grid .project-card');
  if (!bar || !cards.length) return;

  var GROUPS = ['type', 'status', 'region'];
  var toggle = document.querySelector('.filter-toggle');
  var reset = document.querySelector('.filter-reset');
  var sep = document.querySelector('.filter-sep');
  var state = { type: 'all', status: 'all', region: 'all' };

  function chosen() {
    return GROUPS.filter(function (g) { return state[g] !== 'all'; });
  }

  /* Only our three keys are ours to touch. Anything else in the query string
     belongs to somebody else — ?drafts=1 is how a reviewer is reading the
     unapproved Field Notes, and dropping it would throw them out of that mode
     the moment they clicked a chip. */
  function syncUrl() {
    if (!window.history || !history.replaceState) return;
    var q = new URLSearchParams(window.location.search);
    GROUPS.forEach(function (g) {
      if (state[g] === 'all') q.delete(g);
      else q.set(g, state[g]);
    });
    var s = q.toString();
    history.replaceState(null, '',
      window.location.pathname + (s ? '?' + s : '') + window.location.hash);
  }

  function paintChips() {
    bar.querySelectorAll('.filter-chip').forEach(function (c) {
      var on = state[c.dataset.group] === c.dataset.value;
      c.classList.toggle('active', on);
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function open(want) {
    bar.hidden = !want;
    if (toggle) toggle.setAttribute('aria-expanded', want ? 'true' : 'false');
  }

  function apply() {
    var shown = 0;
    cards.forEach(function (card) {
      var types = (card.dataset.types || '').split(' ');
      var okType = state.type === 'all' || types.indexOf(state.type) !== -1;
      var okStatus = state.status === 'all' || card.dataset.status === state.status;
      // data-region carries the region and everything it sits inside, so a
      // Vineyard card answers to Massachusetts as well.
      var regions = (card.dataset.region || '').split(' ');
      var okRegion = state.region === 'all' || regions.indexOf(state.region) !== -1;
      var ok = okType && okStatus && okRegion;
      card.classList.toggle('is-hidden', !ok);
      if (ok) shown++;
    });
    var empty = document.querySelector('.filter-empty');
    if (empty) empty.hidden = shown !== 0;
    var count = document.querySelector('.filter-count');
    if (count) count.textContent = shown + (shown === 1 ? ' project' : ' projects');

    var n = chosen().length;
    if (reset) reset.hidden = n === 0;
    if (sep) sep.hidden = n === 0;
    // With the chips closed, the button is the only thing that can say the
    // grid is not showing everything.
    if (toggle) toggle.textContent = n ? 'Filter · ' + n : 'Filter';
  }

  if (toggle) toggle.addEventListener('click', function () {
    open(bar.hidden);
  });

  bar.addEventListener('click', function (e) {
    var chip = e.target.closest('.filter-chip');
    if (!chip) return;
    state[chip.dataset.group] = chip.dataset.value;
    paintChips();
    apply();
    syncUrl();
  });

  if (reset) reset.addEventListener('click', function () {
    state = { type: 'all', status: 'all', region: 'all' };
    paintChips();
    apply();
    syncUrl();
  });

  // Arriving on a shared link like index.html?status=construction#projects.
  var q = new URLSearchParams(window.location.search);
  GROUPS.forEach(function (g) {
    var v = q.get(g);
    if (v && bar.querySelector('.filter-chip[data-group="' + g + '"][data-value="' + v + '"]')) {
      state[g] = v;
    }
  });
  paintChips();
  // A filtered grid with the chips closed looks like a short portfolio, so
  // open them when the link carries a selection.
  open(chosen().length > 0);
  apply();
  // A value in the URL that matches no chip is dropped rather than left to
  // contradict what is on screen.
  if (q.has('type') || q.has('status') || q.has('region')) syncUrl();
})();
