#!/usr/bin/env node
/* Generate the TinaCMS field definitions.
 * ===========================================================================
 * Tina needs every field of every section type written out as a schema. This
 * site already describes its sections in three places, so this script reads
 * all three instead of keeping a fourth copy by hand:
 *
 *   1. component-library/components/<name>/<name>.bookshop.yml
 *        the label, the blueprint (the starting values of a new section) and
 *        the component's `_inputs` (field labels, comments, select options,
 *        image pickers).
 *   2. cloudcannon.config.yml
 *        the global `_inputs` and `_structures`, which supply the labels of
 *        fields shared by many sections (buttons, links, headings…).
 *   3. the content itself — every section in src/pages/*.md and every file in
 *        src/_data — so a field that exists in a page but in no blueprint is
 *        still in the schema. That matters: Tina drops fields it does not know
 *        about when it saves a document, so a missing field means lost content.
 *
 * Types are inferred from the values: true/false is a boolean, a number is a
 * number (unless some instance holds a string), a list of objects is a list of
 * objects with the union of their fields, and so on. `_inputs` only refines a
 * string field (image, textarea, select) and supplies labels.
 *
 *   node scripts/tina-schema.js        (npm run tina:schema)
 *
 * Writes tina/generated/sections.json and tina/generated/data.json. Re-run it
 * after adding a component or changing a blueprint, and commit the result.
 * =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const COMPONENTS = path.join(ROOT, 'component-library/components');
const PAGES = path.join(ROOT, 'src/pages');
const DATA = path.join(ROOT, 'src/_data');
const OUT = path.join(ROOT, 'tina/generated');

/* The data files Tina edits. Each must be a JSON object at its root — Tina
   cannot edit a file whose root is a bare array. */
const DATA_COLLECTIONS = {
  site: 'Site settings',
  network_participants: 'Network Participants',
  ecosystem_participants: 'Ecosystem Participants',
  buyer_apps: 'Buyer Apps',
  np_categories: 'Participant categories',
  np_roles: 'Participant roles',
  resources: 'Resources library',
};

const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/* ── inference ───────────────────────────────────────────────────────────── */

/* A node is { kind, fields?, item? }. kind is one of
   unknown | string | number | boolean | object | list. A list has `item`, the
   node describing its elements; an object has `fields`, a Map of key → node. */
const unknown = () => ({ kind: 'unknown' });

function infer(value) {
  if (value === null || value === undefined) return unknown();
  if (Array.isArray(value)) {
    const item = value.reduce((acc, v) => merge(acc, infer(v)), unknown());
    return { kind: 'list', item };
  }
  if (value instanceof Date) return { kind: 'string' };
  if (typeof value === 'object') {
    const fields = new Map();
    for (const [k, v] of Object.entries(value)) fields.set(k, infer(v));
    return { kind: 'object', fields };
  }
  if (typeof value === 'boolean') return { kind: 'boolean' };
  if (typeof value === 'number') return { kind: 'number' };
  return { kind: 'string' };
}

function merge(a, b, where = '') {
  if (a.kind === 'unknown') return b;
  if (b.kind === 'unknown') return a;
  if (a.kind === b.kind) {
    if (a.kind === 'list') return { kind: 'list', item: merge(a.item, b.item, where + '[]') };
    if (a.kind === 'object') {
      const fields = new Map(a.fields);
      for (const [k, v] of b.fields) fields.set(k, fields.has(k) ? merge(fields.get(k), v, where + '.' + k) : v);
      return { kind: 'object', fields };
    }
    return a;
  }
  const scalars = ['string', 'number', 'boolean'];
  if (scalars.includes(a.kind) && scalars.includes(b.kind)) return { kind: 'string' };
  throw new Error(`Incompatible values at ${where || '(root)'}: ${a.kind} and ${b.kind}. ` +
    'Tina needs one type per field — make the content consistent, then re-run.');
}

/* ── CloudCannon _inputs, by path ────────────────────────────────────────── */

const ccConfig = yaml.load(fs.readFileSync(path.join(ROOT, 'cloudcannon.config.yml'), 'utf8'));
const globalStructures = ccConfig._structures || {};

function resolveStructures(ref) {
  if (typeof ref === 'string') return globalStructures[ref.replace(/^_structures\./, '')];
  return ref;
}

/* Walk an `_inputs` block and record every input under its path, e.g.
   `cards[].title`. Structures nested in arrays are followed, as are the global
   `_structures.<name>` they may reference. Blueprint-shaped `value`s found on
   the way are returned too, so empty arrays still get a shape. */
function collectInputs(inputs, prefix, byPath, shapes, depth = 0) {
  if (!inputs || depth > 8) return;
  for (const [key, input] of Object.entries(inputs)) {
    if (!input || typeof input !== 'object') continue;
    const p = prefix ? `${prefix}.${key}` : key;
    if (!byPath.has(p)) byPath.set(p, input);
    const structures = resolveStructures(input.options && input.options.structures);
    for (const s of (structures && structures.values) || []) {
      if (s.value !== undefined) shapes.push([p, s.value]);
      collectInputs(s._inputs, `${p}[]`, byPath, shapes, depth + 1);
    }
  }
}

const globalInputs = new Map();
const globalShapes = [];
collectInputs(ccConfig._inputs, '', globalInputs, globalShapes);
/* The item shape of a global list input (buttons, links, bullets…), by key,
   for lists that are empty in every blueprint and page. */
const globalShapeByKey = new Map();
for (const [p, shape] of globalShapes) {
  const key = p.split('.').pop();
  if (!globalShapeByKey.has(key) && shape && typeof shape === 'object') globalShapeByKey.set(key, shape);
}
/* Global `_inputs` apply by key name wherever the key appears. */
const globalByKey = new Map();
for (const [p, input] of globalInputs) {
  const key = p.split('.').pop().replace(/\[\]$/, '');
  if (!globalByKey.has(key)) globalByKey.set(key, input);
}

/* A list that is empty everywhere has no item type. If a global input of the
   same name describes its items, use that shape (and its default item);
   otherwise it stays a list of strings. */
function fillEmptyLists(node, p, defaults) {
  if (node.kind === 'list') {
    if (node.item.kind === 'unknown') {
      const shape = globalShapeByKey.get(p.split('.').pop().replace(/\[\]$/, ''));
      if (shape) {
        node.item = infer(shape);
        if (!defaults.has(p)) defaults.set(p, shape);
      }
    }
    fillEmptyLists(node.item, `${p}[]`, defaults);
  } else if (node.kind === 'object') {
    for (const [k, child] of node.fields) fillEmptyLists(child, p ? `${p}.${k}` : k, defaults);
  }
}

/* ── node → Tina field ───────────────────────────────────────────────────── */

const titleCase = (k) => k.replace(/^_+/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : undefined);

function selectOptions(input, seen) {
  const values = input && input.options && input.options.values;
  if (!Array.isArray(values)) return null;
  const opts = values.map((v) => (v && typeof v === 'object'
    ? { value: String(v.value ?? v.id ?? ''), label: String(v.label ?? v.name ?? v.value ?? '') }
    : { value: String(v), label: String(v) }));
  /* A value already in the content but missing from the options would show as
     blank in Tina's dropdown, so keep it selectable. */
  for (const v of seen || []) if (v !== '' && !opts.some((o) => o.value === v)) opts.push({ value: v, label: v });
  return opts;
}

/* Every string an instance of a field holds, keyed by path, for selects. */
const seenValues = new Map();
function recordValues(value, p) {
  if (Array.isArray(value)) return value.forEach((v) => recordValues(v, p + '[]'));
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) recordValues(v, p ? `${p}.${k}` : k);
    return;
  }
  if (typeof value === 'string') {
    if (!seenValues.has(p)) seenValues.set(p, new Set());
    seenValues.get(p).add(value);
  }
}

function toField(name, node, p, scope, defaults) {
  if (!FIELD_NAME.test(name)) throw new Error(`"${p}" is not a valid Tina field name`);
  const input = scope.get(p) || globalByKey.get(name) || {};
  const field = { name, label: clean(input.label) || titleCase(name) };
  const description = clean(input.comment);
  if (description) field.description = description;
  const type = input.type;

  if (node.kind === 'object') {
    field.type = 'object';
    field.fields = objectFields(node, p, scope, defaults);
    return field;
  }
  if (node.kind === 'list') {
    const item = node.item;
    if (item.kind === 'object') {
      field.type = 'object';
      field.list = true;
      field.fields = objectFields(item, `${p}[]`, scope, defaults);
      const shape = defaults.get(p);
      if (shape && typeof shape === 'object' && !Array.isArray(shape)) field.ui = { defaultItem: shape };
      return field;
    }
    if (item.kind === 'list') throw new Error(`"${p}" is a list of lists, which Tina cannot edit`);
    field.type = item.kind === 'number' ? 'number' : item.kind === 'boolean' ? 'boolean' : 'string';
    field.list = true;
    if (field.type === 'string') {
      const options = type === 'multiselect' && selectOptions(input, seenValues.get(`${p}[]`));
      if (options) field.options = options;
      if (type === 'image') field.type = 'image';
    }
    return field;
  }
  if (node.kind === 'boolean') return { ...field, type: 'boolean' };
  if (node.kind === 'number') return { ...field, type: 'number' };

  /* string, or never seen with a value (empty everywhere). An input can only
     turn a field boolean or numeric when no content says it holds text. */
  if (node.kind === 'unknown' && (type === 'checkbox' || type === 'switch')) return { ...field, type: 'boolean' };
  if (node.kind === 'unknown' && type === 'number') return { ...field, type: 'number' };
  field.type = type === 'image' ? 'image' : 'string';
  if (type === 'select') {
    const options = selectOptions(input, seenValues.get(p));
    if (options) field.options = options;
  }
  if (type === 'textarea' || type === 'html' || type === 'markdown') field.ui = { component: 'textarea' };
  return field;
}

function objectFields(node, p, scope, defaults) {
  const fields = [];
  for (const [k, child] of node.fields) {
    if (k === '_template') continue;
    fields.push(toField(k, child, p ? `${p}.${k}` : k, scope, defaults));
  }
  /* Tina rejects an object with no fields. */
  if (!fields.length) fields.push({ name: 'placeholder', label: 'Placeholder', type: 'string', ui: { component: 'hidden' } });
  return fields;
}

/* First-item defaults for lists, taken from a blueprint, so "add item" in
   Tina starts from the same values CloudCannon did. */
function listDefaults(value, p, out) {
  if (Array.isArray(value)) {
    const first = value.find((v) => v && typeof v === 'object');
    if (first && !out.has(p)) out.set(p, first);
    value.forEach((v) => listDefaults(v, `${p}[]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) listDefaults(v, p ? `${p}.${k}` : k, out);
  }
}

/* ── sections ────────────────────────────────────────────────────────────── */

const instances = new Map(); // component name → [section, …]
for (const f of fs.readdirSync(PAGES).filter((f) => f.endsWith('.md'))) {
  for (const s of matter.read(path.join(PAGES, f)).data.sections || []) {
    const name = s._template;
    if (!name) throw new Error(`${f}: a section has no _template`);
    if (!instances.has(name)) instances.set(name, []);
    instances.get(name).push(s);
  }
}

const templates = [];
for (const name of fs.readdirSync(COMPONENTS).sort()) {
  const file = path.join(COMPONENTS, name, `${name}.bookshop.yml`);
  if (!fs.existsSync(file)) continue;
  const def = yaml.load(fs.readFileSync(file, 'utf8')) || {};
  const spec = def.spec || {};
  const blueprint = def.blueprint || {};

  const scope = new Map();
  const shapes = [];
  collectInputs(def._inputs, '', scope, shapes);
  seenValues.clear();

  let node = infer(blueprint);
  for (const [p, shape] of shapes) node = merge(node, shapeAt(p, shape), name);
  for (const s of instances.get(name) || []) {
    node = merge(node, infer(s), name);
    recordValues(s, '');
  }
  recordValues(blueprint, '');

  const defaults = new Map();
  listDefaults(blueprint, '', defaults);
  for (const [p, shape] of shapes) if (!defaults.has(p) && shape && typeof shape === 'object') defaults.set(p, shape);
  fillEmptyLists(node, '', defaults);

  const template = {
    name,
    label: clean(spec.label) || titleCase(name),
    fields: objectFields(node, '', scope, defaults),
    ui: { defaultItem: blueprint },
  };
  templates.push(template);
  instances.delete(name);
}
if (instances.size) {
  throw new Error(`Sections with no component in component-library: ${[...instances.keys()].join(', ')}`);
}

/* Tina queries every section type in one GraphQL selection, so a field name
   shared by two section types must have the same type in both. */
const signature = (f) => `${f.type}${f.list ? '[]' : ''}`;
const byName = new Map();
for (const t of templates) {
  for (const f of t.fields) {
    const seen = byName.get(f.name);
    if (seen && seen.sig !== signature(f)) {
      throw new Error(`Field "${f.name}" is ${seen.sig} in ${seen.template} but ${signature(f)} in ${t.name}. ` +
        'Tina needs one type per field name across all section types.');
    }
    if (!seen) byName.set(f.name, { sig: signature(f), template: t.name });
  }
}

/* A structure value at path `a[].b` is one item of the list `b`, inside an
   item of the list `a`. Rebuild the objects around it so it merges into the
   section's node at that place. */
function shapeAt(p, value) {
  const build = (parts) => {
    const key = parts[0].replace(/\[\]$/, '');
    let child;
    if (parts.length === 1) child = { kind: 'list', item: infer(value) };
    else {
      child = build(parts.slice(1));
      if (parts[0].endsWith('[]')) child = { kind: 'list', item: child };
    }
    return { kind: 'object', fields: new Map([[key, child]]) };
  };
  return build(p.split('.'));
}

/* ── data files ──────────────────────────────────────────────────────────── */

const data = {};
for (const [name] of Object.entries(DATA_COLLECTIONS)) {
  const value = JSON.parse(fs.readFileSync(path.join(DATA, `${name}.json`), 'utf8'));
  if (Array.isArray(value) || typeof value !== 'object') {
    throw new Error(`src/_data/${name}.json must be an object at its root for Tina to edit it`);
  }
  seenValues.clear();
  recordValues(value, '');
  const defaults = new Map();
  listDefaults(value, '', defaults);
  const node = infer(value);
  fillEmptyLists(node, '', defaults);
  data[name] = objectFields(node, '', globalInputs, defaults);
}

/* ── write ───────────────────────────────────────────────────────────────── */

fs.mkdirSync(OUT, { recursive: true });
const write = (file, value) => {
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(value, null, 2) + '\n');
  console.log('wrote', path.relative(ROOT, path.join(OUT, file)));
};
write('sections.json', templates);
write('data.json', { labels: DATA_COLLECTIONS, fields: data });
console.log('%d section templates, %d data collections', templates.length, Object.keys(data).length);
