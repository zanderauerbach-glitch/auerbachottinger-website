# Auerbach Ottinger Portfolio Website
## Project Reference — Claude Code Context File

This file is automatically read by Claude Code at the start of every session.
It gives Claude full context so you never have to re-explain the project.

---

## Who You Are

**Zander Auerbach** — Founder & Partner, Auerbach Ottinger Architects
- Email: zander@auerbachottinger.com
- Partner: Emily Ottinger (emily@auerbachottinger.com)
- Phone: 917 991 8533
- Current site: auerbachottinger.com (on Squarespace — migrating away)

---

## What We're Building

A custom static HTML/CSS website to replace Squarespace, hosted on Netlify, managed via GitHub, and continuously updated through Claude Code. The goal is a site Zander can update just by talking to Claude — no coding required.

**Future goals (not yet built):**
- SEO and AEO optimization agents
- Lead generation agent
- Connect Google Drive so Claude can read brand docs, press, and project write-ups

---

## Project Location

All website files live at:
```
C:\Users\zande\auerbachottinger-website\
```

To work on the site, open Claude Code and navigate to that folder.

---

## File Structure

```
auerbachottinger-website/
├── CLAUDE.md              ← you are here
├── index.html             ← home page (hero slideshow + project grid)
├── about.html             ← Zander + Emily bios
├── contact.html           ← contact info + newsletter signup
├── styles.css             ← all visual design / layout
├── nav.js                 ← mobile menu + active link logic
├── slideshow.js           ← hero auto-cycling slideshow (5 slides, 5s interval)
├── tisbury.html
├── hidden-house.html
├── further-lane.html
├── pond-house.html        ← featured in Architectural Record Nov 2024
├── cobbossee.html
├── mural-museum.html
├── jewelry-shop.html
├── carriage-house.html
├── meadowlark.html
└── images/
    ├── hero/              ← drop hero-1.jpg through hero-5.jpg here
    ├── projects/          ← project photos (e.g. pond-house-01.jpg)
    └── team/              ← zander.jpg and emily.jpg
```

---

## Design System

- **Fonts:** Cormorant Garamond (headings, serif) + Inter (body, sans-serif) via Google Fonts
- **Colors:** White background `#ffffff`, dark text `#1c1c1c`, warm neutral accents `#c8c2b8`
- **Style:** Minimalist, elegant, lots of whitespace — matches the firm's aesthetic
- **Hero:** 5-slide auto-cycling slideshow with fade transitions, arrows, dot nav, touch swipe

---

## How to Add Photos

1. Drop image files into the correct `images/` subfolder
2. Tell Claude: *"Add the photo hero-1.jpg to the hero slideshow"* or *"Add pond-house-01.jpg to the Pond House page"*
3. Claude will update the HTML — no coding needed

**Hero image format:** Landscape, minimum 1600px wide, JPG, under 1MB each
**Naming convention:** `hero-1.jpg` through `hero-5.jpg` for hero; `pond-house-01.jpg` for projects

---

## Projects

| Project | Location | Status |
|---|---|---|
| Tisbury | Martha's Vineyard, North Shore | In Progress |
| Hidden House | Martha's Vineyard | In Progress |
| Further Lane | East Hampton, NY | Under Administration |
| Pond House | Martha's Vineyard | Complete — Arch Record Nov 2024 |
| Cobbossee Cabins | Maine | Complete |
| Mural Museum | Regional | Documentation Phase |
| Jewelry Shop | Wellesley, MA | Under Administration |
| Carriage House | Brookline, MA | Under Administration |
| Meadowlark | Regional | Documentation Phase |

---

## Going Live (Not Done Yet)

**Remaining steps to publish the site:**
1. Create GitHub account at github.com (use zander@auerbachottinger.com)
2. Create Netlify account at netlify.com (connect with GitHub)
3. Tell Claude: *"Push the site to GitHub"* — Claude does the rest
4. In Netlify: connect the GitHub repo → site goes live on a free URL
5. Point auerbachottinger.com domain to Netlify (takes ~10 min)

**Domain info:** auerbachottinger.com renews September 2026 — plenty of time to migrate carefully.

---

## MCP Servers (Connected Tools)

These give Claude access to external services. Stored in `C:\Users\zande\.claude\settings.json`.

| MCP | Purpose | Status |
|---|---|---|
| GitHub | Push code, manage repo, publish site updates | Registered — needs OAuth login via `/mcp` |
| Google Drive | Read brand docs, project write-ups, press | Registered — needs Google credentials |

**To authenticate GitHub:** Type `/mcp` in Claude Code, select github, click Authorize in browser.

---

## Brand Voice (Fill This In)

*Tell Claude about your brand and he'll write in your voice:*

- Tone: refined, nature-forward, confident but not boastful
- Audience: high-end residential clients, institutions, publications
- Key themes: nature integration, sustainability, light, materiality, restraint
- Press: Architectural Record (Pond House, Nov 2024)

*Add more here as you develop it — or share a Google Doc and Claude will read it directly.*

---

## Common Tasks (Just Say These to Claude)

- *"Add [photo filename] to the [project name] page"*
- *"Update the Tisbury project description to say..."*
- *"Add a new project called [name] in [location]"*
- *"Change the hero tagline to..."*
- *"Push the latest changes to GitHub"*
- *"What does my site look like right now?"*
