/* /js/tina-preview.json — everything the Tina live preview needs.
 * ===========================================================================
 * Fetched only by js/ondc/tina-preview.js, i.e. only inside the Tina editor.
 *
 *   query       the GraphQL query the preview announces to the editor. The
 *               editor builds its form from it and resolves a clicked element
 *               by walking its result (pages.sections.3.heading…), so it must
 *               select every field: Tina's generated `pages` query is used.
 *   templates   every component-library template, so the browser can draw a
 *               section exactly as Eleventy does (js/ondc/tina-render.js).
 *   data        the global data files (src/_data) the templates read.
 *   typenames   each section's GraphQL __typename → its template name.
 *
 * The query comes from tina/__generated__, written by `tinacms build` /
 * `tinacms dev` before Eleventy runs. Without it (a plain `eleventy` build)
 * nothing is written and the preview stays inert.
 * =========================================================================== */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const GENERATED = path.join(ROOT, "tina", "__generated__");
const LIBRARY = path.join(ROOT, "component-library");
const DATA = path.join(__dirname, "_data");

function split(text, keyword) {
  const out = new Map();
  for (const chunk of text.split(new RegExp(`^(?=${keyword} )`, "m"))) {
    const m = chunk.match(new RegExp(`^${keyword} (\\w+)`));
    if (m) out.set(m[1], chunk.trim());
  }
  return out;
}

function readQuery() {
  const queries = path.join(GENERATED, "queries.gql");
  const frags = path.join(GENERATED, "frags.gql");
  if (!fs.existsSync(queries) || !fs.existsSync(frags)) return null;
  const query = split(fs.readFileSync(queries, "utf8"), "query").get("pages");
  if (!query) return null;
  const fragments = split(fs.readFileSync(frags, "utf8"), "fragment");

  /* Every fragment the query spreads, and the ones those spread in turn. */
  const used = new Set();
  const visit = (text) => {
    for (const [, name] of text.matchAll(/\.\.\.(?!\s*on\b)\s*(\w+)/g)) {
      if (used.has(name) || !fragments.has(name)) continue;
      used.add(name);
      visit(fragments.get(name));
    }
  };
  visit(query);
  return [query, ...[...used].map((n) => fragments.get(n))].join("\n\n");
}

function readTemplates() {
  const out = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".eleventy.liquid")) {
        out[path.relative(LIBRARY, full).split(path.sep).join("/")] = fs.readFileSync(full, "utf8");
      }
    }
  };
  walk(LIBRARY);
  return out;
}

/* Tina names a section's GraphQL type PagesSections + the template name with
   its first letter capitalised. Checked against the generated query, so a
   change in Tina's naming fails the build instead of the preview. */
function readTypenames(query) {
  const sections = require(path.join(ROOT, "tina", "generated", "sections.json"));
  const out = {};
  for (const { name } of sections) {
    const typename = `PagesSections${name[0].toUpperCase()}${name.slice(1)}`;
    if (!query.includes(`on ${typename} `) && !query.includes(`on ${typename}{`)) {
      throw new Error(`tina-preview: no ${typename} in the generated query for section "${name}"`);
    }
    out[typename] = name;
  }
  return out;
}

module.exports = class {
  data() {
    this.query = readQuery();
    return {
      permalink: this.query ? "/js/tina-preview.json" : false,
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const globals = {};
    for (const file of fs.readdirSync(DATA)) {
      const name = path.parse(file).name;
      if (name in data) globals[name] = data[name];
    }
    return JSON.stringify({
      query: this.query,
      templates: readTemplates(),
      data: globals,
      typenames: readTypenames(this.query),
    });
  }
};
