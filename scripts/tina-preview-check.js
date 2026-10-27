#!/usr/bin/env node
/* Check the Tina live preview draws every section exactly as Eleventy does.
 * ===========================================================================
 * For every page: fetch it from Tina's GraphQL API with the same query the
 * preview announces (so the data has exactly the shape the editor sends while
 * someone types), render each section with js/ondc/tina-render.js — the code
 * the browser runs — and compare with the section in Eleventy's output.
 *
 *   npm run dev                       (in another terminal; serves the API
 *                                      on :4001 and keeps _site built)
 *   npm run tina:check-preview
 *
 * Exits non-zero on any difference. Bookshop's <!--bookshop-live--> comments
 * are ignored: they are CloudCannon markers the preview does not draw.
 * =========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { Liquid } = require(require.resolve('liquidjs', { paths: [path.dirname(require.resolve('@11ty/eleventy/package.json'))] }));
const { createRenderer, fromTina } = require('../js/ondc/tina-render.js');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, '_site');
const API = process.env.TINA_API || 'http://localhost:4001/graphql';

const strip = (html) => html.replace(/<!--bookshop-live[\s\S]*?-->/g, '').trim();

(async () => {
  const preview = JSON.parse(fs.readFileSync(path.join(SITE, 'js/tina-preview.json'), 'utf8'));
  const renderer = createRenderer(Liquid, preview.templates);

  let sections = 0, failures = 0;
  for (const file of fs.readdirSync(path.join(ROOT, 'src/pages')).filter((f) => f.endsWith('.md'))) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: preview.query, variables: { relativePath: file } }),
    });
    const json = await res.json();
    if (json.errors) throw new Error(`${file}: ${JSON.stringify(json.errors).slice(0, 500)}`);
    const page = fromTina(json.data.pages, preview.typenames);
    const env = { ...preview.data, ...page };

    const html = fs.readFileSync(path.join(SITE, `${path.parse(file).name}.html`), 'utf8');
    const built = new Map();
    for (const m of html.matchAll(/<editable-array-item [^>]*data-tina-path="sections\.(\d+)">([\s\S]*?)<\/editable-array-item>/g)) {
      built.set(Number(m[1]), strip(m[2]));
    }
    if (built.size !== page.sections.length) {
      console.log(`FAIL ${file}: built page has ${built.size} sections, Tina data has ${page.sections.length}`);
      failures++;
      continue;
    }

    /* The whole section list, as the preview splices it into the page. */
    const region = html.match(/<!--tina-sections-->([\s\S]*)<!--\/tina-sections-->/);
    const drawnRegion = await renderer.renderSections(page.sections, env);
    sections++;
    if (!region || strip(region[1]) !== strip(drawnRegion)) {
      failures++;
      console.log(`FAIL ${file}: the redrawn section list differs from the built page`);
    }

    for (let i = 0; i < page.sections.length; i++) {
      sections++;
      const drawn = strip(await renderer.renderSection(page.sections[i], env));
      const expected = built.get(i);
      if (drawn === expected) continue;
      failures++;
      let at = 0;
      while (at < drawn.length && drawn[at] === expected[at]) at++;
      const kind = drawn.replace(/\s+/g, '') === expected.replace(/\s+/g, '') ? 'whitespace only' : 'content';
      console.log(`FAIL ${file} sections.${i} (${page.sections[i]._template}), ${kind}, first difference at ${at}:`);
      console.log('  built:   ' + JSON.stringify(expected.slice(Math.max(0, at - 60), at + 80)));
      console.log('  preview: ' + JSON.stringify(drawn.slice(Math.max(0, at - 60), at + 80)));
    }
  }
  console.log(`\n${sections} sections and section lists checked, ${failures} differences`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
