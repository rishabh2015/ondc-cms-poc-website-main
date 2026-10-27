/* Tina visual editing: click a part of the page to edit it.
 * ===========================================================================
 * Loaded only when the page is inside the Tina editor's preview frame (see the
 * end of base.liquid). It does three things:
 *
 *   1. announces the page's document to the editor, which then opens its form
 *      beside the preview;
 *   2. turns the site's own markers into the ids Tina's click-to-focus reads:
 *        data-tina-path="sections.3"   (set on every section by page.eleventy.liquid)
 *        data-tina-at="heading"        (set inside a component, relative to its section)
 *      become data-tina-field="<query id>---pages.sections.3.heading";
 *   3. starts @tinacms/bridge, which handles the clicks and the outlines.
 *
 * The preview does not re-render as you type — the page is static HTML. It
 * refreshes after a save: instantly with `npm run dev`, after the next deploy
 * with TinaCloud.
 * =========================================================================== */
import { init } from '/js/vendor/tina-bridge.js';

/* Same hash the editor uses for query ids (@tinacms/bridge metadata.js). */
function hashFromQuery(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) & 4294967295;
  }
  return Math.abs(hash).toString(36);
}

/* The element a section's outline goes on. <editable-array-item> is an
   inline wrapper, so mark the section it holds rather than the wrapper. */
function sectionElement(wrapper) {
  for (const child of wrapper.children) {
    if (!/^(script|style|template|link)$/i.test(child.tagName)) return child;
  }
  return wrapper;
}

async function start() {
  const relativePath = document.body.dataset.tinaDocument;
  if (!relativePath) return;

  let query;
  try {
    const res = await fetch('/js/tina-preview-query.json', { cache: 'no-store' });
    ({ query } = await res.json());
  } catch (e) {
    console.warn('[tina-preview] no preview query; run the site with `npm run dev` or `npm run build`', e);
    return;
  }
  if (!query) return;

  const variables = { relativePath };
  const id = hashFromQuery(JSON.stringify({ query, variables }));
  const field = (p) => `${id}---pages.${p}`;

  for (const wrapper of document.querySelectorAll('[data-tina-path]')) {
    sectionElement(wrapper).setAttribute('data-tina-field', field(wrapper.dataset.tinaPath));
  }
  for (const el of document.querySelectorAll('[data-tina-at]')) {
    const section = el.parentElement && el.parentElement.closest('[data-tina-path]');
    if (section) el.setAttribute('data-tina-field', field(`${section.dataset.tinaPath}.${el.dataset.tinaAt}`));
  }

  const form = document.createElement('div');
  form.hidden = true;
  form.setAttribute('data-tina-form', JSON.stringify({ id, query, variables, data: {} }));
  form.setAttribute('data-tina-primary', '');
  document.body.appendChild(form);

  init();
}

start();
