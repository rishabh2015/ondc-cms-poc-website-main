/* /js/tina-preview-query.json — the GraphQL query the Tina preview announces.
 * ===========================================================================
 * When a page is open inside the Tina editor, js/ondc/tina-preview.js tells
 * the editor "this page shows document X, fetched with query Q". The editor
 * builds its form from Q, and resolves a clicked element by walking Q's result
 * (pages.sections.3.heading…), so Q must select every field of a page.
 *
 * Tina generates exactly that query (`pages`) in tina/__generated__ during
 * `tinacms build` / `tinacms dev`, which both run before Eleventy. This file
 * copies it out with the fragments it uses. With no generated files (a plain
 * `eleventy` build) nothing is written and the preview stays inert.
 * =========================================================================== */
const fs = require("fs");
const path = require("path");

const GENERATED = path.join(__dirname, "..", "tina", "__generated__");

function readQuery() {
  const queries = path.join(GENERATED, "queries.gql");
  const frags = path.join(GENERATED, "frags.gql");
  if (!fs.existsSync(queries) || !fs.existsSync(frags)) return null;

  const split = (text, keyword) => {
    const out = new Map();
    for (const chunk of text.split(new RegExp(`^(?=${keyword} )`, "m"))) {
      const m = chunk.match(new RegExp(`^${keyword} (\\w+)`));
      if (m) out.set(m[1], chunk.trim());
    }
    return out;
  };
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

module.exports = class {
  data() {
    this.query = readQuery();
    return {
      permalink: this.query ? "/js/tina-preview-query.json" : false,
      eleventyExcludeFromCollections: true,
    };
  }

  render() {
    return JSON.stringify({ query: this.query });
  }
};
