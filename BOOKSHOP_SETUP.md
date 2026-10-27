# Bookshop + Liquid + Eleventy — home page

**This is the version that looks different in CloudCannon.** The previous
zip (Liquid only) was a like-for-like swap and deliberately changed nothing you
could see. This one adds click-to-edit, live re-render, and add/remove/reorder
sections on the page itself.

**It has not been built or tested** — npm is unreachable from the environment this
was authored in. Treat it as a spike to validate, not a finished migration. The
Liquid-only version you already have running is the fallback.

---

## Run it

```bash
npm install
npm start          # http://localhost:8080/
```

The page should look exactly as it does now. Bookshop changes how components are
organised and how CloudCannon edits them, not what they render.

Browse the components on their own:

```bash
npx @bookshop/browser      # port 30775
```

---

## What changed from the Liquid-only version

| | Liquid only | This version |
| --- | --- | --- |
| Templates live in | `src/_includes/sections/*.liquid` | `component-library/components/<name>/` |
| Section list defined by | hand-written `_structures.sections` (~360 lines) | generated from each `<name>.bookshop.yml` |
| Page data key | `_type: metrics` | `_bookshop_name: metrics` |
| Rendering | `{% include %}` in a loop in `base.liquid` | `{% bookshop_include "page" %}` helper |
| Editing | sidebar form only | sidebar **plus** click-to-edit on the page |

### New layout

```
component-library/
├─ bookshop/bookshop.config.cjs
├─ components/
│  ├─ hero_story/        hero_story.bookshop.yml + hero_story.eleventy.liquid
│  ├─ metrics/           …13 components
│  └─ …
└─ shared/eleventy/
   ├─ page.eleventy.liquid      renders the sections array (editable regions)
   ├─ media.eleventy.liquid     image / video / embed switch
   ├─ footer-body.eleventy.liquid
   └─ social-icon.eleventy.liquid
.cloudcannon/postbuild          runs @bookshop/generate --editable-regions
```

`src/_includes/base.liquid` and `partials/site-header.liquid` stay where they are —
the header is not a page section.

### Each component is two files

`metrics.bookshop.yml` carries what used to be its `_structures.sections` entry:

```yaml
spec:
  structures: [sections]   # makes it addable to the page's `sections` key
  label: Key numbers
  description: A row of big numbers that count up as the reader arrives.
  icon: insights
blueprint:                 # starting content when an editor adds one
  anchor_id: financial
  title: The impact one open network has enabled
  items:
    - value: 100+
      label: What this number counts
  tagline: ''
_inputs: {}                # field widgets still come from cloudcannon.config.yml
```

`metrics.eleventy.liquid` is the same template, with one change: Bookshop passes
each section's keys as top-level props, so `{{ section.title }}` became `{{ title }}`.

---

## Things worth knowing before you test

**`_inputs` stayed central.** All the field labels and widgets are still in
`cloudcannon.config.yml`. Only the section library moved. That avoids duplicating
360 lines across 13 files.

**Six structures are still hand-written.** Bookshop generates `_structures.sections`
only. `buttons`, `bullets`, `figures`, `links`, `link_columns` and `social` are not
components, so they stay in `cloudcannon.config.yml`.

**The footer passes fields explicitly.** Under `bind:` there is no `section` object,
so `site_footer` hands each field to the `footer-body` helper by name rather than
assigning a shared `f` variable.

**`nl2br` and `embedUrl` are Eleventy filters** and do not exist in the Visual
Editor's client-side renderer. `metrics` uses `nl2br` and `media` uses `embedUrl`.
If either breaks live rendering, guard it:

```liquid
{% if env_bookshop_live %}{{ label }}{% else %}{{ label | nl2br }}{% endif %}
```

This is the most likely thing to need fixing. It is also exactly why this is a
spike on one page.

**The scroll animations should be unaffected.** `fx.js`, `ondc-home.js`,
`hero-map.js` and `home-network.js` act on rendered HTML rather than being template
plugins, and the `html.is-editing` rules in `cms.css` already flatten everything for
the editor.

---

## CloudCannon

Build settings are unchanged:

| Setting | Value |
| --- | --- |
| Site generator | Eleventy |
| Install command | `npm install` |
| Build command | `npx @11ty/eleventy --config=eleventy.config.js` |
| Output path | `_site` |

The new piece is `.cloudcannon/postbuild`, which CloudCannon runs after the build:

```bash
#!/usr/bin/env bash
npm i
npx @bookshop/generate --editable-regions
```

That generates the Structures from your components and wires up live editing.
Make sure it is committed with its executable bit set:

```bash
git update-index --chmod=+x .cloudcannon/postbuild
```

**Push this to a test branch and create a CloudCannon Site from it. Do not merge to
`main` until the checks below pass.**

### What to check in the editor

- [ ] The page renders correctly — all nine sections, nothing missing
- [ ] **Clicking a heading on the page lets you type into it**
- [ ] **Clicking an image on the page opens the image picker**
- [ ] Editing a field in the sidebar re-renders that section without a full rebuild
- [ ] Sections can be added, removed and reordered **on the page**
- [ ] The sidebar Page sections list still works
- [ ] Numbers in **Key numbers** still render (this tests the `nl2br` filter)
- [ ] The footer renders with logo, link columns and social icons

The three bold ones are the whole point. If they work, this approach is proven and
the remaining 48 pages can follow. If they fail, you lose nothing — the
Liquid-only version is still running on `main`.
