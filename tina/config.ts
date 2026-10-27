/* TinaCMS configuration.
 * ===========================================================================
 * Editors sign in at /admin. Every page is a Markdown file in src/pages whose
 * front matter holds a `sections` list; each section's `_template` names the
 * component in component-library/components that draws it.
 *
 * The section and data-file fields are generated, not written here:
 *   npm run tina:schema   → tina/generated/sections.json, data.json
 * See scripts/tina-schema.js for how they are worked out.
 *
 * TinaCloud reads TINA_CLIENT_ID and TINA_TOKEN from the environment at build
 * time; set both in the hosting provider's build settings.
 * =========================================================================== */
import { defineConfig } from 'tinacms';
import type { Collection, Template, TinaField } from 'tinacms';
import sections from './generated/sections.json';
import data from './generated/data.json';

/* The branch TinaCloud reads and commits to. Netlify sets HEAD, Vercel sets
   VERCEL_GIT_COMMIT_REF, GitHub Actions sets GITHUB_HEAD_REF / GITHUB_REF_NAME. */
const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  'main';

/* ── list item labels ────────────────────────────────────────────────────── */

/* Which field names a collapsed list row in the editor. Values are often HTML
   ("Every <strong>order</strong>"), so tags are stripped. */
const LABEL_KEYS = [
  'title', 'heading', 'name', 'label', 'question', 'rfp_name', 'year',
  'screen_label', 'eyebrow', 'text', 'meta', 'value', 'url',
];
const plain = (v: unknown) =>
  typeof v === 'string' ? v.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';

function labelFor(fields: any[]) {
  const keys = LABEL_KEYS.filter((k) => fields.some((f) => f.name === k && f.type === 'string'));
  return (item: Record<string, unknown>) => {
    for (const k of keys) {
      const text = plain(item?.[k]);
      if (text) return text.length > 80 ? text.slice(0, 77) + '…' : text;
    }
    return undefined;
  };
}

/* Give every list of objects a readable row label, all the way down. */
function decorate(fields: any[]): TinaField[] {
  return fields.map((f) => {
    if (f.type !== 'object' || !f.fields) return f;
    const out = { ...f, fields: decorate(f.fields) };
    if (f.list) {
      const label = labelFor(f.fields);
      out.ui = { ...f.ui, itemProps: (item: any) => ({ label: label(item) }) };
    }
    return out;
  });
}

const sectionTemplates: Template[] = (sections as any[]).map((t) => {
  const label = labelFor(t.fields);
  return {
    ...t,
    fields: decorate(t.fields),
    ui: {
      ...t.ui,
      itemProps: (item: any) => {
        const detail = label(item);
        return { label: detail ? `${t.label} — ${detail}` : t.label };
      },
    },
  };
});

/* ── pages ───────────────────────────────────────────────────────────────── */

const pages: Collection = {
  name: 'pages',
  label: 'Pages',
  path: 'src/pages',
  format: 'md',
  ui: {
    /* Opens the page beside its form, where clicking a section (or a marked
       field inside one) jumps to it. See js/ondc/tina-preview.js. Every page
       is served at /<file name>.html. */
    router: ({ document }) => `/${document._sys.filename}.html`,
    filename: {
      slugify: (values: any) =>
        String(values?.title || 'new-page').toLowerCase().trim()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    },
  },
  defaultItem: () => ({
    title: 'New page',
    description: '',
    wrapper_tag: 'main',
    wrapper_class: 'bk',
    wrapper_id: '',
    show_progress: true,
    styles: ['fx', 'scale', 'type-boost', 'mobile'],
    scripts: ['/js/ondc/fx.js'],
    sections: [],
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'string', isTitle: true, required: true },
    {
      name: 'description', label: 'Search engine description', type: 'string',
      description: 'One or two sentences. Shown in Google results and when the page is shared.',
      ui: { component: 'textarea' },
    },
    {
      name: 'permalink', label: 'Page address', type: 'string',
      description: 'The address this page lives at, for example /contact.html — keep it unique. Leave empty to use the file name.',
    },
    {
      name: 'nav_active', label: 'Highlighted menu item', type: 'string',
      description: 'Which top-menu entry is shown as active on this page.',
    },
    {
      name: 'preload_image', label: 'Preload image', type: 'image',
      description: 'The large image at the top of the page, fetched early so it appears sooner.',
    },
    { name: 'show_progress', label: 'Show scroll progress bar', type: 'boolean' },
    { name: 'show_sector_rail', label: 'Show sector rail', type: 'boolean' },
    {
      name: 'sections', label: 'Page sections', type: 'object', list: true,
      description: 'The blocks this page is made of. Add, reorder and remove them here.',
      templates: sectionTemplates,
    },
    /* Developer settings: how the page is wrapped and which assets it loads. */
    { name: 'wrapper_tag', label: 'Wrapper element (developer)', type: 'string' },
    { name: 'wrapper_class', label: 'Wrapper class (developer)', type: 'string' },
    { name: 'wrapper_id', label: 'Wrapper id (developer)', type: 'string' },
    { name: 'body_class', label: 'Body class (developer)', type: 'string' },
    {
      name: 'styles', label: 'Stylesheets (developer)', type: 'string', list: true,
      description: 'Names of files in /css/ondc, without .css.',
    },
    {
      name: 'scripts', label: 'Scripts (developer)', type: 'string', list: true,
      description: 'Script paths, for example /js/ondc/fx.js.',
    },
  ],
};

/* ── data files ──────────────────────────────────────────────────────────── */

/* One collection per file in src/_data. They cannot be created or deleted from
   the editor: the site's templates expect exactly these files. */
const dataCollections: Collection[] = Object.entries(data.labels).map(([name, label]) => ({
  name,
  label,
  path: 'src/_data',
  format: 'json',
  match: { include: name },
  ui: { allowedActions: { create: false, delete: false } },
  fields: decorate((data.fields as Record<string, any[]>)[name]),
}));

export default defineConfig({
  branch,
  clientId: process.env.TINA_CLIENT_ID || null,
  token: process.env.TINA_TOKEN || null,

  /* The admin app is written to ./admin and copied to _site/admin by Eleventy
     (see eleventy.config.js), so it is served from the site at /admin. */
  build: {
    outputFolder: 'admin',
    publicFolder: '.',
  },
  /* Uploads go to /images, where every existing picture already lives, and
     are stored in the repository. */
  media: {
    tina: {
      publicFolder: '',
      mediaRoot: 'images',
    },
  },
  schema: {
    collections: [pages, ...dataCollections],
  },
});
