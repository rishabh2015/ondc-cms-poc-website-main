#!/usr/bin/env node
/* Import the Network Participant directory from the participants team's CSVs.
 * ===========================================================================
 * The live ondc.org page fetches three CSVs in the browser and parses them on
 * every page view. That cannot work here for two reasons:
 *
 *   1. CloudCannon has to be able to EDIT a participant — change a contact,
 *      swap a logo, delete a row. A CSV fetched at runtime is not editable
 *      content, it is a file nobody in the CMS can see.
 *   2. Bookshop re-renders the section in the browser while an editor types.
 *      A section whose rows arrive from fetch() renders empty in the editor.
 *
 * So the CSVs are converted ONCE, here, into src/_data/network_participants.json
 * — a normalised, CMS-shaped database. From then on the JSON is the source of
 * truth and this script is only re-run when the participants team hands over a
 * fresh CSV drop.
 *
 *   node scripts/import-network-participants.js <path-to-ondc.org-checkout>
 *
 * It rewrites src/_data/network_participants.json and reports which brand logo
 * files are referenced so they can be copied into images/np-logos/.
 *
 * Everything the browser used to do at runtime — label canonicalisation,
 * splitting the contact blob, giving bare domains a scheme, working out the
 * initials for a missing logo — happens here instead. What lands in the JSON
 * is already in the shape the page renders and the CMS edits.
 * =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.argv[2];

if (!SRC) {
  console.error('usage: node scripts/import-network-participants.js <path-to-ondc.org-checkout>');
  process.exit(1);
}

/* ── CSV ─────────────────────────────────────────────────────────────────
 * RFC4180 enough for this data: quoted fields carry commas AND newlines (the
 * Contact column is a three-line blob) and "" is a literal quote.
 * Row 0 of every one of these files is an instruction banner for whoever edits
 * the sheet ("Add in alphabetical order by brand name"), NOT data. Row 1 is
 * the real header. */
function parseCsv(text) {
  const out = [];
  let row = [], field = '', quoted = false;
  let src = String(text || '');
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c !== '"') { field += c; continue; }
      if (src[i + 1] === '"') { field += '"'; i++; continue; }
      quoted = false;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); out.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field || row.length) { row.push(field); out.push(row); }
  return out;
}

function toObjects(grid) {
  if (grid.length < 2) return [];
  const headers = grid[1].map((h) => String(h).trim());
  const rows = [];
  for (let i = 2; i < grid.length; i++) {
    const cells = grid[i];
    if (!cells.some((c) => String(c).trim())) continue;        // blank filler row
    const obj = {};
    headers.forEach((h, j) => { obj[h] = String(cells[j] == null ? '' : cells[j]).trim(); });
    rows.push(obj);
  }
  return rows;
}

/* ── the official taxonomy ───────────────────────────────────────────────
 * Transcribed from the participants team's filters sheet, in sheet order.
 * It ships as src/_data/np_categories.json so the CMS can both offer it as a
 * picker and draw the filter tree from it. */
const TAXONOMY = [
  ['Retail', ['Grocery', 'Food & Beverage', 'Fashion', 'Beauty & Personal Care',
    'Electronics', 'Appliances', 'Home & Decor', 'Health & Wellness',
    'Autoparts & Components', 'Hardware and Industrial',
    'Building & Construction Supplies', 'Chemicals', 'eB2B', 'Inventory Less',
    'Gift card']],
  ['Credit', ['Business loan', 'Personal Loan', 'Credit Cards', 'Gold Loan']],
  ['Insurance', ['Health Insurance', 'Marine Insurance', 'Motor Insurance',
    'Micro Transit Insurance']],
  ['Unreserved Ticket Booking', ['Cabs/Auto', 'Metro', 'Bus']],
  ['Reserved Ticket Booking', ['Flights']],
  ['Accommodation Booking', ['Accommodation Booking']],
  ['Experiences', ['Culture & Heritage', 'Specialty Events', 'Sporting & Outdoor',
    'Concert', 'Food & Dining', 'Comedy', 'Dance', 'Literary Events', 'Museum',
    'Restaurants', 'Tours & Sightseeing']],
  ['Investments', ['Mutual Funds']],
  ['Logistics', ['Logistics']],
  ['Other', ['Agriculture', 'Equipment Hiring', 'Work Opportunities (ONEST)',
    'Learning Experiences (ONEST)', 'Infra Services',
    'Appliance Repair Services', 'Personal Care Services']],
];

/* What the CSVs write -> what the taxonomy calls it. */
const LABEL_MAP = {
  'F&B': 'Food & Beverage',
  'Food & Beverages': 'Food & Beverage',
  'BPC': 'Beauty & Personal Care',
  'Home & Kitchen': 'Home & Decor',
  'Mutual Fund': 'Mutual Funds',
  'Retail B2B': 'eB2B',
  'Gift Card': 'Gift card',
  'Auto Components & Accessories': 'Autoparts & Components',
  'Speciality Events': 'Specialty Events',
  'Sporting Events': 'Sporting & Outdoor',
  /* FinAGG lends working capital to MSMEs, so its "Credit Line" is the
     taxonomy's Business loan rather than a consumer credit line. */
  'Credit Line': 'Business loan',
  'Retail (B2C)': 'Retail',
  'Retail (B2B)': 'eB2B',
  'Logistics (B2C)': 'Logistics',
  'Investment': 'Investments',
  'Ride Hailing': 'Cabs/Auto',
};

/* Not domains, so they never become a filter option or a printed chip.
   "Others" is a filler cell; RSP and IGM are TSP service qualifiers that the
   Role column already states on the very same rows. */
const IGNORED = new Set(['Others', 'RSP (Only for TSP)', 'IGM (Only for TSP)']);

/* Field names are deliberately long. `_inputs` at the top of
   cloudcannon.config.yml is keyed by field NAME across every data file and
   page, so a role written as { value, short, pill, full } would pick up the
   labels the home page's figures and hero pills already claim for `value` and
   `pill` — "Number" and "Tab name" — in the sidebar. */
const ROLES = [
  { role_value: 'Buyer NP', role_key: 'BNP', role_label: 'Buyer NP', role_full: 'Buyer Network Participant' },
  { role_value: 'Seller NP', role_key: 'SNP', role_label: 'Seller NP', role_full: 'Seller Network Participant' },
  { role_value: 'Technology Service Provider (TSP)-Buyer', role_key: 'TSP-B', role_label: 'Buyer side', role_full: 'Technology Service Provider, buyer side' },
  { role_value: 'Technology Service Provider (TSP)-Seller', role_key: 'TSP-S', role_label: 'Seller side', role_full: 'Technology Service Provider, seller side' },
  { role_value: 'Technology Service Provider (TSP)-RSF', role_key: 'TSP-RSF', role_label: 'Reconciliation & Settlement', role_full: 'Technology Service Provider, Reconciliation and Settlement Framework' },
  { role_value: 'Technology Service Provider (TSP)-IGM', role_key: 'TSP-IGM', role_label: 'Issue & Grievance Management', role_full: 'Technology Service Provider, Issue and Grievance Management' },
];

function canon(value) {
  const v = String(value || '').trim();
  return Object.prototype.hasOwnProperty.call(LABEL_MAP, v) ? LABEL_MAP[v] : v;
}

function splitList(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/* Links are recorded inconsistently — "https://1rsmeal.com/" sits next to bare
   "nammayatri.in" and "Avysh.com". A bare domain with no scheme would resolve
   relative to the page, so it has to be given one. */
function linkHref(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^(https?:|mailto:)/i.test(v)) return v;
  return 'https://' + v.replace(/^\/+/, '');
}

/* Most participant names are registered company names, so the tail is usually
   a legal suffix. Dropping it keeps "Ecosyz Core Solutions Pvt Ltd" as ES
   rather than EL. Mirrors js/ondc/logo-fallback.js, which does the same for
   logos that 404 at runtime. */
const LEGAL_SUFFIX = /^(private|pvt|limited|ltd|llp|inc|incorporated|corp|corporation|company|co|plc|and|&)\.?$/i;
function initialsOf(name) {
  const words = String(name || '').trim().split(/[\s.,]+/).filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIX.test(words[words.length - 1])) words.pop();
  if (!words.length) return 'NP';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/* The Contact column is one blob:
     Business SPOC: <name>\nEmail ID: <email>\nPhone Number: <phone>
   The page prints the name on one line and turns the email and phone into
   actions, so the three are split out here into fields the CMS can edit one
   at a time. */
function parseContact(blob) {
  const out = { spoc: '', email: '', phone: '' };
  String(blob || '').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t) return;
    const m = t.match(/^([^:]+):\s*(.*)$/);
    const label = m ? m[1].trim() : '';
    const value = (m ? m[2] : t).trim();
    if (!value) return;
    if (/email/i.test(label) && value.includes('@')) out.email = value;
    /* A phone column carrying "0" is a placeholder, not a number: left in it
       would ship a tel: link that dials nothing. */
    else if (/phone|contact\s*(no|number)/i.test(label) && value.replace(/\D/g, '').length >= 6) out.phone = value;
    else if (!out.spoc && !m) out.spoc = value;
    else if (!out.spoc && /spoc|name|contact person/i.test(label)) out.spoc = value;
  });
  return out;
}

/* ── logos ───────────────────────────────────────────────────────────────── */
const logoMap = new Map();
JSON.parse(fs.readFileSync(path.join(SRC, 'public/assets/data/np-logo-map.json'), 'utf8'))
  .forEach((e) => { if (e && e.brand) logoMap.set(e.brand, e.brand_logo); });

/* basename -> the path to copy it from, relative to the checkout. The map
   records most logos as a bare filename under legacy/np_logos, but thirteen
   of them as a full path into a sibling legacy folder (buyer-apps,
   complaints). Both land in images/np-logos/ here under the same basename, so
   the site has exactly one brand-logo folder. */
const neededLogos = new Map();

function logoFor(brand) {
  const raw = String(logoMap.get(brand) || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;              // already hosted elsewhere
  const file = raw.split('/').pop();
  const from = raw.startsWith('/')
    ? raw.replace(/^\//, '')
    : 'public/assets/legacy/np_logos/' + raw;
  if (!neededLogos.has(file)) neededLogos.set(file, from);
  return '/images/np-logos/' + file;
}

/* ── row -> participant ────────────────────────────────────────────────────
 *
 * The three sheets agree on Brand Name, Role, Contact and Link, and disagree
 * on the other two: the network files write "Live Categories" and "Technology
 * Service Provider", the ecosystem file writes "Category" and "Live NP
 * supported". Both of those land in the SAME two fields here — `categories`
 * and `enabled_by` — so every directory renders from one row shape and the
 * wording that differs ("Enabled by" vs "Live NPs supported") is a label on
 * the section, edited in the CMS, rather than a second code path. */
function toParticipant(row, columns) {
  const name = String(row['Brand Name'] || '').trim();
  const contact = parseContact(row.Contact);
  const categories = [];
  const seen = new Set();
  splitList(row[columns.category]).forEach((raw) => {
    if (IGNORED.has(raw.trim())) return;
    const c = canon(raw);
    if (seen.has(c)) return;
    seen.add(c);
    categories.push(c);
  });

  return {
    name,
    logo: logoFor(name),
    initials: initialsOf(name),
    roles: splitList(row.Role),
    categories,
    enabled_by: String(row[columns.enabled_by] || '').trim(),
    spoc: contact.spoc,
    email: contact.email,
    phone: contact.phone,
    website: linkHref(row.Link),
  };
}

const NETWORK_COLUMNS = { category: 'Live Categories', enabled_by: 'Technology Service Provider' };
const ECOSYSTEM_COLUMNS = { category: 'Category', enabled_by: 'Live NP supported' };

function loadList(file, columns) {
  const text = fs.readFileSync(path.join(SRC, 'public/assets/ondc-participants', file), 'utf8');
  return toObjects(parseCsv(text)).map((row) => toParticipant(row, columns)).filter((p) => p.name);
}

const key = loadList('Key_network_participants.csv', NETWORK_COLUMNS);
const integrated = loadList('integrated_network_particpants.csv', NETWORK_COLUMNS);
const ecosystem = loadList('ecosystem_participants.csv', ECOSYSTEM_COLUMNS);

/* Alphabetical on the way in as well as at build time. The build is what
   guarantees it — a row added in the CMS lands in its right place without
   anyone thinking about it — but shipping the file already sorted means the
   JSON a human opens reads the same way the page does. */
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

const categories = [];
TAXONOMY.forEach(([parent, children]) => {
  categories.push({ name: parent, parent: '' });
  children.forEach((child) => {
    /* Logistics and Accommodation Booking are each their own single child in
       the sheet; listing the child again under the same name would draw the
       row twice. */
    if (child !== parent) categories.push({ name: child, parent });
  });
});

function write(file, data) {
  const p = path.join(ROOT, 'src/_data', file);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
  console.log('wrote', path.relative(ROOT, p));
}

write('network_participants.json', {
  key: key.slice().sort(byName),
  integrated: integrated.slice().sort(byName),
});
/* Its own file, not a third list inside the one above: the two directories are
   maintained by different people, and keeping them apart means deleting an
   ecosystem participant never rewrites the network file — smaller diffs, and
   no merge conflict when both are edited the same afternoon. Wrapped in an
   object rather than written as a bare array so the CMS has a key to hang the
   "Ecosystem Participants" label and the add/delete controls on. */
write('ecosystem_participants.json', { participants: ecosystem.slice().sort(byName) });
write('np_categories.json', { categories });
write('np_roles.json', { roles: ROLES });

/* ── logo report ─────────────────────────────────────────────────────────── */
const dest = path.join(ROOT, 'images/np-logos');
let copied = 0, absent = [];
[...neededLogos].forEach(([file, from]) => {
  const target = path.join(dest, file);
  if (fs.existsSync(target)) return;
  const source = path.join(SRC, from);
  if (!fs.existsSync(source)) { absent.push(from); return; }
  fs.copyFileSync(source, target);
  copied++;
});
console.log('\nparticipants: %d key, %d integrated, %d ecosystem', key.length, integrated.length, ecosystem.length);
console.log('logo files referenced: %d, copied in: %d', neededLogos.size, copied);
if (absent.length) console.log('\nlogo files the checkout does not have (these brands fall back to an initials monogram):\n  ' + absent.sort().join('\n  '));

/* Categories the CSVs used that the taxonomy has no row for. They still filter
   and still print — they land under "Other" — but a label showing up here is
   usually a typo in the sheet or a genuinely new category worth adding to
   np_categories.json. */
const known = new Set(categories.map((c) => c.name));
const unknown = new Set();
[...key, ...integrated, ...ecosystem].forEach((p) => p.categories.forEach((c) => { if (!known.has(c)) unknown.add(c); }));
if (unknown.size) console.log('\ncategories not in the taxonomy (they fall under "Other"):\n  ' + [...unknown].sort().join('\n  '));
