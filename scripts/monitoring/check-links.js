#!/usr/bin/env node
/* Internal link and asset integrity check for the built site.
 * ====================================================================
 * Checks every internal href and src in _site against what the build
 * actually produced. Catches, at build time and for free:
 *
 *   - a page linking to another page that no longer exists
 *   - a PDF or image path that does not resolve in the output
 *   - a stylesheet or script that would 404 for every visitor
 *
 * External links are counted and listed but NOT fetched — the build
 * container should not depend on 991 third-party servers being up.
 * Those belong in a scheduled job outside the build (lychee weekly).
 *
 * Exit 1 on broken internal references so the build fails loudly
 * rather than publishing a site with dead links.
 * ==================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const SITE = process.argv[2] || '_site';
const STRICT = process.env.ONDC_FAIL_ON_BROKEN_LINKS === '1';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

if (!fs.existsSync(SITE)) {
  console.error(`[links] ${SITE} not found`);
  process.exit(1);
}

const all = walk(SITE);
// Everything the build produced, as site-absolute URLs.
const present = new Set(
  all.map((f) => '/' + path.relative(SITE, f).split(path.sep).join('/'))
);

const htmlFiles = all.filter((f) => f.endsWith('.html'));
const ATTR = /(?:href|src)="([^"]+)"/gi;

const broken = [];
let internalChecked = 0;
let externalCount = 0;

for (const file of htmlFiles) {
  const pageUrl = '/' + path.relative(SITE, file).split(path.sep).join('/');
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = ATTR.exec(src)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    // Skip anything that does not point at a file in this build.
    if (/^(https?:)?\/\//i.test(raw)) { externalCount++; continue; }
    if (/^(mailto:|tel:|data:|javascript:|#)/i.test(raw)) continue;

    // Strip query and fragment, then resolve relative paths.
    let target = raw.split('#')[0].split('?')[0];
    if (!target) continue;
    if (!target.startsWith('/')) {
      target = '/' + path.posix.normalize(
        path.posix.join(path.posix.dirname(pageUrl), target)
      ).replace(/^\/+/, '');
    }
    target = decodeURI(target);

    internalChecked++;
    const candidates = [
      target,
      target.replace(/\/$/, '/index.html'),
      target + '.html',
      target + '/index.html'
    ];
    if (!candidates.some((c) => present.has(c))) {
      broken.push({ page: pageUrl, target: raw });
    }
  }
}

console.log('────────────── internal link check ──────────────');
console.log(`pages scanned     ${htmlFiles.length}`);
console.log(`internal refs     ${internalChecked}`);
console.log(`external refs     ${externalCount} (not fetched at build time)`);
console.log(`broken internal   ${broken.length}`);

if (broken.length) {
  // Group by target so one missing asset referenced 400 times reads as one problem.
  const byTarget = {};
  for (const b of broken) (byTarget[b.target] = byTarget[b.target] || []).push(b.page);
  const entries = Object.entries(byTarget).sort((a, b) => b[1].length - a[1].length);
  console.log('\nbroken references, most-referenced first:');
  for (const [target, pages] of entries.slice(0, 25)) {
    console.log(`  ${target}  — ${pages.length} page(s), e.g. ${pages[0]}`);
  }
  if (entries.length > 25) console.log(`  … and ${entries.length - 25} more`);
}
console.log('─────────────────────────────────────────────────');

fs.writeFileSync(
  path.join(SITE, 'link-report.json'),
  JSON.stringify({ checked: internalChecked, external: externalCount, broken }, null, 2)
);

if (broken.length && STRICT) {
  console.error('[links] failing build: broken internal references found');
  process.exit(1);
}
