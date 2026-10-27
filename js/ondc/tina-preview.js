/* Tina visual editing: live preview, click-to-edit and a full-size preview.
 * ===========================================================================
 * Loaded only when the page is inside the Tina editor's preview frame (see the
 * end of base.liquid).
 *
 * 1. Click-to-edit. The site marks what can be clicked:
 *        data-tina-path="sections.3"   on every section (page.eleventy.liquid)
 *        data-tina-at="heading"        inside a component, relative to its section
 *    and this script turns those into the ids Tina reads
 *    (data-tina-field="<query id>---pages.sections.3.heading"), announces the
 *    page's document so its form opens, and starts @tinacms/bridge.
 *
 * 2. Live preview. As the editor types, Tina posts the unsaved page data here
 *    (`updateData`). The sections are redrawn in the browser with the same
 *    templates, filters and Liquid engine as the build (js/ondc/tina-render.js;
 *    `npm run tina:check-preview` proves they match), spliced into the page's
 *    own HTML, and loaded into a full-screen frame over the page. A fresh frame
 *    per change means every page script (reveals, carousels, maps) runs on the
 *    new content exactly as on the live site. Two frames take turns, so the
 *    old one is only swapped out once the new one has drawn — no flicker —
 *    and the scroll position carries over.
 *
 * 3. Preview button. Opens the page as it stands, unsaved changes included,
 *    full size in a new tab.
 * =========================================================================== */
import { init } from '/js/vendor/tina-bridge.js';

const ORIGIN = window.location.origin;
const DEBOUNCE_MS = 250;

/* Same hash the editor uses for query ids (@tinacms/bridge metadata.js). */
function hashFromQuery(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) & 4294967295;
  }
  return Math.abs(hash).toString(36);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(s);
  });
}

const nextFrame = (win) => new Promise((r) => win.requestAnimationFrame(() => r()));

/* ── click-to-edit markers ─────────────────────────────────────────────── */

/* The element a section's outline goes on. <editable-array-item> is an
   inline wrapper, so mark the section it holds rather than the wrapper. */
function sectionElement(wrapper) {
  for (const child of wrapper.children) {
    if (!/^(script|style|template|link)$/i.test(child.tagName)) return child;
  }
  return wrapper;
}

function markFields(doc, id) {
  const field = (p) => `${id}---pages.${p}`;
  for (const wrapper of doc.querySelectorAll('[data-tina-path]')) {
    sectionElement(wrapper).setAttribute('data-tina-field', field(wrapper.dataset.tinaPath));
  }
  for (const el of doc.querySelectorAll('[data-tina-at]')) {
    const section = el.parentElement && el.parentElement.closest('[data-tina-path]');
    if (section) el.setAttribute('data-tina-field', field(`${section.dataset.tinaPath}.${el.dataset.tinaAt}`));
  }
}

/* ── live frames ───────────────────────────────────────────────────────── */

/* Quick-edit (outlines + click-to-focus) is on while Tina's sidebar is open.
   The bridge handles it for this document; the live frames mirror it. */
let quickEdit = false;
const QUICK_EDIT_STYLE_ID = '__tina-bridge-quick-edit-style';
const QUICK_EDIT_BODY_CLASS = '__tina-quick-editing-enabled';

function syncQuickEdit(doc) {
  if (!doc || !doc.body) return;
  const own = document.getElementById(QUICK_EDIT_STYLE_ID);
  const theirs = doc.getElementById(QUICK_EDIT_STYLE_ID);
  if (quickEdit && own && !theirs) {
    const style = doc.createElement('style');
    style.id = QUICK_EDIT_STYLE_ID;
    style.textContent = own.textContent;
    doc.head.appendChild(style);
  } else if (!quickEdit && theirs) {
    theirs.remove();
  }
  doc.body.classList.toggle(QUICK_EDIT_BODY_CLASS, quickEdit);
}

function wireFrame(frame) {
  const doc = frame.contentDocument;
  doc.addEventListener('click', (event) => {
    /* Not `instanceof Element`: the frame's nodes come from its own window,
       whose Element is a different constructor from this page's. */
    const target = event.target && event.target.nodeType === 1 ? event.target : null;
    if (!target) return;
    if (quickEdit) {
      const marked = target.closest('[data-tina-field]');
      if (marked) {
        event.preventDefault();
        event.stopPropagation();
        window.parent.postMessage({ type: 'field:selected', fieldName: marked.getAttribute('data-tina-field') }, ORIGIN);
        return;
      }
    }
    /* An in-page link would otherwise load the saved page into the frame
       (the frame's links resolve against this page's address). */
    const link = target.closest('a[href^="#"]');
    if (link) {
      const dest = doc.getElementById(decodeURIComponent(link.getAttribute('href').slice(1)));
      event.preventDefault();
      if (dest) dest.scrollIntoView({ behavior: 'smooth' });
    }
  }, true);
}

function createLive(baseHtml, id) {
  const frames = [];
  let shown = null;
  let generation = 0;

  const host = document.createElement('div');
  host.setAttribute('data-tina-live', '');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
  document.body.appendChild(host);

  function frameStyle(visible) {
    return 'position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;' +
      (visible ? 'visibility:visible;pointer-events:auto;' : 'visibility:hidden;pointer-events:none;');
  }

  /* Show `html` (a full page). Resolves once it is on screen; a newer call
     supersedes an older one still loading. */
  async function show(html) {
    const mine = ++generation;
    const scrollY = shown ? shown.contentWindow.scrollY : window.scrollY;
    const frame = document.createElement('iframe');
    frame.setAttribute('title', 'Live preview');
    frame.style.cssText = frameStyle(false);
    host.appendChild(frame);
    frames.push(frame);

    await new Promise((resolve) => {
      frame.addEventListener('load', resolve, { once: true });
      frame.srcdoc = html;
    });
    if (mine !== generation) { frame.remove(); frames.splice(frames.indexOf(frame), 1); return; }

    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    markFields(doc, id);
    wireFrame(frame);
    syncQuickEdit(doc);
    /* Let the page scripts' first observers run, then match the scroll. */
    await nextFrame(win); await nextFrame(win);
    win.scrollTo(0, scrollY);
    await nextFrame(win); await nextFrame(win);
    if (mine !== generation) { frame.remove(); frames.splice(frames.indexOf(frame), 1); return; }

    frame.style.cssText = frameStyle(true);
    document.documentElement.style.overflow = 'hidden';
    for (const old of frames.splice(0)) if (old !== frame) old.remove();
    frames.push(frame);
    shown = frame;
    /* Animations were held at their end state so the swap does not replay
       every fade; let them run normally from here. */
    setTimeout(() => { const still = doc.getElementById('__tina-live-still'); if (still) still.remove(); }, 600);
  }

  function hide() {
    generation++;
    for (const f of frames.splice(0)) f.remove();
    shown = null;
    document.documentElement.style.overflow = '';
  }

  return {
    show,
    hide,
    syncQuickEdit: () => { if (shown) syncQuickEdit(shown.contentDocument); },
  };
}

/* ── preview button ────────────────────────────────────────────────────── */

function addPreviewButton(currentHtml) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Preview ↗';
  button.title = 'Open this page, with your unsaved changes, full size in a new tab';
  button.style.cssText = [
    'position:fixed', 'right:16px', 'bottom:16px', 'z-index:2147483647',
    'padding:10px 16px', 'border:0', 'border-radius:999px',
    'background:#1f2937', 'color:#fff', 'font:600 14px/1 system-ui,sans-serif',
    'box-shadow:0 4px 14px rgba(0,0,0,.25)', 'cursor:pointer',
  ].join(';');
  button.addEventListener('click', () => {
    const tab = window.open('', '_blank');
    if (!tab) return;
    tab.document.open();
    tab.document.write(currentHtml());
    tab.document.close();
  });
  document.body.appendChild(button);
}

/* ── start ─────────────────────────────────────────────────────────────── */

const SECTIONS = /(<!--tina-sections-->)[\s\S]*(<!--\/tina-sections-->)/;
const stripComments = (html) => html.replace(/<!--bookshop-live[\s\S]*?-->/g, '').trim();

async function start() {
  const relativePath = document.body.dataset.tinaDocument;
  if (!relativePath) return;

  let preview;
  try {
    preview = await (await fetch('/js/tina-preview.json', { cache: 'no-store' })).json();
  } catch (e) {
    console.warn('[tina-preview] /js/tina-preview.json missing; build with `npm run dev` or `npm run build`', e);
    return;
  }
  const { query, templates, data: globals, typenames } = preview;
  const variables = { relativePath };
  const id = hashFromQuery(JSON.stringify({ query, variables }));

  /* Listen before anything else loads: the editor sends quick-edit state and
     the first page data as soon as the form below is announced. Edits that
     arrive before the renderer is ready wait in `latest`. */
  let latest = null;
  let timer = null;
  let redraw = null;
  let live = null;
  window.addEventListener('message', (event) => {
    if (event.origin !== ORIGIN || event.source !== window.parent) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'quickEditEnabled') {
      quickEdit = !!msg.value;
      /* The bridge adds its style on the same message; mirror after it. */
      setTimeout(() => { if (live) live.syncQuickEdit(); }, 0);
    }
    if (msg.type === 'updateData' && msg.id === id && msg.data && msg.data.pages) {
      latest = msg.data;
      clearTimeout(timer);
      if (redraw) timer = setTimeout(redraw, DEBOUNCE_MS);
    }
  });

  markFields(document, id);
  const form = document.createElement('div');
  form.hidden = true;
  form.setAttribute('data-tina-form', JSON.stringify({ id, query, variables, data: {} }));
  form.setAttribute('data-tina-primary', '');
  document.body.appendChild(form);
  init();

  /* The page's own HTML, as served, is the shell every redraw goes into. The
     dev server's live-reload client is dropped from the copies: reloads are
     this page's job, and a reload brings back the saved content anyway. */
  let baseHtml = await (await fetch(window.location.href, { cache: 'no-store' })).text();
  baseHtml = baseHtml.replace(/<script[^>]*\/\.11ty\/[^>]*><\/script>/g, '');
  const sectionsMatch = baseHtml.match(SECTIONS);
  const shellFor = (sectionsHtml) => baseHtml
    .replace(SECTIONS, () => `<!--tina-sections-->${sectionsHtml}<!--/tina-sections-->`)
    .replace(/<head([^>]*)>/i, (m) => `${m}<script>window.__TINA_LIVE_FRAME__ = true;</script>` +
      '<style id="__tina-live-still">*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important}</style>');

  /* What the page shows now, to tell real edits apart from Tina echoing the
     saved content back. */
  const savedSections = sectionsMatch
    ? stripComments(sectionsMatch[0].replace(SECTIONS, (m) => m.slice('<!--tina-sections-->'.length, -'<!--/tina-sections-->'.length)))
    : null;

  let currentHtml = () => baseHtml;
  addPreviewButton(() => currentHtml());

  if (!sectionsMatch) return; // a page with no section list: click-to-edit only

  await loadScript('/js/vendor/liquid.browser.min.js');
  await loadScript('/js/ondc/tina-render.js');
  const { createRenderer, fromTina } = window.ONDCTinaRender;
  const renderer = createRenderer(window.liquidjs.Liquid, templates);
  live = createLive(baseHtml, id);

  let running = false;
  redraw = async function () {
    if (running) return;
    running = true;
    try {
      while (latest) {
        const data = latest;
        latest = null;
        const page = fromTina(data.pages, typenames);
        const env = { ...globals, ...page };
        const sectionsHtml = await renderer.renderSections(page.sections, env);
        if (stripComments(sectionsHtml) === savedSections) {
          live.hide();
          currentHtml = () => baseHtml;
          continue;
        }
        const html = shellFor(sectionsHtml);
        currentHtml = () => html.replace(/<style id="__tina-live-still">[\s\S]*?<\/style>/, '');
        await live.show(html);
      }
    } catch (e) {
      console.error('[tina-preview] live preview failed', e);
    } finally {
      running = false;
      if (latest) redraw();
    }
  };
  if (latest) redraw();
}

start();
