/* Eleventy build.
 * Pages live in src/pages as .md files whose front matter holds a `sections`
 * list. Each section is rendered by the component its `_template` names, in
 * component-library/components/<type> — that is what lets TinaCMS add,
 * duplicate, delete and reorder sections without a developer.
 *
 * Pages are edited in TinaCMS at /admin (config in tina/config.ts).
 * Build command:  npm run build   (tinacms build && eleventy)
 * Output folder:  _site
 */
/* Build in India Standard Time.
 * Dates in front matter are instants (ISO8601). Anything that formats one at
 * build time — the RFP deadlines, for instance — otherwise uses whatever
 * timezone the build server happens to be in, and a deadline late in the IST
 * evening renders as the previous day on a UTC builder. Pinning the build
 * timezone makes the server-rendered text agree with what the page shows after
 * its JavaScript formats the same instant in Asia/Kolkata. */
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const path = require("path");
const pluginBookshop = require("@bookshop/eleventy-bookshop");

module.exports = function (eleventyConfig) {
  // Bookshop resolves bookshopLocations from the project root, but LiquidJS
  // resolves includes from the input dir (src). Adding "." lets Liquid find
  // the component library at the root, so both agree.
  eleventyConfig.setLiquidOptions({
    root: ["src/_includes", "src", "."],
    dynamicPartials: true,
    extname: ".liquid",
    strictFilters: true,
    jsTruthy: true
  });

  eleventyConfig.addPlugin(pluginBookshop({
    bookshopLocations: ["component-library"],
    pathPrefix: ''
  }));
  // Assets keep their current URLs (/css/..., /js/..., /images/..., /fonts/...)
  eleventyConfig.addPassthroughCopy({
    css: "css",
    js: "js",
    images: "images",
    fonts: "fonts",
    files: "files",
    // The TinaCMS editor, built into ./admin by `tinacms build` / `tinacms dev`.
    admin: "admin",
    // Click-to-edit in the Tina preview frame (js/ondc/tina-preview.js).
    "node_modules/@tinacms/bridge/dist/index.js": "js/vendor/tina-bridge.js",
    // The same liquidjs Eleventy renders with, for the live preview.
    [path.relative(__dirname, require.resolve("liquidjs/dist/liquid.browser.min.js", { paths: [path.dirname(require.resolve("@11ty/eleventy/package.json"))] }))]: "js/vendor/liquid.browser.min.js"
  });

  // The site's own Liquid filters (nl2br, embedUrl). They live in
  // js/ondc/tina-render.js so the Tina live preview draws with the same code.
  const { filters } = require("./js/ondc/tina-render.js");
  for (const [name, fn] of Object.entries(filters)) eleventyConfig.addFilter(name, fn);

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    htmlTemplateEngine: "liquid",
    markdownTemplateEngine: "liquid"
  };
};
