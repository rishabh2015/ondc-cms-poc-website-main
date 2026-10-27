/* Section renderer shared by Eleventy and the Tina live preview.
 * ===========================================================================
 * The live preview redraws a page's sections in the browser as an editor
 * types. To draw them exactly as the build does, everything rendering depends
 * on lives in this one file and is used by both sides:
 *
 *   - filters          the site's custom Liquid filters (nl2br, embedUrl);
 *                      eleventy.config.js registers these same functions.
 *   - createRenderer   a Liquid engine with Eleventy's options and the two
 *                      Bookshop tags, rendering one section, or the whole
 *                      section list, the way the build does.
 *   - fromTina         turns the page data Tina sends (GraphQL-shaped) back
 *                      into the front-matter shape the templates read.
 *
 * Plain script, no build step: `require()` in Node, `window.ONDCTinaRender`
 * in the browser. scripts/tina-preview-check.js proves the two agree.
 * =========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ONDCTinaRender = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── filters ───────────────────────────────────────────────────────────── */

  var filters = {
    // "a\nb" -> "a<br>b"  (used for labels that wrap onto two lines)
    nl2br: function (value) {
      if (value === undefined || value === null) return '';
      return String(value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\r\n|\r|\n/g, '<br/>');
    },
    // youtube / vimeo url -> embeddable player url
    embedUrl: function (value) {
      var u = String(value || '').trim();
      var m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
      if (m) return 'https://www.youtube.com/embed/' + m[1];
      m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      if (m) return 'https://player.vimeo.com/video/' + m[1];
      return u;
    }
  };

  /* ── renderer ──────────────────────────────────────────────────────────── */

  var componentKey = function (name) {
    var base = name.split('/').reverse()[0];
    return 'components/' + name + '/' + base + '.eleventy.liquid';
  };
  var includeKey = function (name) { return 'shared/eleventy/' + name + '.eleventy.liquid'; };

  /* `Liquid` is the liquidjs class (window.liquidjs.Liquid in the browser);
     `templates` maps component-library-relative paths to their source. */
  function createRenderer(Liquid, templates) {
    var liquid = new Liquid({
      templates: templates,
      // Eleventy's options (eleventy.config.js), except extname: every
      // include here names a full `….eleventy.liquid` key, and the in-memory
      // loader would append the extension a second time.
      extname: '',
      strictFilters: true,
      dynamicPartials: true,
      jsTruthy: true
    });
    Object.keys(filters).forEach(function (name) { liquid.registerFilter(name, filters[name]); });

    /* Bookshop's tags, as @bookshop/eleventy-bookshop implements them: each
       becomes a plain `include` of the file, rendered with the whole current
       scope plus `__bookshop__nested`. Its <!--bookshop-live--> comments are
       for CloudCannon and are left out. */
    var bookshopTag = function (keyFor) {
      return {
        parse: function (token) {
          var m = token.args.match(/^['"]?([^\s'"]+)['"]?(?:[\r\n\s]+([\s\S]*))?$/);
          this.component = m[1];
          this.args = m[2] || '';
        },
        render: function* (ctx) {
          var component = this.component;
          if (/^{{.*}}$/.test(component)) {
            component = (yield this.liquid.evalValue(component.replace(/^{{(.*)}}$/, '$1').trim(), ctx)) || this.component;
          }
          var scope = { __bookshop__nested: true };
          var bind = /(?:^|[\s,])bind:\s*([^\s,]+)/.exec(this.args);
          if (bind) Object.assign(scope, yield this.liquid.evalValue(bind[1], ctx));
          ctx.push(scope);
          var out = yield this.liquid.parseAndRender(
            "{% include '" + keyFor(component) + "' " + this.args + ' %}', ctx.getAll());
          ctx.pop();
          return out;
        }
      };
    };
    liquid.registerTag('bookshop', bookshopTag(componentKey));
    liquid.registerTag('bookshop_include', bookshopTag(includeKey));

    return {
      liquid: liquid,
      /* One section, as `{% bookshop "{{component}}" bind: block %}` draws it
         inside page.eleventy.liquid's loop. `env` is the page's data: global
         data files plus the page's own front matter. */
      renderSection: function (block, env) {
        var component = block._template || block._bookshop_name;
        var scope = Object.assign({}, env, { block: block, component: component });
        return liquid.parseAndRender('{% bookshop "{{component}}" bind: block %}', scope);
      },
      /* The whole section list, through page.eleventy.liquid itself (as
         base.liquid's `{% bookshop_include "page" sections: sections %}`
         does), returned as the part between its tina-sections comments. */
      renderSections: function (sections, env) {
        var scope = Object.assign({}, env, { sections: sections, __bookshop__nested: true });
        return liquid.parseAndRender("{% include '" + includeKey('page') + "' sections: sections %}", scope)
          .then(function (html) {
            var m = html.match(/<!--tina-sections-->([\s\S]*)<!--\/tina-sections-->/);
            if (!m) throw new Error('page.eleventy.liquid has no tina-sections markers');
            return m[1];
          });
      },
      componentKey: componentKey
    };
  }

  /* ── Tina data → front matter ─────────────────────────────────────────── */

  /* Keys Tina adds to query results; none of them is content. */
  var SYSTEM = /^(__typename|_sys|_internalSys|_values|_internalValues|_content_source|_tina_metadata|id)$/;

  function clean(value, isDocument) {
    if (Array.isArray(value)) return value.map(function (v) { return clean(v, false); });
    if (!value || typeof value !== 'object') return value;
    var out = {};
    Object.keys(value).forEach(function (k) {
      if (k === '__typename' || k === '_content_source' || k === '_tina_metadata') return;
      if (isDocument && SYSTEM.test(k)) return;
      // Tina returns null for a field the file does not have; the build
      // simply never sees such a key.
      if (value[k] === null) return;
      out[k] = clean(value[k], false);
    });
    return out;
  }

  /* `doc` is the `pages` document from a Tina query result. `typenames`
     maps each section's GraphQL __typename to its template name. */
  function fromTina(doc, typenames) {
    var page = clean(doc, true);
    page.sections = (doc.sections || []).map(function (s) {
      var section = clean(s, false);
      section._template = typenames[s.__typename];
      return section;
    });
    return page;
  }

  return { filters: filters, createRenderer: createRenderer, fromTina: fromTina };
});
