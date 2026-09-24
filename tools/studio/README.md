# The studio

The backend for the site, running on your own machine.

```
npm install        # once
npm run studio     # then open http://127.0.0.1:4000
```

It reads and writes `content/projects/*.json`, rebuilds the site after every
save, shows you the real page beside what you are editing, and commits and
pushes when you say so. No server, no login, no database.

**It listens on 127.0.0.1 only.** Nothing outside this machine can reach it,
which is why it has no login. It must never be bound to a public address
without one.

## What it edits today

**Words.** The heading, the paragraphs and sub-headings, the detail rows, the
name, location, tagline and status, the map coordinates, the page title and
search description.

**Review library.** Every photograph from a project's site visit, starred and
annotated. It reads the folder where it lies — nothing is copied into the
repository, nothing is uploaded, and the originals are never written to.
Thumbnails are made once and kept in `.thumbs/`, which is not committed.

**Draft layout.** The hero and seven frames, arranged from the starred
photographs — a sketch, for settling an order before committing to it.

**Photographs.** The banner and every gallery frame: choose a photograph, cut
it to the frame's shape, set its focal point, reorder, remove, write the alt
text. This is the part that used to need Claude — every crop on Pennywise Path
and Caleb's Pond was Claude's judgement of where to cut the band.

## Cutting a photograph to a frame

Each frame on the site is a fixed shape, so a photograph has to be cut to fit:

| | size | shape |
|---|---|---|
| Banner | 2000px wide | whatever the photograph is |
| Full-width frame | 1800 × 788 | 16:7 |
| Gallery frame | 1600 × 1200 | 4:3 |

Choose a frame, press Replace, pick a photograph, drag the box and use the
slider to decide how much to keep. The file is written into `images/projects/`
and the page rebuilds.

**Enlarging is refused.** If the crop is narrower than the frame needs, the
photograph would be stretched to fit — which adds no detail and makes a soft
picture, the same thing that makes the home-page slideshow soft on a 4K
screen. The studio says so and offers a tickbox to go ahead anyway, unticked,
so taking that route is a decision rather than a click-through. Usually the
better answer is to keep more of the photograph, or to work from the full-size
library rather than the resized copies.

**Focal point.** Click a photograph in the Photographs tab to say which part
must survive when a phone squeezes the frame into one column. A crosshair
marks it; Centre puts it back. It is written as
`style="object-position:32% 64%"`, the same mechanism Squarespace uses.

**Filenames.** A frame keeps its filename when its photograph is replaced, and
a new frame takes the next free number. Order lives in the content file, so
reordering the gallery never renames a file.

## Where the photographs come from

A library is a folder of folders — Drone, Exterior, Interior — in Dropbox.

`libraries.json` names each **root** by the folder to look for. The studio
searches your home directory and each CloudStorage provider and uses what it
finds, so a Dropbox folder is located rather than guessed — the same file works
on a Mac and a PC without anyone editing it. `paths` are fallbacks tried after
that, with `~` meaning your home directory. Each project then says which
root it belongs to and where inside it, in `review/<slug>.json`:

```json
"library": { "root": "shared",
             "relative": "Marthas Vineyard/Pennywise Path/2026.08.31 Site Visit/Photos" }
```

**If the Review library tab is empty**, it tells you every path it looked in.
Correct the one that is wrong in `libraries.json` and reload. To point it
somewhere else without editing the file:

```
STUDIO_LIBRARY="/path/to/the/folder" npm run studio
```

A machine with none of the roots falls back to the resized copies under
`tools/review/build/copies` if they are there, and says so on screen so nobody
mistakes them for the full-size originals. Those copies are not committed, so a
fresh clone will not have them — the real library is the answer.

**Online-only folders.** A Dropbox folder that is not "Available Offline" holds
placeholders rather than photographs. The studio will list them and then fail to
read one, so it says what the likely cause is: right-click the folder in Finder
and choose *Make Available Offline*. In Finder, a cloud icon means online-only
and a green tick means it is really there.

A photograph's id is `<Folder>_<filename>`, which is what the marks have always
been keyed on. Changing that would orphan every star.

## Which libraries exist

```
npm run studio:scan
```

Walks every library root for a "… Site Visit/Photos" folder and says which
project claims it, which are declared but not on this machine, and which belong
to nobody. Red Coat Hill sat in Dropbox with ninety-odd photographs and no
review file for weeks because nothing looked; now something does.

To claim one, add `tools/studio/review/<slug>.json`:

```json
{ "slug": "red-coat-hill",
  "library": { "root": "shared",
               "relative": "Marthas Vineyard/Red Coat Hill/2026.08.31 Site Visit/Photos" },
  "layout": null, "marks": {} }
```

## Finder tags

Selects get a coloured tag in Finder. **Those tags do not sync through
Dropbox** — they are an extended attribute on the file, on the machine that set
them — so for a long time the only way they reached the site was somebody
screenshotting a Finder window. Caleb's Pond shows the cost: five red frames in
the Drone folder alone were never starred, because no screenshot of that folder
was ever sent.

A tool running on your machine can read them:

```
npm run studio:tags                    every project, report only
npm run studio:tags -- --write         write them
npm run studio:tags -- calebs-pond --write
```

Red is a select (5 stars), yellow a maybe (3); orange 4, green 3, blue and
purple 2, grey 1. Any other tag still counts, at one star, rather than being
dropped.

It reports first and writes only when asked. It **adds and raises, never
clears**: a photograph starred in the studio but untagged in Finder keeps its
stars, because the two are different people's opinions. `--replace` makes the
tags the whole truth instead.

macOS only, which is the point — it reads what Finder wrote. It skips a project
whose library is the resized copies, since the tags are on the originals.

## Stars, notes and layouts

One file per project in `tools/studio/review/`, holding that project's marks and
its draft layout. **In this repository they are git-ignored**: it is public, and
the notes are working notes — who is in a photograph, what cannot be shown. The
studio never commits them. They are kept in the private staging repository
(`arlinladue/auerbacharchitecture-staging`); copy the folder from there to see
the stars and the library on this machine. They used to be rows in the artifact's database; 36 marks and
2 layouts were moved across by `migrate-review.js`, which read every one back
and compared it before declaring success, and refuses to run again over a
repository that already holds marks.

Files rather than a database means no service to be up, and — in the staging
repository, where they are committed — git history and `git diff` on a single
star.

## How a change reaches the site

1. Type. Three quarters of a second after you stop, it saves.
2. The server writes the content file and runs the build.
3. The preview reloads showing the real page.
4. Commit, with a line about what changed.
5. Push. The site updates a minute or two after the change reaches `master`.

Every save is a file on disk and every commit is in the history, so anything
can be read back or undone with git.

## Two machines, one repository

Arlin is on a Mac, Zander on a PC. Each runs the studio against their own
clone; GitHub is how the two stay in step. One person edits at a time.

The studio refuses to commit when the remote has commits this clone does not,
and says so, rather than letting a push fail halfway.

`libraries.json` records where each person keeps the photographs, because the
same library has a different path on each machine. The studio uses whichever
one exists where it is running. Those paths only live under `tools/`, which no
build publishes. The repository itself is public, though, so they name shared
folders only — nothing that is not already a Dropbox folder name.

## Guardrails

- Only a known list of fields can be written. `slug`, `page`, `order` and the
  gallery are never touched, so a bug here cannot quietly rewrite a part of
  the file nobody was editing. The test checks this.
- Map coordinates are rounded to four decimals on save. The map page is
  public and the houses are private: four decimals is a village, six is a
  front door.
- The preview serves `_site` and nothing above it.

## Tests

```
npm run studio:test
```

Drives a real browser: edits a real content file, checks the edit reaches
disk, the site rebuilds, the preview shows it, paragraphs can be added and
removed, the gallery and identifiers are untouched, coordinates are rounded,
no console errors, and the preview cannot serve files outside `_site`. It puts
the file back afterwards whether it passes or fails.

It needs the review notes and the resized photo copies, which are not committed
here — copy `tools/studio/review/` and `tools/review/build/copies/` from the
staging repository first, or it stops and says so.
