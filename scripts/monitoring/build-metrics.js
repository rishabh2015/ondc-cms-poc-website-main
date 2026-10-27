#!/usr/bin/env node
/* Build-time metrics for the ONDC site.
 * ====================================================================
 * Runs in CloudCannon's postbuild hook, after Eleventy has written
 * _site and after Bookshop has added its editing layer. It never edits
 * a page — it only reads the output and writes two new files:
 *
 *   _site/build-info.json   machine-readable build record
 *   _site/build-report.txt  the same thing, readable in the build log
 *
 * Nothing here can break the editor, because nothing the editor reads
 * is touched. Exit code is 0 unless a budget is breached AND
 * ONDC_FAIL_ON_BUDGET=1, so a monitoring regression can optionally
 * become a build failure once the team trusts the numbers.
 * ==================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const SITE = process.argv[2] || '_site';
const BUDGETS = {
  // Page weight budgets in KB. Sized from the current build so a
  // regression trips them, not today's known-large pages.
  maxHtmlKb: Number(process.env.ONDC_MAX_HTML_KB || 900),
  maxTotalMb: Number(process.env.ONDC_MAX_TOTAL_MB || 40),
  minPages: Number(process.env.ONDC_MIN_PAGES || 30)
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

if (!fs.existsSync(SITE)) {
  console.error(`[metrics] output dir ${SITE} not found — did the build run?`);
  process.exit(1);
}

const files = walk(SITE);
const html = files.filter((f) => f.endsWith('.html'));

let totalBytes = 0;
const byExt = {};
for (const f of files) {
  const size = fs.statSync(f).size;
  totalBytes += size;
  const ext = (path.extname(f) || '.none').toLowerCase();
  byExt[ext] = byExt[ext] || { count: 0, bytes: 0 };
  byExt[ext].count += 1;
  byExt[ext].bytes += size;
}

// Per-page HTML weight, heaviest first.
const pages = html
  .map((f) => ({
    url: '/' + path.relative(SITE, f).split(path.sep).join('/'),
    kb: +(fs.statSync(f).size / 1024).toFixed(1)
  }))
  .sort((a, b) => b.kb - a.kb);

// Count what the pages reference, so broken-asset risk is visible.
let imgTags = 0;
let pdfLinks = 0;
let externalLinks = 0;
let inlineScripts = 0;
for (const f of html) {
  const src = fs.readFileSync(f, 'utf8');
  imgTags += (src.match(/<img\b/gi) || []).length;
  pdfLinks += (src.match(/href="[^"]*\.pdf"/gi) || []).length;
  externalLinks += (src.match(/href="https?:\/\//gi) || []).length;
  inlineScripts += (src.match(/<script(?![^>]*\bsrc=)/gi) || []).length;
}

function gitVal(args, fallback) {
  try {
    return require('child_process')
      .execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim() || fallback;
  } catch (e) { return fallback; }
}

const info = {
  built_at: new Date().toISOString(),
  built_at_ist: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  commit: process.env.GITHUB_SHA || gitVal(['rev-parse', '--short', 'HEAD'], 'unknown'),
  branch: process.env.BRANCH || gitVal(['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
  pages: pages.length,
  files: files.length,
  total_mb: +(totalBytes / 1024 / 1024).toFixed(2),
  heaviest_pages: pages.slice(0, 5),
  references: {
    img_tags: imgTags,
    pdf_links: pdfLinks,
    external_links: externalLinks,
    inline_scripts: inlineScripts
  },
  by_extension: Object.fromEntries(
    Object.entries(byExt)
      .map(([k, v]) => [k, { count: v.count, mb: +(v.bytes / 1024 / 1024).toFixed(2) }])
      .sort((a, b) => b[1].mb - a[1].mb)
      .slice(0, 10)
  )
};

// ---- budgets -------------------------------------------------------
const breaches = [];
if (pages.length && pages[0].kb > BUDGETS.maxHtmlKb) {
  breaches.push(`heaviest page ${pages[0].url} is ${pages[0].kb}KB (budget ${BUDGETS.maxHtmlKb}KB)`);
}
if (info.total_mb > BUDGETS.maxTotalMb) {
  breaches.push(`total output ${info.total_mb}MB (budget ${BUDGETS.maxTotalMb}MB)`);
}
if (pages.length < BUDGETS.minPages) {
  breaches.push(`only ${pages.length} pages built (expected at least ${BUDGETS.minPages}) — pages may be missing`);
}
info.budget_breaches = breaches;
info.status = breaches.length ? 'warn' : 'ok';

fs.writeFileSync(path.join(SITE, 'build-info.json'), JSON.stringify(info, null, 2));

const report = [
  '────────────── ONDC build metrics ──────────────',
  `built      ${info.built_at_ist} IST`,
  `commit     ${info.commit} (${info.branch})`,
  `pages      ${info.pages}`,
  `files      ${info.files}`,
  `output     ${info.total_mb} MB`,
  `img tags   ${imgTags}`,
  `pdf links  ${pdfLinks}`,
  `ext links  ${externalLinks}`,
  '',
  'heaviest pages:',
  ...pages.slice(0, 5).map((p) => `  ${String(p.kb).padStart(7)} KB  ${p.url}`),
  '',
  breaches.length
    ? 'BUDGET BREACHES:\n' + breaches.map((b) => '  ! ' + b).join('\n')
    : 'budgets: all within limits',
  '────────────────────────────────────────────────'
].join('\n');

fs.writeFileSync(path.join(SITE, 'build-report.txt'), report);
console.log(report);

if (breaches.length && process.env.ONDC_FAIL_ON_BUDGET === '1') {
  console.error('[metrics] failing build: budget breached and ONDC_FAIL_ON_BUDGET=1');
  process.exit(1);
}
