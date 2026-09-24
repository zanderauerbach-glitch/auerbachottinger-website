#!/usr/bin/env python3
"""
One-time conversion: read the 16 project pages as they stand and write each
one out as a content file.

    python3 tools/build/extract.py

After this the pages are generated from content/projects/*.json by Eleventy,
and tools/review/content.py is no longer how the site is edited.

This reads three places that each hold part of a project today, which is the
whole reason the conversion is worth doing:

    <slug>.html        the page itself, plus its JSON-LD block
    data/projects.js   the map entry and the card fields
    index.html         a second, hand-kept copy of the card

They have to agree. Where they do not, this refuses to guess.
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'content', 'projects')

sys.path.insert(0, os.path.join(ROOT, 'tools', 'review'))
import content as C  # noqa: E402  — reuse the proven page parser

RE_SCHEMA = re.compile(
    r'<script type="application/ld\+json">\s*(\{.*?\})\s*</script>', re.S)
RE_CARD = re.compile(
    r'<a href="([a-z0-9-]+\.html)" class="project-card"'
    r' data-types="([^"]*)" data-status="([^"]*)" data-region="([^"]*)">', re.S)
RE_TYPES = re.compile(r"\btypes: \[([^\]]*)\]")
# The status pill's class sits on the <li>, which content.py never had to store
# because it replaced only the text between the tags. A template has to write
# the whole element, so it has to know.
RE_DETAIL_CLS = re.compile(
    r'<li><span class="meta-key">(.*?)</span>'
    r'<span class="meta-val([^"]*)">(.*?)</span></li>', re.S)
# The description is not always a heading and then paragraphs: Runner Road has
# an <h3> partway down. Keep the blocks in the order the page has them.
RE_DESC = re.compile(r'<div class="project-description">(.*?)\n      </div>', re.S)
RE_DESC_BLOCK = re.compile(r'<(h2|h3|p)([^>]*)>(.*?)</\1>', re.S)
RE_REGION = re.compile(r"\bregion: '([^']*)'")


def js_list(body, key_re):
    m = key_re.search(body)
    if not m:
        return []
    return [v.strip().strip("'\"") for v in m.group(1).split(',') if v.strip()]


def main():
    # A one-time conversion. Its inputs are the hand-written pages, which the
    # build replaced; once they are gone there is nothing here to read, and the
    # content files are the source of truth. Kept as the record of how they
    # were made, and to re-run against an older commit if that is ever needed.
    if not os.path.exists(os.path.join(ROOT, 'data', 'projects.js')):
        print('nothing to convert: the hand-written pages are gone, which means '
              'this has already run. content/projects/*.json is the source now.',
              file=sys.stderr)
        return 2
    site = C.extract()                       # the parsed page bodies
    projects_js = open(os.path.join(ROOT, 'data', 'projects.js'), encoding='utf-8').read()
    index = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    cards = {m.group(1): {'types': m.group(2).split(), 'status': m.group(3),
                          'region': m.group(4)} for m in RE_CARD.finditer(index)}

    os.makedirs(OUT, exist_ok=True)
    problems = []
    written = 0

    for order, pr in enumerate(site['projects']):
        slug, page = pr['slug'], pr['page']
        html = open(os.path.join(ROOT, page), encoding='utf-8').read()

        # --- the JSON-LD block, minus the parts every project shares
        m = RE_SCHEMA.search(html)
        schema = {}
        if m:
            d = json.loads(m.group(1))
            for k in ('@context', '@type', 'creator', 'name', 'url'):
                d.pop(k, None)
            schema = d
        else:
            problems.append('%s has no JSON-LD block' % page)

        # --- types and region: projects.js is the source, index.html a copy
        entry = re.search(
            r"\{\s*slug: '%s',(.*?)\}\s*,?(?=(?:\s|/\*.*?\*/)*(?:\{|\]))" % re.escape(slug),
            projects_js, re.S)
        if not entry:
            problems.append('%s is not in data/projects.js' % slug)
            continue
        body = entry.group(1)
        types = js_list(body, RE_TYPES)
        region = (RE_REGION.search(body) or [None, None])[1] if RE_REGION.search(body) else None

        card_in_grid = cards.get(page)
        if card_in_grid is None:
            # Jewelry Shop and Meadowlark have no card in the grid, correctly:
            # they have no photographs anywhere.
            pass
        else:
            if card_in_grid['types'] != types:
                problems.append('%s: types differ — projects.js %s, index.html %s'
                                % (slug, types, card_in_grid['types']))
            if card_in_grid['region'] != region:
                problems.append('%s: region differs — projects.js %r, index.html %r'
                                % (slug, region, card_in_grid['region']))
            if card_in_grid['status'] != pr['card']['status']:
                problems.append('%s: status differs — projects.js %r, index.html %r'
                                % (slug, pr['card']['status'], card_in_grid['status']))

        # the status class on each detail row
        classes = {C.dec(m.group(1)): m.group(2) for m in RE_DETAIL_CLS.finditer(html)}
        for row in pr['page_content']['details']:
            row['valueClasses'] = classes.get(row['key'], '')

        # the description, block by block, so an <h3> is not silently dropped
        m = RE_DESC.search(html)
        if not m:
            problems.append('%s has no project-description block' % page)
        else:
            # `attrs` is kept verbatim: Pond House credits earlier work in a
            # <p> carrying its own inline style, and dropping it would drop
            # the credit's formatting along with it.
            blocks = []
            for b in RE_DESC_BLOCK.finditer(m.group(1)):
                attrs = b.group(2).strip()
                style = ''
                if attrs:
                    # Pond House credits earlier work in a <p> with an inline
                    # style. That is the only attribute any description block
                    # carries; anything else has to be looked at, not guessed.
                    sm = re.fullmatch(r'style="([^"]*)"', attrs)
                    if not sm:
                        problems.append('%s: a description block carries %r, '
                                        'which the content model does not cover'
                                        % (page, attrs))
                        continue
                    style = C.dec(sm.group(1))
                blocks.append({'tag': b.group(1), 'style': style,
                               'text': C.dec(b.group(3).strip())})
            if not blocks or blocks[0]['tag'] != 'h2':
                problems.append('%s: the description does not open with an <h2>' % page)
            pr['page_content']['body'] = blocks[1:]
            pr['page_content'].pop('paragraphs', None)

        doc = {
            'slug': slug,
            'page': page,
            'order': order,          # the portfolio order, as projects.js had it
            'inGrid': card_in_grid is not None,
            'card': dict(pr['card'], types=types, region=region),
            'schema': schema,
            'page_content': pr['page_content'],
        }
        with open(os.path.join(OUT, slug + '.json'), 'w', encoding='utf-8') as f:
            json.dump(doc, f, indent=1, ensure_ascii=False)
            f.write('\n')
        written += 1

    if problems:
        print('the three copies of a project do not agree:', file=sys.stderr)
        for p in problems:
            print('  ! ' + p, file=sys.stderr)
        return 1
    print('wrote %d content files to %s' % (written, os.path.relpath(OUT, ROOT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
