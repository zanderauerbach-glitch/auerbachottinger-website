# Auerbach Architecture Portfolio Website
## Project Reference — Claude Code Context File

This file is automatically read by Claude Code at the start of every session.
It gives Claude full context so you never have to re-explain the project.

---

## Who You Are

**Zander Auerbach** — Founder & Partner, Auerbach Ottinger Architects
- Email: zander@auerbachottinger.com
- Partner: Emily Ottinger (emily@auerbachottinger.com)
- Phone: 917 991 8533
- Live site: https://auerbacharchitecture.com
- Firm public name: **Auerbach Architecture** (used everywhere on the site)

---

## How the Site Works

The site is **live** — a custom static HTML/CSS site hosted on **GitHub Pages** with the custom domain **auerbacharchitecture.com** (CNAME file in the repo). It replaced the old Squarespace site at auerbachottinger.com.

**Publishing:** pushing to GitHub makes changes live within a minute or two. There is no separate deploy step. Do not use or suggest Netlify.

- GitHub repo: https://github.com/zanderauerbach-glitch/auerbachottinger-website
- Local files: `C:\Users\zande\auerbachottinger-website\`
- Zander manages the site by talking to Claude — no coding. Keep explanations non-technical.

---

## File Structure

```
auerbachottinger-website/
├── CLAUDE.md                       ← you are here
├── index.html                      ← home page (hero slideshow + project grid)
├── about.html                      ← Zander + Emily bios
├── contact.html                    ← contact info + office photo gallery
├── methods.html                    ← how the firm works
├── faq.html                        ← FAQ (with schema markup for AEO)
├── styles.css                      ← all visual design / layout
├── nav.js                          ← mobile menu + active link logic
├── slideshow.js                    ← hero auto-cycling slideshow
├── sitemap.xml                     ← 38 pages, for search engines
├── CNAME                           ← custom domain for GitHub Pages
│
├── Project pages:
│   pond-house.html                 ← Arch Record Nov 2024 — 29 photos
│   jericho-path.html               ← 9 photos
│   carriage-house.html             ← 8 photos
│   white-feather.html              ← 7 photos
│   colony-lane.html                ← 6 photos
│   mural-museum.html               ← 6 photos
│   tisbury.html                    ← 4 photos
│   cobbossee.html                  ← 3 photos
│   further-lane.html               ← 3 photos
│   red-coat-hill.html              ← 3 photos
│   hidden-house.html               ← 2 photos
│   runner-road.html                ← 1 photo
│   jewelry-shop.html               ← NO photos yet
│   meadowlark.html                 ← NO photos yet
│
├── Service pages (SEO):
│   residential-architecture.html
│   renovation-addition.html
│   interior-design.html
│   sustainable-architecture.html
│   historic-preservation.html
│
├── Location pages (SEO):
│   hamptons-architect.html
│   marthas-vineyard-architect.html
│
└── images/
    ├── hero/                       ← hero slideshow images
    ├── projects/                   ← project photos (e.g. pond-house-01.jpg)
    └── team/                       ← zander.jpg and emily.jpg
```

---

## Design System

- **Fonts:** Cormorant Garamond (headings, serif) + Inter (body, sans-serif) via Google Fonts
- **Colors:** White background `#ffffff`, dark text `#1c1c1c`, warm neutral accents `#c8c2b8`
- **Style:** Minimalist, elegant, lots of whitespace — matches the firm's aesthetic
- **Hero:** 5-slide auto-cycling slideshow with fade transitions
- **Tagline:** "Light on the land."

---

## SEO / AEO (done so far)

- Schema markup (structured data) on key pages
- FAQ page, 5 service pages, 2 location pages targeting search queries
- sitemap.xml covering 38 pages
- Google Search Console verification tag added (June 2026)

---

## How to Add Photos

1. Drop image files into `images/projects/` (or tell Claude where they are in Dropbox)
2. Tell Claude: *"Add the photo to the Pond House page"*
3. Claude updates the HTML and pushes to GitHub — the change is live in minutes

**Naming convention:** `pond-house-01.jpg` style for projects; `<project>-hero.jpg` for each project's hero image.

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

- Tone: refined, nature-forward, confident but not boastful
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

- *"Add [photo filename] to the [project name] page"*
- *"Update the Tisbury project description to say..."*
- *"Add a new project called [name] in [location]"*
- *"Change the hero tagline to..."*
- *"Push the latest changes to GitHub"*
- *"What does my site look like right now?"*
