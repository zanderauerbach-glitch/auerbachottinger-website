/* Project map — Leaflet with a pale basemap so the land, not the
   markers, carries the page. Data comes from data/projects.js:
   AA.projects (town-level, never the house) and AA.offices (at the
   building when it is a public business address, town-level when not). */
(function () {
  if (!window.L || !window.AA || !AA.projects) return;

  var el = document.getElementById('project-map');
  if (!el) return;

  var COLORS = { complete: '#5c7a5c', construction: '#a06a20', design: '#3d6080' };

  /* Every value below is written into HTML. The content files are ours, but
     they are edited in the studio, and a tagline with a quote in it would
     otherwise break its own popup — the templates are linted for exactly
     this and this file sat outside that net. */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var map = L.map(el, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
  L.control.scale({ imperial: true, metric: false }).addTo(map);

  // Esri's light-gray canvas: no API key, and quiet enough that the land reads first.
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
    maxZoom: 16
  }).addTo(map);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 16, pane: 'shadowPane', opacity: 0.9
  }).addTo(map);

  var markers = {};
  var mapped = AA.projects.filter(function (p) { return p.lat && p.lng; });
  var offices = (AA.offices || []).filter(function (o) { return o.lat && o.lng; });
  var officeKey = function (o) { return 'office:' + o.slug; };

  /* Offices: a dark square, so they read as a different kind of thing from
     the round project dots at a glance, and in the legend. */
  offices.forEach(function (o) {
    var icon = L.divIcon({
      className: 'aa-office-wrap',
      html: '<span class="aa-office"></span><span class="aa-marker-label aa-office-label">' + esc(o.name) + '</span>',
      iconSize: [12, 12], iconAnchor: [6, 6]
    });
    var m = L.marker([o.lat, o.lng], { icon: icon, title: o.name, zIndexOffset: 1000 }).addTo(map);
    m.bindPopup(
      '<div class="aa-popup">' +
      '<span class="label">' + esc(o.place) + '</span>' +
      '<h3>' + esc(o.name) + '</h3>' +
      '<p>' + esc(o.location) + (o.note ? '<br>' + esc(o.note) : '') + '</p>' +
      '<a class="aa-popup-link" href="contact.html">Get in touch</a>' +
      '</div>', { maxWidth: 280, closeButton: false });
    markers[officeKey(o)] = m;
  });

  mapped.forEach(function (p) {
    var icon = L.divIcon({
      className: 'aa-marker-wrap',
      html: '<span class="aa-marker" style="background:' + (COLORS[p.status] || '#888') + '"></span>' +
            '<span class="aa-marker-label">' + esc(p.name) + '</span>',
      iconSize: [12, 12], iconAnchor: [6, 6]
    });
    var m = L.marker([p.lat, p.lng], { icon: icon, title: p.name }).addTo(map);
    var img = p.image ? '<a href="' + esc(p.page) + '" class="aa-popup-img"><img src="' + esc(p.image) + '" alt="' + esc(p.alt) + '"></a>' : '';
    m.bindPopup(
      '<div class="aa-popup">' + img +
      '<span class="label">' + esc(p.location) + '</span>' +
      '<h3><a href="' + esc(p.page) + '">' + esc(p.name) + '</a></h3>' +
      '<span class="status status-' + esc(p.status) + '">' + esc(AA.STATUS[p.status]) + '</span>' +
      '<p>' + esc(p.tagline) + '</p>' +
      '<a class="aa-popup-link" href="' + esc(p.page) + '">View project</a>' +
      '</div>', { maxWidth: 280, closeButton: false });
    markers[p.slug] = m;
  });

  /* Labels that would print on top of each other are hidden instead.

     Fifteen markers at Northeast zoom put seven Vineyard projects inside a few
     pixels of each other, and the names came out as one illegible smudge over
     the island — on the view the page opens with. A dot with no name still
     reads as a project and still opens its popup; a pile of overlapping names
     reads as nothing.

     Offices go first, then projects in AA.projects order, so which name
     survives a cluster is decided by the site rather than by whichever marker
     Leaflet drew last, and stays the same between renders. Offices win because
     they are the fixed points the rest of the map is read from. */
  var PAD = 3;
  var labelled = offices.map(officeKey).concat(mapped.map(function (p) { return p.slug; }));

  function labelOf(key) {
    var m = markers[key];
    var node = m && m.getElement && m.getElement();
    return node ? node.querySelector('.aa-marker-label') : null;
  }

  /* Where a name can sit relative to its dot, in order of preference. Right
     of the dot is the convention and is tried first; only when that spot is
     taken does a name move, and only when every spot is taken is it hidden.
     Before this, the Vineyard office's name knocked Pond House's off the
     island view, though there was room on the other side of the dot. */
  var SPOTS = ['', 'at-left', 'at-below', 'at-above'];

  function layoutLabels() {
    var placed = [];
    labelled.forEach(function (key) {
      var label = labelOf(key);
      if (!label) return;
      label.classList.remove('is-crowded');
      var chosen = null;
      for (var i = 0; i < SPOTS.length && !chosen; i++) {
        SPOTS.forEach(function (c) { if (c) label.classList.remove(c); });
        if (SPOTS[i]) label.classList.add(SPOTS[i]);
        var r = label.getBoundingClientRect();
        if (!r.width) return;              // not rendered: nothing to place
        var box = [r.left - PAD, r.top - PAD, r.right + PAD, r.bottom + PAD];
        var clash = placed.some(function (q) {
          return box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1];
        });
        if (!clash) chosen = box;
      }
      if (chosen) { placed.push(chosen); return; }
      // Nowhere free. Put it back to its usual spot and hide it there.
      SPOTS.forEach(function (c) { if (c) label.classList.remove(c); });
      label.classList.add('is-crowded');
    });
  }

  map.on('zoomend moveend', layoutLabels);

  /* Named by what they include, not by what they leave out: "not California"
     would have quietly counted a Montana project as the Northeast. */
  var NORTHEAST = { vineyard: 1, massachusetts: 1, maine: 1, newyork: 1 };
  function fit(inRegion, pad) {
    var layers = mapped.filter(function (p) { return inRegion(p.region); })
      .map(function (p) { return markers[p.slug]; })
      .concat(offices.filter(function (o) { return inRegion(o.region); })
        .map(function (o) { return markers[officeKey(o)]; }));
    // An empty group has no bounds, and fitBounds throws on that.
    if (!layers.length) return;
    map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [pad, pad] });
  }
  var VIEWS = {
    all:       function () { fit(function () { return true; }, 40); },
    northeast: function () { fit(function (r) { return !!NORTHEAST[r]; }, 40); },
    vineyard:  function () { fit(function (r) { return r === 'vineyard'; }, 60); }
  };

  document.querySelectorAll('.map-view').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.map-view').forEach(function (x) { x.classList.toggle('active', x === b); });
      VIEWS[b.dataset.view]();
    });
  });

  // The list under the map: offices first, then projects grouped by region.
  var list = document.getElementById('map-list');
  if (list) {
    function group(title, items) {
      if (!items.length) return;
      var h = document.createElement('div');
      h.className = 'map-list-region';
      h.innerHTML = '<span class="label">' + esc(title) + '</span>';
      var ul = document.createElement('ul');
      items.forEach(function (it) {
        var li = document.createElement('li');
        li.innerHTML = '<button type="button" class="map-list-item" data-slug="' + esc(it.key) + '">' +
          it.dot + '<span class="map-list-name">' + esc(it.name) + '</span>' +
          '<span class="map-list-loc">' + esc(it.location) + '</span></button>';
        ul.appendChild(li);
      });
      h.appendChild(ul);
      list.appendChild(h);
    }
    group('Offices', offices.map(function (o) {
      return { key: officeKey(o), name: o.name, location: o.location, dot: '<span class="aa-office"></span>' };
    }));
    Object.keys(AA.REGIONS).forEach(function (r) {
      // Only projects that are on the map: a list entry with no marker behind
      // it would be a button that does nothing when pressed.
      group(AA.REGIONS[r], mapped.filter(function (p) { return p.region === r; }).map(function (p) {
        return { key: p.slug, name: p.name, location: p.location,
                 dot: '<span class="aa-marker" style="background:' + (COLORS[p.status] || '#888') + '"></span>' };
      }));
    });
    list.addEventListener('click', function (e) {
      var b = e.target.closest('.map-list-item');
      if (!b) return;
      var m = markers[b.dataset.slug];
      if (!m) return;
      map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 10), { duration: 0.8 });
      setTimeout(function () { m.openPopup(); }, 850);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  VIEWS.northeast();
  var ne = document.querySelector('.map-view[data-view="northeast"]');
  if (ne) ne.classList.add('active');
  layoutLabels();
})();
