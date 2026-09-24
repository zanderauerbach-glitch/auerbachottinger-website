# Auerbach Architecture Portfolio Website
## Project Reference — Claude Code Context File

This file is automatically read by Claude Code at the start of every session.
It gives Claude full context so you never have to re-explain the project.

---

## Who You Are

**Zander Auerbach** — Founder & Partner, Auerbach Ottinger Architects
- Email: zander@auerbacharchitecture.com
- Partner: Emily Ottinger (emily@auerbacharchitecture.com)
- Phone: 917 991 8533
- Live site: https://auerbacharchitecture.com
- Firm public name: **Auerbach Architecture** (used everywhere on the site)

Arlin Ladue also works on the site, usually at a terminal. When Zander is the
one asking, keep explanations non-technical — he manages the site by talking to
Claude, not by coding.

---

## How the Site Works

The site is **live** — a static site hosted on **GitHub Pages** with the custom
domain **auerbacharchitecture.com**. It replaced the old Squarespace site at
auerbachottinger.com. Do not use or suggest Netlify.

- GitHub repo: https://github.com/zanderauerbach-glitch/auerbachottinger-website — branch `master`
- Local files: `C:\Users\zande\auerbachottinger-website\` on Zander's machine

### Publishing

**Pushing to `master` makes changes live within a minute or two.** Pages is set
to **GitHub Actions**, so `.github/workflows/pages.yml` builds the site and
publishes it on every push to `master`. You can watch it under the repo's
Actions tab; a red run means nothing was published and the old site stays up.

The workflow does **not** publish the repository as it stands. It builds the
pages, then assembles a `_site` folder holding only the website — leaving out
this file, `tools/`, `src/`, `content/` and `.github/` — and refuses to publish
if any of them reappear, if `index.html` is missing, or if `CNAME` is not
`auerbacharchitecture.com`.

- **`CNAME` must stay, containing exactly `auerbacharchitecture.com`.** It is
  what keeps the site on the firm's domain.
- **The repository is public.** Everything committed here can be read by anyone,
  whether or not the website shows it. Client names and addresses, prices,
  drawing sets with title blocks, and anything about where people live do not
  go in this repository at all.

A staging copy exists for trying things out before they go live:
`arlinladue/auerbacharchitecture-staging`, previewed at
https://arlinladue.github.io/auerbacharchitecture-staging/. It also holds the
firm's private working files (the marketing model, photo review notes, project
briefs), which is why they are not in this repository.

---

## The project pages are generated — do not edit them by hand

**The single most important thing in this file.** The project pages
(`pond-house.html`, `calebs-pond.html`, …) and the home page are **built by
Eleventy from `content/projects/*.json`**. They do not exist as files in the
repository. Editing a built `.html` appears to work and is thrown away by the
next build.

- `content/projects/<slug>.json` — the source of truth for a project: its card,
  its schema, its page copy, its hero and gallery.
- `content/taxonomy.json` — the type, status and region vocabularies, one copy.
- `content/offices.json` — the two offices shown on the map.
- `src/*.njk` — the templates. `src/index.njk` is the home page,
  `src/project.njk` every project page, `src/data-projects.njk` builds
  `data/projects.js` for the filters, the map and the journal.
- Every *other* `.html` in the repository (about, contact, FAQ, the service and
  location pages) is hand-written and copied through untouched. `.eleventy.js`
  works out which is which by subtraction, so a generated page can never be
  shadowed by a stale source file.

Nunjucks autoescaping is **off**; the `t` and `a` filters do the escaping, to
match what the hand-written pages already did. `npm run lint` fails the build if
any `{{ … }}` in a template is missing one. Do not turn autoescaping back on
without removing the filters, or everything gets escaped twice.

Regions nest. `content/taxonomy.json` has `REGION_WITHIN`, which records that
`vineyard` sits inside `massachusetts`, so filtering the portfolio by
Massachusetts finds the island projects too. Each project still records exactly
one region — the containment is declared once and expanded at build time, which
is what keeps the map from listing a project twice.

Map pins are town-level, never a house. An office at a public business address
is pinned exactly; any other office is pinned at town level like the projects.

---

## Checking your work

`npm ci` once, then `npm run serve` to see the site at http://localhost:8080.

`npm run check` — lint, then the documented-commands check, then a build, then
`compare`. It must exit 0 before anything is pushed to `master`.

`compare` rebuilds the site and compares every page against the commit in
`tools/build/BASELINE` as a browser would see it (elements, attributes,
collapsed text, JSON-LD as parsed objects), so source formatting is not
mistaken for a change. A difference is a real difference.

Differences that are *meant* live in `tools/build/ACCEPTED.json`, each against a
fingerprint of the exact lines that differ, with a written reason. Any other
difference on the same page still fails, and an entry for a page that has
stopped differing fails too — so the list cannot fill up with exemptions nobody
rechecks. `npm run compare:accept` regenerates it and refuses to be useful until
you write the reason by hand.

The browser suites are separate because they need Playwright's Chromium:
`npm run filters:test` (the portfolio filters), `npm run map:test` (no two
project names on the map may share pixels), `npm run studio:test` (the studio).

---

## The studio — how content gets edited

`npm run studio` → <http://127.0.0.1:4000>. A local Node app for words,
photographs and a draft layout. It writes straight to `content/projects/*.json`
and can commit and push from the browser — **and in this repository a push to
`master` is live.**

It listens on `127.0.0.1` only and has **no login**. Never bind it to a public
address. Listening locally does not stop a web page open in the same browser
from sending it requests, so close other tabs while it is running, and stop it
when you are done. One editor at a time.

`npm run studio:scan` lists what is in a project's photo library.
`npm run studio:tags` reads the coloured Finder tags on the originals and turns
them into stars — macOS only, because the tags live in an extended attribute
that does not sync through Dropbox. It reports and writes nothing without
`--write`.

---

## Design System

- **Fonts:** Cormorant Garamond (headings, serif) + Inter (body, sans-serif) via Google Fonts
- **Colors:** White background `#ffffff`, dark text `#1c1c1c`, warm neutral accents `#c8c2b8`
- **Style:** Minimalist, elegant, lots of whitespace — matches the firm's aesthetic
- **Hero:** auto-cycling slideshow with fade transitions
- **Tagline:** "Light on the land."

---

## SEO / AEO (done so far)

- Schema markup (structured data) on key pages
- FAQ page, 5 service pages, 2 location pages targeting search queries
- `sitemap.xml` for search engines — add a page to it when you add a page to the site
- Google Search Console verification tag added (June 2026)

---

## How to Add Photos

1. Drop image files into `images/projects/` (or say where they are in Dropbox)
2. Add them to the project's gallery — in the studio, or in
   `content/projects/<slug>.json`
3. Run `npm run check`, then push to `master`; the site updates in a minute or two

**Naming convention:** `pond-house-01.jpg` style for projects; `<project>-hero.jpg` for each project's hero image.

No sheet from a drawing set goes on the site until its title block is cropped or
blanked, and no photograph that shows people's faces or a client's private
papers.

**Dropbox photo source:** `C:\Dropbox\03_OPERATIONS, MKTING, BD\MARKETING\PROJECT IMAGES\`

| Website project | Dropbox folder |
|---|---|
| Pond House | CHAPPY |
| Carriage House | BROOKLINE |
| Further Lane | FURTHER LANE / CHRIS FOSTER PHOTOGRAPHY / SELECTED |
| Hidden House | HIDDEN HOUSE - PENNYWISE |
| Tisbury | TISBURY - OBED DAGGETT (renderings) |
| Cobbossee | COLONY LANE |

---

## Brand Voice

- Write plainly and specifically: what the site is, what was built, what it is
  made of, what you see from inside. Zander's own phrasing from site visits beats
  polished marketing prose — copy written in a generic "refined" register was
  rejected as sounding machine-written.
- Audience: high-end residential clients, institutions, publications
- Key themes: nature integration, sustainability, light, materiality, restraint
- Press: Architectural Record (Pond House, Nov 2024)

---

## Future Goals (not yet built)

- Lead generation agent
- Connect Google Drive so Claude can read brand docs, press, and project write-ups
- Ongoing SEO monitoring via Google Search Console

---

## Common Tasks (Just Say These to Claude)

- *"Add [photo filename] to the [project name] page"* — edits the project's JSON
- *"Update the Tisbury project description to say..."* — edits `content/projects/tisbury.json`
- *"Add a new project called [name] in [location]"* — a new `content/projects/<slug>.json`
- *"Change the hero tagline to..."* — `src/index.njk`
- *"Push the latest changes to GitHub"* — after `npm run check` passes; this makes them live
- *"What does my site look like right now?"*
