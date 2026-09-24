/* ============================================================
   ARCHITECT'S NOTES — annotations drawn over finished work.
   Shown on project pages when the visitor turns on
   "Architect's notes" (bottom-right toggle).

   Keyed by the image path exactly as written in the page's HTML.
   x and y are percentages from the top-left of the image.

   draft: true means the note is not published. A visitor never sees it.
   Reviewers reveal drafts with ?drafts=1 on any page; ?drafts=0 hides them
   again. Clear the flag when Zander has approved the wording.

   *** SAMPLE CONTENT (2026-09-20) ***
   The notes below were drafted from the existing page copy so the
   feature can be previewed. Zander should replace them with his
   own words and positions before this goes live.
   ============================================================ */
window.AA = window.AA || {};

AA.annotations = {
  'images/projects/pond-house-06.jpg': [
    { x: 28, y: 42, text: 'Untreated Alaskan Yellow Cedar siding, left to weather to a pale gray so the house recedes into the scrub oak.', draft: true },
    { x: 62, y: 22, text: 'Roofs engineered for native grasses and shrubs. From the marsh, the mass of the building disappears under planting.', draft: true },
    { x: 50, y: 78, text: 'Steel frame on helical pilings: the house is lifted off the ground plane and can be relocated to higher ground as the sea rises.', draft: true }
  ],
  'images/projects/pond-house-18.jpg': [
    { x: 45, y: 40, text: 'The ‘jogged’ plan tucks the sleeping quarters into the trees and keeps the gathering spaces open to the water.', draft: true },
    { x: 70, y: 60, text: 'Elongated east–west for passive solar gain; the large openings all face south.', draft: true }
  ],
  'images/projects/pond-house-22.jpg': [
    { x: 40, y: 30, text: 'Trellises shade the summer sun and let the low winter sun through — no mechanical shading needed.', draft: true },
    { x: 75, y: 70, text: 'Decks extend the 1,960 sq ft interior outdoors; the line between inside and out is deliberately blurred.', draft: true }
  ],
  'images/projects/runner-road-hero.jpg': [
    { x: 50, y: 50, text: 'The plan is organised around its gardens: every room opens to a planted court rather than to the road.', draft: true }
  ],

  /* ---- Red Coat Hill (drafted 2026-09-21) ----
     Three details Zander wants called out: the stone chimney, the
     shingle roof, and the furniture. Positions are set on the
     photographs. The words are drafts written from what the
     photographs show, so materials and sources are for Zander to
     confirm or rewrite. */
  'images/projects/red-coat-hill-hero.jpg': [
    { x: 68.5, y: 40, text: 'The chimney is the one piece of masonry in a house of shingle and timber: local stone, and the anchor the three volumes gather around.', draft: true },
    { x: 52, y: 46, text: 'Cedar shingle on the roof as well as the walls, so the house reads as a single material and silvers evenly from ridge to grade.', draft: true }
  ],
  'images/projects/red-coat-hill-01.jpg': [
    { x: 66.5, y: 30, text: 'Stone chimney, set where the great-room roof meets the wing — the hinge of the plan, seen from the meadow.', draft: true },
    { x: 45, y: 33, text: 'One long shingle roof over the great room, low-pitched so the volume stays quiet against the ridge behind it.', draft: true }
  ],
  'images/projects/red-coat-hill-05.jpg': [
    { x: 51.5, y: 42, text: 'From above, the chimney marks the centre of the plan: study and great room to one side, bedrooms to the other.', draft: true },
    { x: 43, y: 45, text: 'Three shingled roofs stepping with the ground — the house follows the moraine rather than levelling it.', draft: true }
  ],
  'images/projects/red-coat-hill-02.jpg': [
    { x: 23, y: 74, text: 'Rope-seat armchairs in oak: light enough to turn toward the meadow or the fire.', draft: true },
    { x: 49, y: 67, text: 'Sofas in ochre and citron against the oak. The colour is carried by the furniture, not the walls.', draft: true },
    { x: 50, y: 80, text: 'An embroidered ottoman and a kilim underfoot — the pattern in a room whose finishes are otherwise wood and white.', draft: true }
  ],
  'images/projects/red-coat-hill-03.jpg': [
    { x: 78, y: 68, text: 'A deep sectional in a textured linen, sized for the whole family on a film night.', draft: true },
    { x: 55, y: 78, text: 'Suzani rug and a rattan-topped table: pattern and weave where the room itself stays plain.', draft: true },
    { x: 17, y: 69, text: 'A reclaimed timber bench does the work of a console, low so the screen sits at eye level from the sofa.', draft: true }
  ],
  'images/projects/red-coat-hill-04.jpg': [
    { x: 48, y: 75, text: 'Dining chairs in oak with leather seats — plain enough to sit under a plain table, and made for the wear of a full house.', draft: true },
    { x: 79, y: 74, text: 'Counter stools in the same oak, so the kitchen and the table read as one family of pieces.', draft: true }
  ]
};

/* ============================================================
   DRAWN NOTES — Zander's tablet markup laid over a photograph.

   Keyed by the image path exactly as written in the page's HTML,
   the same as the pins above. Where a photograph has a drawing,
   the drawing replaces the numbered pins for that photograph:
   both at once is a mess, and the drawing says it better.

     src   the ink on a transparent background, same proportions
           as the photograph it belongs to
     alt   what the drawing says, for anyone who cannot see it.
           Not optional — the notes carry meaning.

   The ink file is produced from Zander's flat tablet export by
   tools/extract_ink.py. Nothing is loaded until a visitor turns
   the notes on, so these cost nothing to a visitor who doesn't.

   *** SAMPLE CONTENT (2026-09-21) ***
   Drawn to imitate a whiteboard pen so the feature can be judged.
   Replace with Zander's own marks.
   ============================================================ */
AA.drawings = {
  'images/projects/pond-house-06.jpg': {
    draft: true,
    src: 'images/annotations/pond-house-06-ink.png',
    alt: "Architect's notes drawn over the exterior: the planted roof circled, " +
         'with a note that the mass disappears from the marsh; an arrow to the ' +
         'untreated cedar, left to silver; and a brace under the piers, noting ' +
         'that the house sits on helical piles and can move uphill.'
  },
  'images/projects/pond-house-22.jpg': {
    draft: true,
    src: 'images/annotations/pond-house-22-ink.png',
    alt: "Architect's notes drawn over the covered porch: the skylights circled, " +
         'noted as shade without gloom; the marsh underlined, with the porch ' +
         'named as the midground; and an arrow to the sliding doors, which ' +
         'stack away so the room becomes the deck.'
  }
};
