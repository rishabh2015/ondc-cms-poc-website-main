#!/usr/bin/env node
/* Import the Resources knowledge base from the ondc.org checkout.
 * ===========================================================================
 * ondc.org fetches public/data/resources.json in the browser and builds all
 * nineteen Resources pages from it at runtime. The data model is already the
 * right shape for the CMS — categories, each with sections, each with items —
 * so this script copies it across rather than reshaping it, and only fixes the
 * things that are about WHERE the files live:
 *
 *   - `page` on a category is a bare filename ("resources-tech.html") because
 *     ondc.org serves these out of /pages/. Here they are at the site root, so
 *     each gains a leading slash. External categories keep their absolute URL.
 *   - an item `href` pointing at another page of the site gets the same
 *     treatment; http(s) and mailto: links are left exactly as they are.
 *   - one item points into the upstream asset tree (../public/assets/…). That
 *     file is copied into files/ and the link rewritten, so the page does not
 *     depend on an asset tree this repo does not have.
 *
 *   node scripts/import-resources.js <path-to-ondc.org-checkout>
 *
 * Re-run it when the resources team ships a new resources.json. Anything an
 * editor has since changed in the CMS is OVERWRITTEN — this is an import, not
 * a merge, so check the diff before committing.
 * =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2];
if (!SRC) {
  console.error('usage: node scripts/import-resources.js <path-to-ondc.org-checkout>');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(path.join(SRC, 'public/data/resources.json'), 'utf8'));
const categories = data.categories || [];

/* Assets the knowledge base links to that live in the upstream tree. Copied
   into files/ so the link survives without that tree. */
const ASSETS = { '../public/assets/ONDC_Posh-Policy.pdf': '/files/ONDC_Posh-Policy.pdf' };
const copied = [];
Object.entries(ASSETS).forEach(([from, to]) => {
  const source = path.join(SRC, from.replace(/^\.\.\//, ''));
  const target = path.join(ROOT, to.replace(/^\//, ''));
  if (!fs.existsSync(source)) { console.warn('asset missing upstream:', from); return; }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  copied.push(to);
});

/* A link is left alone when it already says where it points — an absolute URL,
   a mailto:, or an in-page anchor. Everything else is a page of this site that
   upstream wrote as a bare filename. */
function url(value) {
  const v = String(value == null ? '' : value).trim();
  if (!v) return '';
  if (Object.prototype.hasOwnProperty.call(ASSETS, v)) return ASSETS[v];
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(v)) return v;
  return '/' + v.replace(/^\.?\//, '');
}

/* ondc.org stores a section's prose as plain text and converts it in the
 * browser on every page view: blank lines become paragraphs, and a run-on
 * paragraph of "1. … 2. … 3. …" becomes an ordered list. That conversion
 * happens ONCE here instead, for the reason the whole build exists — the CMS
 * field is then a rich-text editor an editor can actually use, rather than a
 * textarea with a numbering convention nobody has been told about. */
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function proseHtml(text) {
  if (!text) return '';
  return String(text).split(/\n\n+/).map((para) => {
    const p = para.trim();
    if (!p) return '';
    const steps = p.split(/\s+(?=\d{1,2}\.\s+[A-Z])/);
    if (steps.length >= 3) {
      return '<ol class="res-steps">' +
        steps.map((st) => '<li>' + esc(st.replace(/^\d{1,2}\.\s+/, '').trim()) + '</li>').join('') +
        '</ol>';
    }
    return '<p>' + esc(p) + '</p>';
  }).join('');
}

let items = 0, sections = 0, rewritten = 0, prose = 0;
categories.forEach((cat) => {
  const before = cat.page;
  cat.page = cat.external ? String(cat.page || '').trim() : url(cat.page);
  if (before !== cat.page) rewritten++;
  (cat.sections || []).forEach((sec) => {
    sections++;
    if (sec.prose) { sec.prose = proseHtml(sec.prose); prose++; }
    (sec.items || []).forEach((item) => {
      items++;
      const was = item.href;
      item.href = url(item.href);
      if (was !== item.href) rewritten++;
    });
  });
});

/* ── renamed on the way in ────────────────────────────────────────────────
 * `_inputs` at the top of cloudcannon.config.yml is keyed by field NAME across
 * every data file and page at once, so upstream's names would collide with
 * fields that already mean something else on this site:
 *
 *   categories -> areas         "categories" is the participant multiselect
 *   sections   -> doc_groups    "sections" is the list of blocks on a page
 *   items      -> documents     "items" is a generic list input
 *   parent     -> parent_area   "parent" is the participant-category select
 *   blurb      -> summary       "blurb" is labelled "Footer blurb"
 *   source     -> provenance    "source" is labelled "Publication"
 *   type       -> doc_type      a bare "type" as a GLOBAL input name is a
 *                               trap waiting for the next developer
 *   note       -> group_note / doc_note
 *                               "note" is labelled "Note for editors, never
 *                               shown on the live site" — the opposite of what
 *                               these two do
 *   ref        -> doc_ref       the notification number. "ref" is far too
 *                               generic a key to own globally
 *   hideTypeChip -> hide_type_chip
 *   labelChips   -> label_chips  camelCase everywhere else here is snake_case
 *
 * Renaming here rather than scoping the inputs keeps it working whether or not
 * CloudCannon honours `_inputs` nested inside a `_structures` value, which is
 * documented for components but not something this build has verified for data
 * files. See ADDING_PAGES.md, rule 9's note on global keys. */
const areas = categories.map((cat) => {
  const area = {
    id: cat.id,
    title: cat.title,
    summary: cat.blurb || '',
    icon: cat.icon || '',
    page: cat.page || '',
    parent_area: cat.parent || '',
    hub: !!cat.hub,
    external: !!cat.external,
    /* Two display switches upstream sets per area. An area whose documents are
       all the same file type hides the type chip — a "PDF" badge on every row
       of the page says nothing, and the room is better spent on the date. An
       area whose rows carry two dates (issued on, numbered as) labels its chips,
       because two bare dates side by side read as a puzzle. */
    hide_type_chip: !!cat.hideTypeChip,
    label_chips: !!cat.labelChips,
    doc_groups: (cat.sections || []).map((sec) => ({
      title: sec.title,
      group_note: sec.note || '',
      prose: sec.prose || '',
      documents: (sec.items || []).map((item) => ({
        title: item.title,
        doc_type: item.type,
        href: item.href || '',
        lang: item.lang || '',
        doc_note: item.note || '',
        updated: item.updated || '',
        doc_ref: item.ref || '',
      })),
    })),
  };
  if (cat.source) area.provenance = cat.source;
  return area;
});

const out = path.join(ROOT, 'src/_data/resources.json');
fs.writeFileSync(out, JSON.stringify({ areas }, null, 2) + '\n');

console.log('wrote %s', path.relative(ROOT, out));
console.log('  %d categories, %d sections, %d items', categories.length, sections, items);
console.log('  %d links rewritten to site-root paths', rewritten);
console.log('  %d prose blocks converted to rich text', prose);
if (copied.length) console.log('  copied assets: %s', copied.join(', '));

/* Every internal page a category or an item points at must have a page file,
   or the knowledge base links into a 404. Reported rather than enforced: the
   page files are created by hand, and this is the list to create. */
const wanted = new Set();
categories.forEach((c) => { if (!c.external && c.page) wanted.add(c.page); });
categories.forEach((c) => (c.sections || []).forEach((s) => (s.items || []).forEach((i) => {
  if (i.href && i.href.startsWith('/') && i.href.endsWith('.html')) wanted.add(i.href);
})));
const missing = [...wanted].filter((p) => !fs.existsSync(path.join(ROOT, 'src/pages', path.basename(p, '.html') + '.liquid'))).sort();
console.log('\ninternal pages the knowledge base links to: %d', wanted.size);
if (missing.length) console.log('  no page file yet for:\n    ' + missing.join('\n    '));
