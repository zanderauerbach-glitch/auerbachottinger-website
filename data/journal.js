/* ============================================================
   FIELD NOTES — the feed of updates, observations and critiques.
   Rendered on journal.html, and on each project page under
   "From the field" for entries tagged with that project.

   Fields:
     date      YYYY-MM-DD
     category  'update' | 'observation' | 'critique' | 'philosophy'
     project   slug from data/projects.js, or null for general notes
     title     short heading
     body      one or more <p> paragraphs (HTML string)
     image     optional image path
     draft     true = withheld from the site; set to false when Zander approves
     draftNote why this entry is a draft. Shown only while it is one.

   Newest entries go at the top.

   *** WHAT IS PUBLISHED, AND WHAT IS NOT (2026-09-22) ***
   The three newest entries are live. They were written from the
   photographs of the 31 August site visits and the Goodsill drawing set
   — every detail in them is something the record shows. They are still
   not Zander's words, and he should rewrite or approve them before any
   of this is handed to production.

   Rewritten 2026-09-23 because they read as machine-written: neat
   antitheses, rooms "finding their height", a house "giving away what
   it has been hiding". Now plain statements of what the visit showed.
   The Goodsill entry also claimed it was the portfolio's first project
   off the island; five others are, and the claim is gone.

   Everything below them is marked draft:true and no visitor sees it:
   that copy was adapted from the Methods and project pages rather than
   observed, which is a weaker thing to publish under the firm's name.
   Open any page with ?drafts=1 to read it.
   ============================================================ */
window.AA = window.AA || {};

AA.CATEGORIES = {
  update:      'Update',
  observation: 'Observation',
  critique:    'Critique',
  philosophy:  'Philosophy'
};

AA.journal = [
  { date: '2026-09-22', category: 'update', project: 'pennywise-path',
    image: 'images/projects/pennywise-path-02.jpg',
    title: "Pennywise Path: ceilings in, stair built",
    body: "<p>At the end of August the sloped ceilings were boarded and painted, and the scaffold towers were still up under them. The towers give you a good sense of how high the ridge is. The clerestory windows sit above the finished walls at the height of the tree canopy, so the main room gets its light from over the trees.</p>" +
          "<p>Where the walls are still open, the red and blue PEX and the copper are roughed in and the mineral wool is going in behind. The stair is built and the treads are still bare. Downstairs the rooms are closed in.</p>" +
          "<p>Outside, the cedar is on and the stickers are still on the windows. The deck and its cable rail are finished along the back.</p>" },

  { date: '2026-09-21', category: 'update', project: 'calebs-pond',
    image: 'images/projects/calebs-pond-03.jpg',
    title: "Caleb's Pond: phase one in use, phase two under way",
    body: "<p>Phase one had one deadline: the house had to be ready for three generations by the first of June, for the whole summer. It was. At the end of August it was furnished and lived in, with beds made up under the pine rafters and the kitchen in use.</p>" +
          "<p>Phase two has started. The new trellis over the deck is up, in pine that’s still pale next to the weathered shingles, and a roofed porch is being framed over the entry for wet and sandy things. Like everything in the first phase, neither one makes the house any bigger.</p>" },

  { date: '2026-09-19', category: 'update', project: 'goodsill-carport',
    title: "Goodsill Carport: drawings issued for construction",
    body: "<p>A carport for two cars and a locked store in Forestville, California, under one folded roof, 23 feet by 34 feet 8 inches. The roof is 6 feet 8 inches high over the cars and rises to 11 feet 7 inches over the store.</p>" +
          "<p>The roof is standing seam metal and the walls are fiber cement with a V-groove, with a two-inch vent gap under the eave. The cars park on bluestone rather than a slab, so rain goes into the ground. The roof is framed to take solar panels later.</p>" +
          "<p>Issued for construction in July 2025. No photographs yet.</p>" },

  { date: '2026-09-18', category: 'update', project: 'calebs-pond', draft: true, draftNote: 'Sample entry — drafted from the 31 August site visit. Replace with Zander’s own words.',
    title: "Caleb's Pond: phase two begins as the summer winds down",
    body: '<p>Phase one was scoped to a single deadline — the house had to be weather tight and usable by the beginning of June, for three generations, for the whole summer. It was. Phase two starts now: more trellises, a solid-roof awning at the entry for sandy and wet things, the arrival garden, and the dormer that finally turns a view back toward the woods.</p>' },

  { date: '2026-09-12', category: 'observation', project: 'pennywise-path', draft: true, draftNote: 'Sample entry — drafted from the 31 August site visit. Replace with Zander’s own words.',
    title: 'Pennywise Path: the clerestory was the right argument to win',
    body: '<p>The clerestory windows sit at the height of the tree canopy, and they are the thing worth being happiest about here. You look out of the room, and then you look up, into branches and sky. Raising that window height was a significant decision and a significant improvement, and it is what turns a modest plan into a treehouse.</p>' },

  { date: '2026-09-17', category: 'update', project: 'runner-road', draft: true, draftNote: 'Sample entry — replace with Zander’s own words.',
    title: 'Runner Road: the gardens go in before the house is finished',
    body: '<p>At Runner Road the landscape is not a finishing touch; it is the reason the plan is shaped the way it is. Design Outside and Eventide Construction are sequencing the planting alongside the framing so the house arrives into a garden that is already growing.</p>' },

  { date: '2026-09-10', category: 'observation', project: 'pond-house', draft: true, draftNote: 'Sample entry — replace with Zander’s own words.',
    title: 'Two winters on: how the cedar is weathering',
    body: '<p>The untreated Alaskan Yellow Cedar at Pond House was always meant to go gray. Two winters in, the south face has silvered evenly while the sheltered north elevation still shows warmth in the grain. Both are doing exactly what untreated wood should: breathing, drying, and asking nothing of the owners.</p>' },

  { date: '2026-09-02', category: 'critique', project: null, draft: true, draftNote: 'Sample entry — adapted from the Methods page. Replace with Zander’s own words.',
    title: 'The problem with a perfectly sealed wall',
    body: '<p>Modern building science asks for a flawless vapour barrier and a mechanically controlled interior. In principle it is well-reasoned. In practice, a single missed joint in a spray-foam application or a poorly flashed window lets moisture into an assembly with nowhere to go, and the rot proceeds invisibly for years.</p><p>The traditional answer is different in kind: not sealing, but breathing. A wall that can dry is a wall that does not rot.</p>' },

  { date: '2026-08-20', category: 'philosophy', project: null, draft: true, draftNote: 'Sample entry — adapted from the Methods page. Replace with Zander’s own words.',
    title: 'Why we build for a thousand years',
    body: '<p>We build for centuries, not decades. A 500-year-old timber frame, properly maintained, outperforms any engineered substitute. A lime-plastered wall, allowed to breathe, outlasts any gypsum assembly sealed behind acrylic paint. The lessons are not sentimental; they are structural.</p><p>The 1,000-year building is a practical commitment: to materials that perform honestly over time, to assemblies that tolerate imperfection, and to buildings that age with their landscape rather than against it.</p>' },

  { date: '2026-08-05', category: 'update', project: 'red-coat-hill', draft: true, draftNote: 'Sample entry — replace with Zander’s own words.',
    title: 'Red Coat Hill: reading the glacial ground',
    body: '<p>Martha’s Vineyard was made by ice, and the site at Red Coat Hill still carries the shape of the moraine. The 3,800 sq ft multigenerational house steps with the ground rather than levelling it, so the excavation stays small and the hill stays a hill.</p>' }
];
