# Deploying with TinaCloud

The site is still built by Eleventy. TinaCMS is the editor: it lives at
`/admin`, and TinaCloud handles sign-in and commits each edit to the GitHub
repository. Your host (Netlify, Vercel, Cloudflare Pages, GitHub Pages…)
rebuilds on each commit, as before.

## How content is laid out

| What | Where | Edited in Tina as |
| --- | --- | --- |
| Pages | `src/pages/*.md` (front matter only) | **Pages** |
| Section types | `component-library/components/<name>/` | blocks inside a page's **Page sections** |
| Site settings, directories, resources | `src/_data/*.json` | one collection per file |
| Images | `images/` | media manager |

Each section in a page has a `_template` key naming its component, for example
`_template: rich_text`. The Bookshop components render unchanged.

## One-time setup

1. **Push the repo to GitHub.** TinaCloud only works with a GitHub repository.
2. **Create a TinaCloud project** at <https://app.tina.io>. Connect it to the
   repository, and add your site's URL (and `http://localhost:8080` for
   local work) under the project's site URLs.
3. **Copy two values** from the project: the *Client ID*, and a *read-only
   token* (Tokens tab).
4. **Configure your host's build**:

   | Setting | Value |
   | --- | --- |
   | Install command | `npm ci` |
   | Build command | `npm run build` |
   | Publish / output directory | `_site` |
   | Node version | 20 or newer |
   | Environment variable | `TINA_CLIENT_ID` = the Client ID |
   | Environment variable | `TINA_TOKEN` = the read-only token |
   | Environment variable | `GITHUB_BRANCH` = `main` (only if your host doesn't set its own branch variable: Netlify sets `HEAD` and Vercel sets `VERCEL_GIT_COMMIT_REF`; `tina/config.ts` reads both) |

   `npm run build` runs `tinacms build`, which builds the editor into `admin/`,
   then runs Eleventy, which copies it to `_site/admin`. It then runs
   `scripts/postbuild.sh`, which writes the `build-info.json` the availability
   workflow checks. The `ONDC_*` variables listed at the top of that file work
   as they did on CloudCannon.
5. **Deploy**, then open `https://<your-site>/admin` and sign in with your
   TinaCloud account. Invite editors from the TinaCloud dashboard.

## Working locally

```sh
npm install
npm run dev      # Tina at http://localhost:8080/admin, site at http://localhost:8080
```

Local editing doesn't need TinaCloud credentials. Edits are written straight to
the files on disk.

## Changing the schema

Tina needs every field written out. These definitions are **generated** from
the Bookshop blueprints, the CloudCannon `_inputs` (labels, selects, image
pickers) and the existing content:

```sh
npm run tina:schema   # rewrites tina/generated/*.json
npm run dev           # regenerates tina/tina-lock.json
```

Run both after you add a component, change a blueprint, or add a field to a
data file. Then **commit `tina/generated/` and `tina/tina-lock.json`**.
TinaCloud reads the schema from the lock file, and only `tinacms dev`
regenerates it. If you push a stale lock file, the editor will show the old
fields.

The generator stops with an error if the content can't be represented in Tina,
for example a field that holds text in one place and a list in another, or two
section types that use one field name with different types.

## Differences from CloudCannon

- Editing is form-based. There's no click-on-the-page visual editing, because
  Tina's live preview needs a React front end.
- HTML fields such as `body` and `text` are plain text boxes holding HTML, not
  a WYSIWYG editor.
- New pages start with no sections. Add them from **Page sections**. The
  address defaults to `/<file-name>.html`.
- `cloudcannon.config.yml`, `.cloudcannon/` and `schemas/` are no longer used.
  They are kept only because the schema generator reads `cloudcannon.config.yml`
  for field labels. CMS_GUIDE.md and ADDING_PAGES.md still describe CloudCannon.
