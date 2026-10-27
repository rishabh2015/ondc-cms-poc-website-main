# Adding pages — architecture and how-to

Four pages are in the CMS: the home page, `/about-us.html`, `/rfp.html` and
`/careers.html`. Between them they cover the shapes almost every remaining
ondc.org page takes, so each new page is now mostly picking components rather
than writing them.

| Archetype | Example | What it is |
| --- | --- | --- |
| **Narrative page** | About, Careers | A full-bleed photo hero, then long-form storytelling sections |
| **Role / directory page** | RFPs/RFQs | A text hero with a counter, then a table or directory, then a white closing panel |

Careers is the proof that this is paying off: **four sections, one new
component.** The hero and the closing band were already built, and its "Our
people" band turned out to be the existing `numbered_lists` in a different box.
It needed no new CSS and no new JavaScript at all.

The role shape is the common one: `bk-role-hero` appears on 7 ondc.org pages and
`bk-role-close` on 9, so the components built for RFPs/RFQs are already most of
Gateway, Network Participants, Ecosystem Participants, Buyer NP, Seller NP and
Technology Service Provider.

---

## The rule that keeps pages from breaking

**Shared chrome is not a page section.** The navbar, the sector pill row and the
footer appear on every page, so they are rendered by the layout
(`src/_includes/base.liquid`) from `src/_data/site.json`, not by components in a
page's `sections` list.

This was a deliberate change after the chrome repeatedly rendered empty. The
reason it failed: a Bookshop component is re-rendered **in the browser** during
live editing, where site-wide data may not be available. Chrome rendered that way
is empty in the editor whenever that data does not arrive. Rendered by the layout,
it is baked into the HTML at build time and is correct on every page, always.

What this gives up: editing the nav or footer no longer updates the preview as you
type — you save and the next build shows it. That was already true of the navbar,
and it is a better trade than a footer that is sometimes blank.

| | Where it lives | How it is edited |
| --- | --- | --- |
| Navbar | `src/_includes/chrome/header.liquid` | **Header & Footer** in the sidebar |
| Sector pills | `src/_includes/chrome/sector-rail.liquid` | **Header & Footer** → Sector links |
| Footer | `src/_includes/chrome/footer.liquid` | **Header & Footer** → Footer |
| Page content | `component-library/components/*` | **Page sections** on each page |

A page turns the sector rail on with `show_sector_rail: true` in its front matter.
A page that needs its own footer sets `page_footer:` with the same fields as
`site.footer`; otherwise every page shares one.

### Page structure

```
<body>
  [scroll progress bar, if show_progress]
  navbar                      ← chrome, from the layout
  <div id="root"> or <main class="bk">
    page sections             ← the editable array
  </...>
  sector rail, if enabled     ← chrome
  footer                      ← chrome
</body>
```

Chrome sits **outside** the page wrapper, matching ondc.org. This matters on
category pages: `beckn.css` is scoped to `.bk` and its own header says it "must
not leak into that chrome".

---

## Stylesheets

`category-chrome.css` owns the design tokens, the reset, the container, the
navbar and the footer grid. **The layout always loads it first, on every page**,
outside the per-page list, so a new page can never lose its chrome styling. It
must come before `fx.css`, which layers the site finish on top.

Everything after that is per-page. `base.liquid` loops over two lists whose
defaults live in `src/pages/pages.json`:

```yaml
override:styles: [fx, scale, type-boost, beckn, mobile]
override:scripts:
  - /js/ondc/fx.js
  - /js/ondc/beckn.js
```

The `override:` prefix is required. Eleventy **concatenates** arrays through the
data cascade, so without it a page's list is appended to the default instead of
replacing it — you get every stylesheet twice.

`blocks.css` and `cms.css` always load last, in that order. `cms.css` is the
editor layer and must stay last.

| Page | Stylesheets |
| --- | --- |
| Home | category-chrome, styles, fx, hero, scale, mobile |
| About | category-chrome, fx, scale, type-boost, beckn, mobile |
| RFPs/RFQs | category-chrome, fx, scale, type-boost, beckn, mobile |
| Careers | category-chrome, fx, scale, type-boost, beckn, mobile |
| Contact | category-chrome, fx, scale, type-boost, beckn, **legal**, mobile |
| Complaints | category-chrome, fx, scale, type-boost, beckn, mobile |

RFPs/RFQs and Careers both needed **no new CSS at all** — every rule they use
was already in `beckn.css` and `mobile.css`. Expect that for most of the
remaining pages: check before copying anything.

Contact is the exception, and it is worth understanding before porting the
legal pages, which load the same file. `beckn.css` styles the whole contact
block *including* a full set of `.bk-contact-form .field` rules — so it looks
like `legal.css` is redundant. It is not. `.field input` and
`.bk-contact-form input` are **the same specificity** (0,1,1: one class, one
element), so load order decides, and `legal.css` loads last. Its plain `.field`
rules are what give the form its boxed grey inputs — 14px text, 8px radius,
`#F5F7FA` fill, a real border. Drop the file and the form silently falls back
to beckn's underlined fields. This was measured, not guessed: rendering the
page with and without it moves 42 of 60 elements.

`legal.css` was copied whole rather than cut down to the ~15% Contact uses.
It is 36 KB raw but **7.9 KB gzipped**, it defines its own `--blue` / `--ink`
token namespace that cannot collide with the `--bk-*` chrome tokens, and the
privacy-policy, cookie-policy, terms-and-conditions and complaint pages all
need the rest of it. A hand-cut subset would only drift from upstream.

Three more per-page switches, all hidden from editors:

| Field | Purpose | Home | About | RFPs/RFQs |
| --- | --- | --- | --- | --- |
| `body_class` | class on `<body>` | `home` | *(none)* | *(none)* |
| `wrapper_tag` / `wrapper_id` / `wrapper_class` | the element around the sections | `div#root` | `main.bk` | `main.bk.bk-role-page.bk-rfp-page` |
| `show_progress` | the scroll-progress bar | off | on | on |

Careers uses the same switches as About: `main.bk`, progress bar on, no body
class, no sector rail. Contact adds two classes the CSS keys off —
`main.bk.bk-contact-page.bk-contact` — and is otherwise identical.

---

## URLs

**The home page is `index.html`, and that is the only page whose file name
matters.** `src/pages/index.liquid` carries `permalink: /index.html`, so the
host serves it for the bare domain as well as for `/index.html`; before this
it was `home.liquid` at `/home.html` and `https://<site>/` returned a 404.

Two things are tied to that and would break quietly if the file were renamed
back:

- **The home page is its own collection**, and that is not tidiness. CloudCannon
  builds a page's address from `collections_config.<collection>.url`, and
  `[slug]` is the file name without its extension — except that **for a file
  named `index` the slug is an empty string**, which CloudCannon documents.
  So `/[slug].html` renders as `/.html`: the Pages list showed that address and
  the preview pane 404'd on it. One slug-based pattern cannot produce both
  `/about-us.html` and `/`, so `index.liquid` sits in a `home` collection with
  a literal `url: /`, and `pages` excludes it with `'!index.liquid'`.

  Both collections point at `src/pages`, deliberately: `src/pages/pages.json`
  is the Eleventy directory data file carrying the layout, the wrapper and the
  default stylesheets, and it only applies to files in that folder. Moving the
  home page to a folder of its own would mean keeping a second copy of that
  file in step with the first.

  None of this affects the build — Eleventy reads `permalink`, not the
  CloudCannon config. It is purely what the editor opens.
- The menu's "Home" and "Roles You Can Play" items are bare anchors
  (`#site-top`, `#find-your-place`). The header prefixes them with the home
  address on every other page and leaves them bare on the home page itself —
  otherwise clicking them reloads instead of scrolling. Because the home page
  answers to both `/` and `/index.html`, that test asks *is this the home
  page*, rather than comparing against whichever address `site.home_url`
  happens to hold.

`site.home_url` (in the CMS under Header & Footer) is `/`. It is the string
pasted in front of those anchors and into the logo link, so it is the one place
to change if the home address ever moves again.


Every page is served flat at `/<slug>.html`, which is what
`collections_config.pages.url: /[slug].html` expects. The two must agree — when
they disagree CloudCannon shows "No preview available" even though the build
succeeded.

Links in the header, footer and sector rail already point at the remaining 45
pages. They 404 until each page is built, and start working the moment it lands.

### Menu links that point at the home page

Two menu items — "Home" and "Roles You Can Play" — point at a *spot on the home
page* (`#site-top`, `#find-your-place`). A bare `#anchor` only works while you
are already on the home page; from any other page it jumps nowhere. ondc.org
handles this by writing `../index.html#site-top` on its inner pages.

`chrome/header.liquid` does the same automatically: a menu URL that starts with
`#` is prefixed with `site.home_url` on every page except the home page itself,
so the home page keeps its smooth in-page scroll and the other 47 pages
navigate. The logo links to `site.home_url#site-top` the same way, and the
current page's menu item gets `class="nav-link active"`.

Keep writing `#find-your-place` in `site.json` — the prefixing is automatic.

---

## The component library

29 components, each a folder under `component-library/components/<name>/` with a
template and a `.bookshop.yml` spec. All are page content; none is chrome.

**Added for the About page**, all reusable:

| Component | What it is | Where it is used again |
| --- | --- | --- |
| `page_hero` | Full-bleed hero: photo, heading, paragraphs, buttons | the narrative pages |
| `closing_cta` | Short closing heading + buttons | ~44 pages (both variants) |
| `numbered_lists` | A lead beside groups of auto-numbered points | sector pages, careers |
| `institutions` | Named organisations + a logo strip with a counter | about, investor pages |
| `people_grid` | Photo, name, role, organisation | about, careers |
| `awards` | Featured award + awards by year, with a lightbox | about |
| `timeline` | Year-by-year story with the animated India map | about |

**Added for the RFPs/RFQs page:**

| Component | What it is | Where it is used again |
| --- | --- | --- |
| `role_hero` | Text hero with an optional live counter on the right | **7 pages** — RFPs, Gateway, Network/Ecosystem Participants, Buyer NP, Seller NP, TSP |
| `rfp_ledger` | Tabs + search over a table of tenders, each a name and a link | RFPs |

**Added for the Careers page — just one:**

| Component | What it is | Where it is used again |
| --- | --- | --- |
| `life_blocks` | Titled text blocks beside a column of photos | Careers |

**Added for the Contact page — two:**

| Component | What it is | Where it is used again |
| --- | --- | --- |
| `page_title_band` | A plain heading band at the top of a page, no photo | Contact; the legal pages next |
| `contact_form` | The two-column block: message form, office details, map | Contact |

**Added for the Complaints page — five, and four of them pay for themselves
immediately:**

| Component | What it is | Where it is used again |
| --- | --- | --- |
| `journey_spine` | Numbered steps down an animated line, with expandable detail | **11 pages** — Complaints and the ten sector pages |
| `stat_grid` | Rows of figures that count up, with a legend | **11 pages** — the same set |
| `faq_accordion` | Questions that open one at a time | 3 pages — Complaints, Careers, Payment Assurance |
| `buyer_directory` | Searchable, paged directory of apps and their contacts | Complaints (the directory shape itself recurs on 6 pages) |
| `escalate_panel` | Dark call-out with conditions, actions and key facts | Complaints |

Counting class usage across the reference repo before building is what showed
this: `.bk-mech`/`.bk-step-*` and `.bk-statgrid`/`.bk-stat-*` each appear on
eleven pages, so the ten sector pages are now mostly a matter of filling these
two in. Complaints' hero needed no new component at all — it is `page_hero`
with no photo.

Careers' other three sections were variants of things that already existed:

| Section on ondc.org | Handled by | How |
| --- | --- | --- |
| `.bk-hero.bk-hero-about` | `page_hero` | new **animation** field — `reveal` (About) or `intro` (Careers) |
| `.bk-culture` | `numbered_lists` | new **variant: culture** — same numbered points, plainer box, group headings hidden |
| `.bk-about-close` | `closing_cta` | unchanged, Plain layout |

### A variant, not a new component

`bk-role-close` (the white rounded panel at the foot of 9 role pages) is the
same content as `bk-about-close` in a different box, so it became a **`variant`
field on `closing_cta`** rather than a tenth component:

| `variant` | Markup | Extra field |
| --- | --- | --- |
| *(empty)* — "Plain" | `section.bk-about-close` | — |
| `role` — "Panel" | `section.bk-role-close` | `body`, one paragraph |

This is the rule that keeps the library at 29 instead of 45: **a new visual
treatment of the same content is a variant field; only a new content shape is a
new component.**

### The ledger: tenders are CMS content, not a Google Sheet

ondc.org fetches its tender rows from a Google Sheet at runtime. **This build
does not.** Tenders are a `tenders` array on the `rfp_ledger` section, so
publishing one is a form with a file upload rather than a spreadsheet edit, and
the page has no dependency on Google at all.

Clicking **+** on the list offers three things to add — **Open RFP / RFQ**,
**Closed RFP / RFQ**, **Empanelled agency** — and all three take the same
fields: `rfp_tab`, `rfp_no`, `rfp_name`, `rfp_deadline` and an
`rfp_documents` list. Each document is a `doc_type` (what the document is) and
a `doc_url` pointing at it. **Documents are linked, never uploaded** — an
editor pastes the address of a file that is already online, typically ONDC's
S3 bucket. There is no upload input, so nothing is ever written into the
repository by publishing a tender, and deleting a tender cannot orphan a file.

The three tabs are an array too, with one entry per tab (`source` is `open`,
`closed` or `empanelled`) carrying its own empty-state heading and message. A
tab with nothing in it shows that message — which is how "No empanelled
agencies yet" works now, rather than being a hard-coded message tab.

Three decisions behind that shape, each with a reason worth keeping:

**Why an array on the section, not a CloudCannon collection.** A collection
would give each tender its own sidebar entry, which is nicer at 50+ tenders.
But collection data is not exposed to Bookshop's browser re-render, so the rows
would vanish while editing the section — the same failure that moved the chrome
into the layout. An array is a plain component prop, so it survives. If the list
ever outgrows this, a shared data file under `data_config` is the next step, not
a collection.

**Why the deadline is plain text, not a datetime input.** A tender closes at a
moment, not on a day, so the deadline carries a time: `30.11.2026 17:30`, or
`30.11.2026` on its own for end-of-day.

It started as `type: datetime` and that had to be abandoned. CloudCannon's
datetime input **blanked stored values on save** — reopening a tender showed an
empty deadline, and re-saving wrote the blank back, so deadlines were lost a
few at a time. `rfp_deadline` is now `type: text` guarded by a validation
pattern:

```yaml
options:
  pattern: '^\s*$|^\d{2}\.\d{2}\.\d{4}(\s+\d{1,2}:\d{2}(:\d{2})?)?\s*$'
```

so a malformed date is rejected in the sidebar rather than at render time, and
an empty value is allowed for an empanelled agency. The value is written into
`data-rfp-due` verbatim and parsed in the browser by `js/ondc/rfp-ledger.js`.

The timezone trap is closed in that parser rather than by a date library. It
reads the parts and builds the instant arithmetically:

```js
return Date.UTC(y, mo - 1, d, hh, mi, ss, …) - IST_OFFSET_MS;   // 5.5h
```

India has no daylight saving, so a fixed offset is exact — no timezone
database, nothing to keep updated. A missing time means end of day
(`23:59:59.999`). `eleventy.config.js` also pins `process.env.TZ` to
`Asia/Kolkata` so any build-time formatting is IST. Every reader sees the same
`30.11.2026, 17:30 IST` wherever they are, and the open/closed comparison is an
integer comparison. Verified by loading the same built page with the viewer
timezone set to `America/New_York`: identical output.

**Why `tab` and the date both exist.** The editor picks a tab when adding an
entry, and that is what an empanelled agency goes by — it is never moved. For a
tender, the **Move tenders between Open and Closed automatically** switch
(`auto_by_date`, on by default) lets the closing date override that choice: a
tender has to move to Closed the day after its deadline and nobody will rebuild
the site at midnight. The editor's `tab` is the fallback — when the switch is
off, or when the date is missing or unreadable, which is also what stops a typo
hiding a live tender.

Each tender is rendered into **both** the open and closed panels and the script
hides the wrong one; an empanelled entry is rendered only into its own panel.
That keeps the DOM static — see the rule below.

Verified by running the same built page with the clock moved forward:

| Browser's date | Open | Closed | Counter |
| --- | --- | --- | --- |
| 14.10.2026 | 001, 014 | 009 | 2 |
| 30.11.2026 *(the deadline itself)* | 001, 014 | 009 | 2 |
| 01.12.2026 | 014 | 001, 009 | 1 |
| 01.03.2027 | — | all three | 0 |

With `auto_by_date` off, the same page holds the editor's choice (001, 014 open
/ 009 closed, counter 2) at every one of those dates. The empanelled agency
stays in its own tab throughout, under both settings.

### The rule that keeps that script safe in the editor

Every feed panel is rendered with **all** tenders in it and the script hides the
ones that do not belong. It never moves or creates row elements.

That is deliberate. Inside the editor, Bookshop replaces the section's DOM on
every keystroke, and a script that reshuffled rows would fight the re-render in
a loop. Hiding is idempotent — running it twice does what running it once does.
The only node it ever adds is the "nothing here" block, and the observer is
muted while that happens. Verified by forcing three re-renders in a row and
confirming the output does not drift.

Apply the same discipline to any future component that reacts to a re-render.

### The contact form: editable shape, no backend

The site is static, so the form does not POST anywhere. On Submit it builds a
subject and body from what the visitor typed, opens Gmail in a new tab with the
message ready to send, and reveals a panel offering Outlook and the OS mail app
as alternatives. (A bare `mailto:` would launch whatever desktop client the OS
has registered, usually Outlook, which is why Gmail is the default route.)

The point worth keeping is that **the form's shape is content, not code.**
`js/ondc/contact-form.js` hard-codes no field names. It reads the rendered
markup:

| Attribute | Meaning |
| --- | --- |
| `data-contact-to` on the `<form>` | the recipient, and what marks the form |
| `data-contact-field="Label"` | include this answer in the email, under this heading |
| `data-contact-long` | put this one last, on its own lines (the textarea) |
| `data-contact-send="gmail\|outlook\|default"` | the three links to fill in |
| `data-contact-subject-prefix` / `-field` / `-fallback` | how the subject is built |

So an editor can add a field, rename one, reorder them, change the dropdown
choices or delete a field in CloudCannon, and the composed email follows with
no code change. Verified by adding an `Organisation` field and a `Partnership`
choice from front matter alone: both rendered, and the new answer appeared in
the email body in the right position.

Fields are grouped into **rows**: one field fills the row, two sit side by side
in a `.field-row`. That mirrors the markup ondc.org uses and is the only reason
the nesting is two levels deep.

The right-hand column (address blocks, map, directions button) disappears
entirely when all three of its fields are empty, letting the form run full
width — see rule 7 below for the mistake that made that not work the first
time.

One deliberate difference from ondc.org: it writes `Name: <first> <last>` into
the email by hard-coding those two ids. The generic version cannot merge two
fields it knows nothing about, so it writes `First Name:` and `Last Name:` on
their own lines, using each field's own label. Everything else about the
message — recipient, subject, the Gmail/Outlook/mailto routes — is identical.

In the editor, Submit does **not** open a Gmail tab (the script checks for
`is-editing`), and the "other ways to send" panel is forced visible by
`cms.css` so its wording can be clicked and edited — the same trade as the RFP
tabs. The map iframe gets `pointer-events: none` there, or it swallows the
clicks meant for the panel around it.

### The Complaints page: three decisions

**Global data reaches a component, and that is how the directory works.** The
Buyer App directory is 143 entries. Those are not fields on the section: they
live in `src/_data/buyer_apps.json` and are listed in `cloudcannon.config.yml`
under `data_config`, beside `site`. Two things make that safe, and both were
checked rather than assumed:

- a Bookshop component *can* read Eleventy global data. A throwaway component
  printing `{{ buyer_apps.size }}` rendered `143` at build time. No component
  had needed this before, so it was worth proving before building on it;
- `data_config` is what carries the file into Bookshop's **browser** re-render,
  which is why `site.json` is already listed there. Without it the directory
  would render empty while editing.

This is the escalation `ADDING_PAGES.md` already predicted for the RFP ledger:
*"if the list ever outgrows this, a shared data file under `data_config` is the
next step, not a collection."* 143 entries nested in a page's front matter
would be unusable in the sidebar, and the list is a copy of an upstream
directory — refreshed wholesale, not edited line by line.

Every card is rendered at build time and the script only toggles `hidden`.
Searching and paging never move, create or delete a node, so a Bookshop
re-render costs nothing but a re-run — the same rule the ledger follows.

**The spine is driven by two fixed ids, so there can be only one per page.**
`beckn.js` calls `getElementById('bk-mech')` for the section and
`getElementById('bk-spine-fill')` for the line that grows. Both are singletons.
A second `journey_spine` on the same page would render correctly and never
animate, and renaming the section's anchor away from `bk-mech` turns the whole
effect off. The field comment in `journey_spine.bookshop.yml` says so where an
editor will actually see it.

**The complaint figures are CMS fields, not a live Google Sheet.** ondc.org
fetches them from the complaints team's sheet through the gviz CSV endpoint on
every page load. This build does not, for the same reasons the RFP ledger
stopped doing it: requirement 1 asks for numbers and statistics to be editable
in the CMS, and a runtime fetch means the section is blank whenever the sheet's
sharing changes, the endpoint is slow, or the reader is offline. That is not
hypothetical — rendering the reference page in a sandbox without network access
produces an **empty** stats section, which is exactly what the side-by-side
check showed.

The trade is real and worth stating: someone now has to copy the figures across
when the sheet changes, instead of it happening by itself. The seed values came
from the live sheet (`13-10-2026`: 1254 + 1584 + 236 = 3074, which reconciles),
and `as_of_note` is the field that carries the "Last updated on…" line.

### The Network Participants page: four decisions

**The CSVs became a database; they are not fetched any more.** ondc.org builds
this table in the browser: `participant-csv.js` fetches two CSVs and a logo map
(~95 KB), parses them, and writes the rows in with `innerHTML`. None of that
can work here, for two reasons that are the whole point of this build —
requirement 1 asks for the entries to be editable by a non-developer, and a
CSV fetched at runtime is not something the CMS can see; and a section whose
rows arrive from `fetch()` renders **empty** in the visual editor, because
Bookshop re-renders components in the browser with only the data
`data_config` carries.

So the CSVs were converted once, by `scripts/import-network-participants.js`,
into `src/_data/network_participants.json`. Everything the browser used to do
at runtime happens there instead: canonicalising category labels, splitting the
three-line Contact blob into `spoc` / `email` / `phone`, giving a bare domain
like `nammayatri.in` a scheme, and working out the two-letter monogram for a
participant with no logo. What lands in the JSON is already the shape the page
renders and the CMS edits. Re-run the script when the participants team hands
over a fresh CSV drop; it takes the path to an ondc.org checkout and rewrites
the three data files, copying any new brand logos into `images/np-logos/`.

**Deleting an entry in the CMS deletes it from the site.** That was a stated
requirement, and it falls out of rendering at build time: every row on the page
comes from the data file, so a build after a deletion simply does not draw it.
Verified rather than assumed — removing `Paytm` and rebuilding left no trace of
it in the HTML. Adding works the same way in reverse: the component sorts by
name at build time, so an entry appended to the **end** of the file lands in its
alphabetical place (`Mango Commerce Pvt Ltd` appended last came out at position
166 of 344, between `Mahawanti…` and `Mango Fox`).

Alphabetical is the default for both lists, per the requirement. The order is a
per-list field, so the Key list can be put back to its volume ranking with one
click — see the note in the CMS guide.

**The taxonomy is read back off the DOM, not duplicated in the script.** The
left-hand tree is drawn from `src/_data/np_categories.json`, which is a flat
list of `{ name, parent }`. `network-participants.js` rebuilds the parent/child
map by reading the `data-parent` attributes the template just wrote. That is
what lets an editor add a category in the CMS without a code change — and what
stops the taxonomy existing in two places that can drift, which is exactly what
`participant-csv.js` does today with a 60-line `TAXONOMY` constant.

A category a participant carries that the taxonomy has no row for still shows
and still filters; it is grouped under **Other**.

**Three field names are longer than they look like they should be.** `_inputs`
at the top of `cloudcannon.config.yml` is keyed by field *name* across every
data file and page at once. A role written as `{ value, short, pill, full }`
picks up the labels the home page's figures and hero pills already claim for
`value` ("Number") and `pill` ("Tab name"), in a sidebar where the editor has
no way to tell why. Hence `role_value` / `role_key` / `role_label` /
`role_full`. The same rule bit once more inside the component itself: `_inputs`
there is one flat map, so `labels.directory_tabs` could not sit under the
`directory_tabs` array, and is `labels.tabs_aria`.

This is rule 5's cousin and worth stating on its own: **a global `_inputs` key
is global.** Before naming a field on a data file, grep
`cloudcannon.config.yml` for it.

#### Rendering 494 rows

Both lists are rendered in full, into two `<tbody>` elements of one table:
859 KB of HTML, 72 KB over the wire. That is the cost of the no-new-nodes rule
and it was taken deliberately — the alternative is the runtime fetch above.
Two things keep it from being felt:

- rows past the first page ship with `hidden` on them. Without that the browser
  paints 494 rows and the script collapses them to 20 a moment later, which is
  a layout shift the length of the page;
- a `<noscript>` block hands every row back and hides the controls that would
  then be lying — search, the role toggles, the category panel and the pager.
  With no script the page is still the whole directory, just not a filterable
  one.

The filter chips and the page numbers are drawn by the template too, all of
them, hidden. A chip the script had to create is a chip that disappears on the
next keystroke in the editor.

### Ecosystem Participants: the component paying for itself

This page cost no new component, no new JavaScript and no new CSS. It is the
same `participant_directory` section with different fields, which is the whole
reason that section was built generic rather than as `network_participants`.

ondc.org's two pages are near-identical files — the diff between their inline
scripts is four constants and the tab switcher. What actually differs:

| | Network Participants | Ecosystem Participants |
| --- | --- | --- |
| Lists | two, with a switcher | one |
| Category column | `Live Categories` | `Category` |
| Sub-line under the name | `Technology Service Provider`, "Enabled by" | `Live NP supported`, "Live NPs supported" |
| Roles present | Buyer NP, Seller NP | the four TSP roles |

Only the first of those needed any code. The other three are handled without a
branch anywhere:

- **the two differently-named columns land in the same two fields.** The
  importer takes the column names as an argument, so `Live Categories` and
  `Category` both become `categories`, and `Technology Service Provider` and
  `Live NP supported` both become `enabled_by`. One row shape, three sheets.
- **the wording that differs is a label on the section**, not a second code
  path: `labels.enabled_by` is "Enabled by" on one page and "Live NPs
  supported" on the other, set in the CMS.
- **the roles narrow themselves.** The script hides any role toggle or category
  branch the visible list has no rows for, so the ecosystem page offers the
  four TSP roles and the network page offers Buyer/Seller NP, from one shared
  `np_roles.json`. Nothing declares which page gets which.

The one real change was the list switcher. It already rendered only when
`lists.size > 1`; the page just needed the empty tab-note paragraph dropped
too, or a one-list directory holds a margin open for a line of text that will
never arrive.

**A fourth directory is now two lines of Liquid plus one dropdown option.** The
`{% case list.source %}` in the component maps each option to its data file.
Liquid cannot resolve a global by a name held in a variable, so this stays
written out — which is also what makes it obvious where to add the next one.

**Its data is a file of its own**, `src/_data/ecosystem_participants.json`, not
a third list inside `network_participants.json`. The two directories are
maintained by different people, so deleting an ecosystem participant should
never rewrite the network file: smaller diffs, and no merge conflict when both
are edited the same afternoon.

**This page closed the last dead link on the site that was ours.** The tab
above the network directory, and the entries in the navbar and footer, all
pointed at `/ecosystem-participants.html` and 404'd. Everything still dead is a
page nobody has migrated yet.

### Resources: nineteen pages, one data file

The Resources section is the hub plus eighteen sub-pages. On ondc.org those
eighteen files are the same ~203-line template; the diff between any two of
them is the hero copy, the intro paragraph and one `data-category` attribute.
Everything else — the sidebar tree, the breadcrumbs, the document lists, the
hub cards, the global search — is built in the browser from
`public/data/resources.json`.

That shape ports almost unchanged. `src/_data/resources.json` carries 20 areas,
105 groups and 482 documents, and **one file drives all nineteen pages**: the
hub cards and their counts, the search index, every sidebar, every breadcrumb
trail and every document list. Delete a document in the CMS and it leaves all
of them on the next publish.

Four new components, three new variants, no new page archetype:

| | |
| --- | --- |
| `resource_index` | the hub's card grid, from the areas marked "Show on the hub" |
| `resource_search` | the hub's search, with all 500 result rows pre-rendered |
| `resource_library` | a sub-page's whole body — breadcrumbs, sidebar, documents, sub-area cards, video grid |
| `newsletter_rows` | the two download rows at the foot of the hub |
| `page_hero` → **Compact** | the short banner each sub-page opens with |
| `closing_cta` → **Band** | the wide call to action each sub-page closes with |
| `page_title_band` → **Knowledge base** | the hub masthead |

The three variants are the convention this repo already states — *a new visual
treatment of an existing content model is a variant field, not a new
component*. `page_title_band.bookshop.yml` had even left a note predicting the
third one; the Resources hub was the page that triggered it.

**A second reveal system now exists, deliberately.** `.bk-rv` (beckn.js) stages
the ONDC-page sections; `.reveal` (legal.css) stages the legal and resources
pages, and the two stylesheets position their elements differently. ondc.org
ships the `.reveal` observer inline at the bottom of every one of those pages;
here it is `js/ondc/reveal.js`, listed once per page. Without it `.reveal`
holds every element at `opacity: 0` and the pages render blank — so it needs
its editor rule in `cms.css` exactly the way `.bk-rv` does (rule 2).

#### Three traps worth naming

**1. A global `_inputs` key is global — and this data file collided six ways.**
Upstream's field names are `categories`, `sections`, `items`, `parent`, `note`
and `source`. Every one of those already means something else on this site:
`sections` is the list of blocks on a page, `categories` is the participant
multiselect, `note` is labelled "Note for editors, never shown on the live
site" — the exact opposite of what a group note does. So the importer renames
them on the way in to `areas`, `doc_groups`, `documents`, `parent_area`,
`group_note`/`doc_note` and `provenance`, and `type` becomes `doc_type`
because a bare `type` as a global input name is a trap for whoever comes next.

This is rule 9's companion and the second time it has cost real time. **Before
naming a field on a data file, grep `cloudcannon.config.yml` for it.**

**2. Liquid's `where` returns EVERYTHING when its value is undefined.** Not
nothing — everything. So

```liquid
{% assign parent = areas | where: "id", cat.parent_area | first %}
```

on a top-level area does not yield nil; it yields the whole list, and `first`
hands back whichever area happens to sit first in the file. A typo in that one
line (`parent_area_area`) silently put "Governance and Policy" into the
breadcrumb of **every page on the site** and raised no error at all. Ask
whether there is a parent before looking one up:

```liquid
{% if cat.parent_area != blank %}{% assign up1 = … %}{% endif %}
```

**3. Two things Eleventy gives you are not there in the editor.** Bookshop
re-renders a component in the BROWSER with plain LiquidJS: Eleventy's custom
filters and `slugify` do not exist, and neither does `{% render %}`. So the
section anchors are `sec-1`, `sec-2` … by position rather than slugified from
the heading, and the icon set is a `case` block inlined at each of its three
call sites rather than a shared partial. Both are uglier than the obvious
version and both work in the editor, which the obvious version does not.

#### A wrapper class is an API, and loading a stylesheet is a choice

The Resources sub-pages first shipped with `wrapper_class: bk bk-resources-page`
and the same stylesheet list as the hub. Both were wrong, and together they
broke every document row on all eighteen pages: the icon, the text and the
arrow stacked instead of sitting on one line.

`beckn.css` carries

```css
.bk-resources-page .res-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; }
```

at specificity `0,2,0`, which beats `resources.css`'s `.res-row { display: flex }`
at `0,1,0` **whatever order they load in**. That rule is written for the HUB,
where a search result has two children (body, arrow) and two columns are
exactly right. A sub-page's document row has three (icon, body, arrow), so the
arrow fell to a second grid row.

On ondc.org `bk-resources-page` appears on the hub and nowhere else, and the
sub-pages do not load `beckn.css` at all — they load `legal.css`,
`resources.css`, `fx.css`, `scale.css`, `mobile.css`. Checking every class the
sub-pages render against every stylesheet showed none of them needs `beckn` or
`type-boost`, so both are gone from those pages: the bug cannot come back, and
each sub-page fetches 135 KB less CSS.

Two general lessons, both cheap to apply and expensive to miss:

- **A class on the page wrapper is an API other stylesheets hang rules off.**
  Before copying one onto a new page, grep for `.that-class ` with a
  descendant after it.
- **Copy the original page's stylesheet list, not the neighbouring page's.**
  Two pages in the same section can legitimately load different sets, and this
  section is exactly that case — the hub is a `.bk-*` page, the sub-pages are
  `.legal`-family pages that happen to share a data file.

The button on those pages was wrong for a related reason. `.btn-primary` is a
blue gradient and the closing band is a blue gradient, so the call to action
all but vanished; ondc.org uses `.btn-light` (white) there. The `band` variant
now maps "Solid" to `.btn-light` and the secondary to `.btn-ghost`, the
translucent outline built for dark surfaces — so on a dark band the editor's
"main button" is still the one that reads as the main button.

#### What pre-rendering costs here

The hub carries all 500 search rows — 482 documents plus one per area — at
358 KB. That is not a saving forgone: the index has to be in the page either
way, and as HTML it is barely larger than the JSON blob the create-on-the-fly
alternative would need, while keeping the no-new-nodes rule intact.

Relevance ordering survives without moving a node. The results box is a flex
column and the script sets `order` — 1 for a title match, 2 for one found only
in the blurb — which is what ondc.org achieves by rebuilding the list. The
guard for that, and the `[hidden]` guard rule 9 demands for `.res-row`
(`display: flex`, so `hidden` alone does nothing), live in
`css/ondc/resources-search.css` rather than `resources.css`, because that file
is a byte-copy of upstream's and a refresh would silently delete them.

#### Two display switches the data file carries

Most of what a row shows is the same on all nineteen pages. Two things are not,
and ondc.org handles both with a flag on the area rather than a special case in
the template:

- **`hide_type_chip`** — an area whose documents are all PDFs drops the type
  chip. A "PDF" badge on every row of the page says nothing, and the room is
  better spent on the date.
- **`label_chips`** — an area whose rows carry *two* numbers names each one, so
  the row reads `Date 14/07/2026` · `Notification No. 2026/07/14/01` rather
  than two bare dates side by side, which read as a puzzle.

Only Notifications sets either, and that is the point: they are area data, not
page markup, so turning them on for the next area is a checkbox in the CMS. The
words themselves ("Date", "Notification No.") are in the page's **Wording around
the documents**, with everything else an editor might reword.

> **Our copy of an upstream stylesheet drifts, and the drift is invisible.**
> `css/ondc/resources.css` is a byte-copy of ondc.org's. Between the import and
> this change, upstream added `.res-chip.is-meta` — the style these labelled
> chips need — and a collapsible-sections feature. Nothing warned us; the
> markup simply had no rule to match. Refresh the file wholesale from upstream
> before concluding a style is missing, and never patch it in place: the next
> refresh deletes the patch. Page-specific additions go in a file of our own,
> the way `resources-search.css` already does.

#### The notice box

Two areas carry a standing caution above the filter, where it is read before
anything is downloaded: Marketing ("ONDC's communication collaterals and brand
assets must not be modified") and Investor Corner ("some of these are
password-protected"). It is the **Notice above the documents** field, empty on
the other sixteen.

It is rich text, so CloudCannon wraps whatever an editor types in a `<p>`.
Upstream writes the sentence straight into the div and therefore has no rule
for a child paragraph — a browser-default `margin: 1em 0` would push the text
out of the box's own padding. The guard for that is in
`css/ondc/resources-search.css`, not `resources.css`, for the usual reason.

#### Disclosures folds its groups, and nothing else does

A hundred and two documents under five headings is a page you scroll past, not
one you read, so ondc.org marks that one list `data-collapsible` and renders
each group as a `<details>` bar carrying its own count. Every other sub-page
keeps the plain headings.

Here it is a checkbox on the section — **Fold each group of documents** — and
both shapes hold the *same* documents: the rows are captured once into
`group_body` and emitted into whichever wrapper the flag chooses, so the two
shapes cannot drift apart. A folded list also carries the area eyebrow once,
above the stack, instead of repeating it on every bar.

The accordion is still inside the no-new-nodes rule. It sets `open` on an
element that is already in the page and animates the height of a `<div>` that
is already in the page; it creates nothing. Three details are worth knowing
before touching it:

- **`<details>` cannot transition its own height.** The body is animated by
  hand, and `open` is not cleared until a collapse has *finished* — so
  mid-flight the element still reports `open: true`. What a click reverses is
  therefore where the section is *heading* (`headingOpen`), not where it is.
- **A closed `<details>` still reports its content's full height.** The
  collapsed end of the travel is a literal `0`, never a measurement.
- **The filter has to reach inside a folded group.** While a query is active
  every group with a hit is opened without animating, and the state the reader
  left behind is restored when the box is cleared.

In the editor all five unfold, via `cms.css`. Closed, the page is five grey
bars and reads as content that failed to load — and nothing inside them is
click-to-edit anyway, since it all comes from the Resources library data file.

#### nav_active

Eighteen sub-pages need the "Resources" menu item lit, and none of them *is*
`/resources.html`. A page can now set `nav_active` in its front matter to the
menu address it belongs under; the header falls back to the page's own URL,
which is what every other page wants.

### CloudCannon rewrites page front matter when an editor saves

Comparing the Careers page before and after it had been opened and saved in
CloudCannon shows the file rewritten: lines re-wrapped at a different width,
`url: 'https://…'` unquoted to `url: https://…`, keys within a section
reordered — and **every `#` comment deleted**. The built HTML was
byte-identical, so none of it changes the site. But it means one thing:

> **Never put an explanation in a page's front matter and expect it to
> survive.** The first editor who opens that page in CloudCannon and saves will
> silently delete it.

Anything a future developer or editor needs to know belongs in one of two
places that CloudCannon never rewrites:

- the field's `comment:` in the component's `.bookshop.yml` — which is better
  anyway, because it shows up in the editor sidebar next to the field it is
  about;
- this file.

Careers is the live example. Its `anchor_id` must stay `bk-mech`, because that
id is what makes `beckn.js` apply the word-by-word colour effect to the lead
paragraph. The comment saying so was written into `careers.liquid` and is now
gone. The warning that survived is the one in `numbered_lists.bookshop.yml`,
where an editor actually sees it.

The same applies to the note in `contact-us.liquid` explaining why `legal.css`
is in its stylesheet list — expect it to disappear on first save. That reasoning
is recorded under **Stylesheets** above, which is why it is safe to lose there.

### Nine rules that are not optional

**1. A component reads the data it needs itself.** It must not receive data
through a helper or the layout — Bookshop re-renders components in the browser,
and anything passed in from outside is gone. This is the same failure that moved
the chrome into the layout.

**2. Anything that animates needs an editor rule in `css/ondc/cms.css`.**
`.bk-rv` starts at `opacity: 0` and only reveals on scroll. The editor never
scrolls, so without a rule the page renders invisible. The same applies to
`.bk-scrub-w`, the per-word spans `beckn.js` creates inside a `[data-bk-scrub]`
paragraph: they start grey and colour in as the block scrolls past, so in the
editor the paragraph sits there unreadable. Both rules mirror what `beckn.css`
already does under `prefers-reduced-motion` — that block is a good place to
look when adding a page, because it lists everything on the site that animates. The navbar is also pinned
to `position: static` in editor mode — left sticky it floats over the first
section and swallows that section's hover controls, making the top section
impossible to select.

**3. Never hide half of a cancelling pair.** Several sections are built from two
elements whose heights cancel out: a sticky stage that is one viewport tall, and
the content after it that pulls itself back up with a matching negative margin.

```css
.bk-tl-stage   { position: sticky; height: calc(100vh / var(--ui-scale, 1)); }
.bk-tl-content { margin-top: calc(-100vh / var(--ui-scale, 1)); }
```

On the live page the pair nets to zero. Hide the stage in editor mode and the
negative margin survives with nothing to cancel it, dragging the whole first
section a full viewport upward — straight under the navbar. That is what made
About look broken in the editor while the live URL looked fine; the navbar was
never the cause. If you hide a stage, zero its partner's margin in the same rule:

```css
html.is-editing .bk-tl-stage  { display: none !important; }
html.is-editing .bk-tl-content { margin-top: 0 !important; }   /* required */
```

`.bk-people-stage` carries both halves on itself (`height` and `margin-bottom`),
so hiding it alone is safe. Check which shape a new stage has before hiding it.

**4. Anything hidden behind a click must be unhidden in editor mode.** Text
inside a tab, an accordion or a dialog cannot be clicked to edit while it is
`hidden`. Tabs appear on 14 ondc.org pages, so this will come up again. The
ledger's rule shows the shape:

```css
html.is-editing .bk-rfp-panel[hidden] { display: block !important; }
```

All the panels then stack, and the tab buttons stop switching anything while
editing. That is the intended trade: everything on the page is reachable.

Watch for inline styles too. `beckn.js` sets `opacity: 0` *as an inline style*
on every `[data-bk-intro]` before animating it back, and an inline style beats a
stylesheet — so that rule needs `!important`, which is exactly what `beckn.css`
itself does under `prefers-reduced-motion`.

**5. A Bookshop component's inputs — including every nested field — go in its
own `.bookshop.yml`, written out in full.** Three placements were tried on this
component. Only one works:

| Where | Result |
| --- | --- |
| `_inputs` at the top of `cloudcannon.config.yml` | reaches page front matter and data files, **not** a component's fields |
| `_inputs` nested in a `_structures.<name>` entry, reached by `structures: _structures.<name>` | the values arrive, their `_inputs` **do not** |
| `_inputs` in the component's `.bookshop.yml`, structures written inline | **works, including nested arrays** |

The reason is in `@bookshop/generate`: `lib/structure-connector.js` does
`let { structures, ...fields } = structure` and copies everything else verbatim
into `_cloudcannon/info.json`. An inline structure keeps its per-value `_inputs`
all the way through; a string reference arrives as the literal string
`"_structures.rfp_tenders"` with nothing attached.

You can check this yourself without pushing anything:

```bash
npx @11ty/eleventy
npx @bookshop/generate --skip-live --skip-components
# then read _site/_cloudcannon/info.json — whatever is not in there
# is not something CloudCannon can act on
```

(`--skip-live` matters locally: info.json is written *after* the live-editing
bundle, so an esbuild failure means it never gets written at all.)

Symptoms of getting this wrong: auto-titled labels like "Rfp No", a `file`
input rendering as a plain text box with nothing to type into, a `select`
rendering as text, and a same-named input from an unrelated component leaking
in. Watch for name-based type detection too — a field called `last_date` is
turned into a date input whether you asked for one or not, then errors if the
value is not ISO8601.

**6. `hidden` is a key on an input, not an input type.** To hide a field from
editors:

```yaml
heading_id:
  type: text        # a real type is still required
  hidden: true
```

`type: hidden` is **not** valid and CloudCannon shows "This hidden input is
misconfigured" in the sidebar for every field that uses it. A field whose name
starts with an underscore is hidden by default and needs neither.

**7. An empty list is TRUE in Liquid, so never test one with `{% if %}`.**
Only `nil` and `false` are falsy — `[]` is truthy. So this does not do what it
reads like:

```liquid
{% if images %}<div class="bk-life-media"> ... </div>{% endif %}
```

An editor who deletes every photo still gets the wrapper, now empty: a grid
column stays reserved and the text beside it is squeezed into half the page.
Test the length instead:

```liquid
{% if images.size > 0 %} ... {% endif %}
```

This bites whenever an optional block is wrapped around a list — and the
sidebar comment usually promises the opposite ("leave the list empty to drop
the photo column"). It was found while building Contact and fixed in all seven
components that had it: `closing_cta`, `contact_form`, `cta_banner`,
`life_blocks`, `page_hero`, `rich_text` and `role_hero`.

**9. `hidden` loses to any author `display` rule, so guard it.** The `hidden`
attribute is nothing but a UA-stylesheet `display: none`. An author rule
setting `display` on the same element outranks it, and the element stays on
screen with `hidden` set and no visible effect — `el.hidden = true` returns
`true` when you read it back, and DevTools shows the attribute, so this reads
as a JavaScript bug for as long as you look at the JavaScript.

It bit the participant directory in three places at once. `.bk-np-chip`,
`.bk-np-role` and `.bk-np-chk` all carry `display: inline-flex` or `flex`, so
ticking one role filter revealed **every chip in the taxonomy** and left the
four zero-count TSP toggles sitting there reading `0`.

`beckn.css` already guards the two elements ondc.org itself hides:

```css
.bk-np-chips[hidden]    { display: none; }
.bk-np-cat-kids[hidden] { display: none; }
```

It has no guard for the singular chip, toggle or checkbox row because the
original **creates** those with `innerHTML` instead of hiding them — which is
the one thing this build cannot do (see rule 1 and the no-new-nodes rule).
Pre-rendering and hiding is the right architecture here; it just moves the
weight onto `hidden`, so every element a script hides needs checking.

The guards live in `css/ondc/np-directory.css`, **not** in `beckn.css`, and
that placement is deliberate: `beckn.css` is byte-identical with the copy on
ondc.org, so refreshing it from upstream would silently delete anything added
to it and bring the bug back.

Before shipping a section that hides pre-rendered nodes, check every class it
hides:

```bash
# does this element carry its own display?
awk '/^\.bk-np-chip \{/{f=1} f{print; if(/^}/)exit}' css/ondc/beckn.css
```

**8. Check which property the CSS actually animates before writing the JS.**
`category-chrome.css` paints the scroll-progress bar as a full-width span held
at `transform: scaleX(0)`, with a comment saying it scales rather than
animating `width` deliberately, to stay off the layout path. `scroll-progress.js`
set `style.width`. Both looked right in isolation; together the bar sat at
`scaleX(0)` and **never appeared on any page**. Measured, not guessed: painted
width was 0px on About, Careers, RFPs and Contact alike.

`legal.css` muddies it further by redefining the same span as width-driven, so
the correct fix sets both and lets whichever rule won do the painting:

```js
bar.style.width = '100%';
bar.style.transform = 'scaleX(' + p + ')';
```

The general lesson: when a script drives an animation the stylesheet owns, read
the rule first. A second stylesheet later in the cascade can redefine the
mechanism without touching the selector you were looking at.

---

### The holding page, and a wave made of markup

`payment-assurance-program.html` is a page that is not live yet: an eyebrow, a
headline, a status line, one paragraph. No sector rail, no buttons. It is a
third layout on `page_hero` — the content model is the hero's own — and the
only thing in it worth explaining is the headline.

**The blue wave through "Coming soon" is CSS running off `:nth-child`.**
`beckn.css` writes out ten delays, one per letterform, deliberately rather than
computing them, so the markup carries no inline style and no script. That puts
a requirement on the template: the headline must arrive as **one `<span>` per
letter**, and the gap between the words must stay a **text node**. A span
there would shift every delay by one and the stagger would come apart — which
is why there is a test asserting the space is not a span.

```liquid
{%- assign soon_words = heading | split: " " -%}
{%- for soon_word in soon_words -%}
  {%- unless forloop.first %} {% endunless -%}
  {%- assign soon_letters = soon_word | split: "" -%}
  {%- for soon_letter in soon_letters -%}<span aria-hidden="true">{{ soon_letter }}</span>{%- endfor -%}
{%- endfor -%}
```

Splitting a string on `""` gives its characters in LiquidJS, so an editor types
"Coming soon" into an ordinary text field and the wave follows. Every span is
`aria-hidden` and the whole word sits on the heading's `aria-label`, so a
screen reader reads the phrase rather than ten letters. The wave stands itself
down under `prefers-reduced-motion`, in `beckn.css`, not here.

`coming-soon.html` is the same family and still 404: status line **above** the
heading rather than under it, no letter wave, plus a `bk-hold-return` row and a
closing coda. A fourth layout, not a new component.

### The role pages, and a counter that cannot go stale

`buyer-network-participants.html`, `seller-network-participants.html`,
`gateway.html` and `technology-service-provider.html` are **all four** role
pages the footer links to. None needed a new component:
`role_hero` and `closing_cta`'s "role" variant were already built for them, and
the only missing piece — the list in the middle — is a third layout on
`numbered_lists` rather than a 36th component, because it is the same content
model the other two use (a lead beside a list of points) with two optional
fields per point: a heading, and a code. The other layouts ignore both.

The two pages differ only in how that list is drawn, which is a field:

| | buyer | seller |
|---|---|---|
| **How the points are shown** | numbered cards | node types |
| markup | `.bk-requirements` / `.bk-requirement` | `.bk-node-ledger` / `.bk-node` |
| the marker | `01`…`07`, counted | `MSN`, `ISN`, typed |
| link under the intro | yes | none |
| counter | `Buyer NP` → 213 | `Seller NP` → 173 |

The marker is the tell. A requirement's number is its *position*, so it is
counted and renumbers itself; a node's code is its *name*, so it is typed on
the point. The legal pages make the same distinction between a clause number
and a numbered point's marker, and for the same reason.

Gateway is the page that shows how far that one model stretches. It has no
number to count, three more section shapes, and it still needed nothing new:

| what it shows | where it lives |
|---|---|
| `DISCOVER` / `ENABLE` beside the heading | `role_hero`, a **wordmark** instead of the counter |
| the mid-page context band | `tagline_strip`, "Network page" layout |
| SEARCH → MULTICAST → DISCOVER | `numbered_lists`, **Relay** layout |
| the TSP service continuum | `numbered_lists`, **Service lanes** layout |
| the three outcome rows | `numbered_lists`, **Outcome rows** layout |

TSP is Gateway's shape with one band swapped: `.bk-service-plane` instead of
`.bk-relay`. Identical structure — a head block of h2 + paragraph, then a list
of marked items — with two differences that are exactly the ones this codebase
keeps meeting. The marker is a **counted number in a `<span>`** rather than a
**typed code in a `<strong>`**, and there is no `data-bk-relay`, because only
the Gateway's line draws itself on scroll. The two are written out as separate
branches rather than folded together behind a pile of `assign`s: the markup is
what a reader opens this file for.

`numbered_lists` now carries six layouts, and that is the point rather than a
smell: every one of them is a heading and an intro above a list of points, and
what changes is the wrapper and whether a point draws a counted number, a typed
code, or neither. A field a layout ignores is normal here.

Across the four pages the marker rule has held every time, and it is worth
stating plainly: **a marker that is a position is counted; a marker that is a
name is typed.** `01…07` on buyer requirements and `01…03` on TSP lanes
renumber themselves when a point is dragged. `MSN`, `ISN`, `SEARCH`,
`MULTICAST`, `DISCOVER` do not, because they are not positions. The legal
pages draw the same line between a clause number and a numbered point's
marker.

> **`data-bk-relay` is not decoration.** beckn.js writes
> `--bk-relay-progress` onto that element as the page scrolls, which is what
> draws the line through the three steps. Rename the attribute and the relay
> goes static with nothing in the console.

**The counter shows no number, and that was a decision, not an oversight.**
ondc.org asks the registry for it in the browser and ships `—` with a "Loading
registry" note; the request never completes, so its pages show the dash. This
build *can* fill it: we already hold that registry as
`src/_data/network_participants.json`, and "What the number counts" in the CMS
counts distinct names from it — 213 buyer-side organisations across 345 rows,
since one organisation can hold several roles and appear in both lists.

Both pages shipped that way and were then **turned off, deliberately: the site
is not to carry figures the original does not.** The field stays, off by
default, so the choice is a dropdown rather than a code change. The cost of
leaving it is that the counting branch is no longer exercised by any page, and
so is no longer covered by a test — read it again before trusting it if it is
ever wanted back.

One divergence, consistently applied: upstream puts the reveal class on the
closing section itself on Gateway and TSP (`section.bk-role-close.bk-rv`) but
on an inner `<div>` on Buyer and Seller. `closing_cta` uses the inner div on
all four — upstream's own pages disagree two against two, the two shapes
render the same, and one shape across our four role pages is worth more than
reproducing the split.

> **A shared component is a shared blast radius.** Adding `data-bk-intro` to
> the tally — which the buyer page has — silently changed the RFPs/RFQs page,
> which upstream does *not* animate: its number arrives from the ledger after
> the page has settled, and a second animation on top of that reads as a
> glitch. It is a field now, off by default. Whenever a component that other
> pages already use gains something, build every page before and after and diff
> the output; this one was caught that way and the other 29 pages are
> byte-identical.

One difference worth knowing: our sector rail is **one shared list** in
`site.json`, while upstream writes the pills out per page — its buyer page
shows 13, its directory page 12, and they are not the same 13. Ours shows the
same 12 everywhere, missing "About ONDC" against the buyer page.

### Every button's address is in the CMS, including the sign-up ones

A button is a label, an address, a style and a new-tab tick. That is the whole
model, and there is no second kind.

There used to be one: a **What this button does** select, where choosing "Open
the ONDC sign-up portal" made the component render a `<button
onclick="ONDCSignup.open()">` instead of a link, with the real address sitting
in `js/ondc/signup.js`. It was tidy — the portal URL was written once, so a
change to it was a one-line edit — but it failed the test that matters here:
**an editor looking at that button in CloudCannon saw an empty Link address
field and no way to find out where it went.** Worse, typing an address into
that field did nothing at all, silently.

So the select is gone, `signup.js` is deleted, and all 33 of those buttons now
carry `https://portal.ondc.org/` in the field, with **Open in a new tab**
ticked. If the portal moves, an editor changes 33 fields instead of a developer
changing one line — that is the trade, and it was made deliberately in favour
of the person without a code editor.

The rule this leaves behind: **if a component renders something an editor can
click, the destination belongs in a field, not in a script.** The only
`<button>` elements left in a page body are real controls — a lightbox close,
pagination, Clear search, Submit, Export CSV. Those have no destination to
show, so they have no field.

One thing stayed as it was: the **Sign Up** button in the navbar is still a
`<button onclick>`, but its address is `site.cta_url`, edited under *Header &
Footer*. It is already on screen and already changeable, so it did not have the
problem. Making it an anchor as well would need a CSS rule — `.nav-cta` sets a
height with no `display`, which an inline `<a>` ignores — and that file is a
byte-copy of ondc.org's.

## The legal documents

`privacy-policy.html`, `cookie-policy.html` and `terms-and-conditions.html`
are **all three** of the legal pages the footer has always linked to and none
of which existed. One component renders them all.

One component covers both pages because the differences between them are
fields, not code:

| | privacy | cookie | terms |
|---|---|---|---|
| **Show the index down the left** | on — 12 clauses, sticky rail | off | off |
| body | two columns | solo | solo |
| **Width of the text column** | — | `.58fr` | — (`.62fr` default) |
| parts used | text, sub-heading, boxed aside | text, numbered points | text, statutory blocks, ledger |
| clause numbers | 01–12 | 01–07 | preamble unnumbered, then 01–11 |

That is the "a variant, not a new component" rule paying off again: the cookie
policy needed one new part type and one width field, not a second template.

Three decisions worth keeping:

**The clause number is not stored.** It is a running count, zero-padded. Delete
clause 3 and 4..12 renumber themselves — the one thing a hand-numbered legal
document always gets wrong. The same goes for the index down the side and for
the ledger Terms of Use prints inside its own preamble: both are generated from
the clause list, so a clause cannot exist without a link to it and a link
cannot point at a clause that has been deleted.

It counts **numbered clauses**, not loop positions. Terms of Use opens with an
unnumbered preamble and then runs 01–11, so a clause that opts out of a number
must not consume one either — otherwise its ledger of the other eleven would
point one clause out of step with their own headings.

**`index_label` is a separate field from the heading**, because the rail is
narrow and upstream shortens "Collection of Personal Information and its use"
to "Collection & Use of PII" in it. Left empty it falls back to the heading.

**A clause body is a list of parts, not one rich-text field.** Upstream's
sub-headings carry `class="bk-clause-sub"`, its asides are a
`div.bk-clause-note` and its numbered points a `div.bk-barriers`, and no
rich-text editor will produce any of them — it would emit a bare `<h3>` or
`<ol>`, and the classes would have to be faked with duplicate CSS rules that
drift from `beckn.css`. So a part is Text (rich text: paragraphs and lists),
Sub-heading, Boxed aside or Numbered points, and the component writes the
classes. The common case — a clause that is only paragraphs — is still a single
Text part.

A numbered point's marker is **typed, not counted**: the cookie policy runs
`01, 02, 03, 04` in one list and `a, b, c, d` in the next. That is the opposite
of the clause number, which is counted precisely because it must never disagree
with the position.

Terms of Use adds the statutory blocks — the all-caps disclaimer and indemnity.
`.bk-caps` has to sit on the `<p>` or the `<ul>` **itself**: `.bk-clause p`
sets an explicit font-size, so a wrapper would not win by inheritance, and no
rich-text editor will put a class there. Hence two more part kinds rather than
a tick-box on Text.

> **A non-greedy `<li>(.*?)</li>` cannot read a nested list.** One statutory
> point is a sentence, then a sub-list, then a closing sentence. Split that way
> it stopped at the first `</li>`: the sub-list's opening tag landed inside its
> parent's text, its items were promoted to siblings, and the closing sentence
> was dropped. **The rendered page still looked right** — the HTML parser
> re-nests it — so neither the word count nor the structure diff caught it.
> Only the stored data was wrong, which is what an editor would have opened.
> Top-level `<li>`s are found by counting depth now, and each is kept as HTML
> rather than split into text-plus-children, because no structured shape holds
> "sentence, list, sentence" in fields an editor could be told the meaning of.
> The test that catches it counts `:scope > li`, not `li`.

The content was imported once from the page on ondc.org and is CMS copy from
here on. The rendered text is character-for-character identical to upstream on
both pages; the only structural differences are deliberate, and they are the
same one twice. The related-documents line is a `<div class="bk-note">` where
upstream writes a `<p>`, and a numbered point's text is a
`<div class="bk-barrier-t">` where upstream writes a `<span>`: both hold rich
text, and an editor's `<p>` does not belong inside either tag. Neither class
has a rule that depends on its tag, and `.bk-barrier` is a flex row where a
div and a span are the same flex item. The margin guards are in
`css/ondc/legal-doc.css`, not `beckn.css`, for the usual reason.

> **A non-greedy `.*?</div>` cannot read a nested block.** The importer first
> matched `<div class="bk-barriers">(.*?)</div>`, which stops at the tag
> closing the FIRST row — four points silently became one, and the rest of the
> clause was swallowed as stray text. Nothing errored. Blocks that nest are
> lifted out by counting `<div>` depth before the rest is tokenised.

The scroll spy that lights the clause you are reading is `js/ondc/doc-index.js`
— a file rather than ondc.org's inline script, because **CloudCannon deletes an
inline script the first time an editor saves the page** (see above). It only
toggles a class on a link that is already there.

## Adding the next page

1. **Read the original.** Note its `<section>` classes, stylesheets and scripts.
2. **Match sections to components.** Most pages are the archetypes above. A new
   *visual treatment* of an existing content model is a variant field, not a new
   component — that is what keeps this at 19 rather than 45.
3. **Copy any new CSS/JS** into `css/ondc/` and `js/ondc/`, new images into
   `images/<page>/`.
4. **Create `src/pages/<slug>.liquid`** with `permalink: /<slug>.html` and the
   content as front matter under `sections:`, each item carrying
   `_bookshop_name: <component>`.
5. **Declare its assets** with `override:styles` and `override:scripts`. Do not
   list `category-chrome` — the layout always loads it.
6. **Do not add header, footer or sector rail to `sections`.** Set
   `show_sector_rail: true` if the page needs the pill row.
7. **If a new component was needed**, add its `_inputs` entries to
   `cloudcannon.config.yml` and its editor rules to `cms.css`.
8. **Build and check**: `npx @11ty/eleventy && npx @bookshop/generate --editable-regions`.

### Inline page scripts

The About page carried 20 KB of inline JavaScript, split by responsibility:

- `js/ondc/scroll-progress.js` — generic, ~20 pages, made null-safe
- `js/ondc/awards-lightbox.js` — belongs with `awards`
- `js/ondc/journey-map.js` — belongs with `timeline`

Expect the same for `careers`, `complaint` and `network-participants`, which each
carry 20 KB+ of inline script.

---

## Verified by building

| Check | Result |
| --- | --- |
| Careers page sections, text vs ondc.org | **257 / 257 words identical** |
| Careers markup vs ondc.org | identical but for the Bookshop wrapper, our flat image paths and our flat page URLs |
| RFP page chrome + headings, text vs ondc.org | **97 / 97 words identical** (the tender rows are now CMS content, so they differ by design) |
| About page sections, text vs ondc.org | **1044 / 1044 words identical** |
| Footer text vs ondc.org | **83 / 83 words identical** |
| Sector rail text vs ondc.org | **22 / 22 words identical** |
| RFP stylesheet order vs ondc.org | identical (6 of 6) |
| RFP page links | 38 local, **0 missing assets**, 14 pages not built yet |
| Home and About output, before vs after adding RFP | **byte-identical** |
| Contact `<main>` vs ondc.org | **no content differences** — every label, placeholder, dropdown choice, consent line, address block and map URL matches; the only deltas are the Bookshop wrapper, `data-screen-label`, the `data-contact-*` JS hooks and our root-relative `/privacy-policy.html` |
| Contact page height vs ondc.org at 1440px | **2656px both** |
| Contact form input styling | boxed: `#F5F7FA`, 8px radius, 14px — i.e. `legal.css` is live, as intended |
| Home, About, RFP, Careers output, before vs after adding Contact | **byte-identical (4 of 4)** |
| Complaints text vs ondc.org, rendered in a browser | **identical** — 5 step titles, 5 step descriptions, 8 accordion titles, 10 bullets, 6 FAQ answers, 3 escalation conditions, 2 key facts, all matching exactly |
| Complaints section geometry vs ondc.org at 1440px | hero, spine, escalate panel, directory and FAQ **pixel-identical**; stats differ only because the reference's section renders **empty** without network |
| Complaints Buyer App directory | 143 cards, 140 logos, **0 broken images**, 3 monogram fallbacks |
| Home, About, RFP, Careers, Contact output, before vs after adding Complaints | **byte-identical (5 of 5)** |
| Nested `<main>` elements | none |
| Components loaded by Bookshop | 29, one Bookshop |
| Live editing applied | 3 of 3 pages |

### Editor geometry, measured

The built pages were loaded in a headless Chromium with `is-editing` applied —
the same class CloudCannon's frame triggers — and the real boxes measured:

| Page | Mode | Navbar | First section | Overlap |
| --- | --- | --- | --- | --- |
| `index.html` | editor | static, `0 → 88` | starts at `88` | none |
| `about-us.html` | editor | static, `0 → 88` | starts at `88` | none |
| `rfp.html` | live | sticky, `0 → 88` | starts at `88` | none |
| `rfp.html` | editor | static, `0 → 88` | starts at `88` | none |
| `careers.html` | live | sticky, `0 → 88` | starts at `88` | none |
| `careers.html` | editor | static, `0 → 88` | starts at `88` | none |
| `contact-us.html` | live | sticky, `0 → 88` | starts at `88` | none |
| `contact-us.html` | editor | static, `0 → 88` | starts at `88` | none |
| `complaint.html` | live | sticky, `0 → 88` | starts at `88` | none |
| `complaint.html` | editor | static, `0 → 88` | starts at `88` | none |

Also checked on `rfp.html`: no section left at `opacity: 0`, no
`[data-bk-intro]` still hidden, and **1 of 3 tab panels visible live vs 3 of 3
in the editor** — the rule that makes the hidden tabs editable.

The ledger itself was driven in a real browser, in both modes: tab switching,
search (matching, non-matching and cleared), the open/closed split, the hero
counter, and three forced section re-renders with no drift and no console
errors. A deliberately mistyped date (`20th Aug`) keeps its tender visible under
Open and logs a warning naming it, rather than silently dropping a live
tender.

On `contact-us.html` in editor mode, all 13 editable targets — both headings,
both intro paragraphs, a field label, the consent line, the Submit button, the
three send-option labels and buttons, both support headings and the directions
button — were checked for `display:none`, low opacity, zero size, sitting under
the navbar, and being covered by another element at their own centre point.
**Zero issues.**

The form was then driven in a real browser: filled in and submitted, which
revealed the send panel, opened the Gmail popup, and produced the right
recipient, subject (`ONDC Contact Form Request — General Enquiries`) and body.
Submitting it empty, and with a 3-digit phone against the `^\d{10}$` pattern,
was blocked both times. No console errors in any run.

On `complaint.html` in editor mode, 25 editable targets across all six sections
were checked for `display:none`, low opacity, zero size, sitting under the
navbar, and being covered by another element. **Zero issues.** The editor rules
were confirmed to be doing real work rather than passing by accident: the spine
fill measured `878px` instead of `0`, the first step dot was
`rgb(33, 81, 245)` instead of grey, and **0 of 143** directory cards were left
hidden.

The directory was then driven in a real browser: paging forward and to the last
page (`Showing 121–143 of 143`, 23 cards), switching to 96 per page, searching
`paytm` (1 result, and the count line correctly reads the singular "Buyer App"),
searching for something absent (the no-match panel appears, pagination hides),
and clearing the search. The two accordion groups were confirmed independent —
opening the second detail closes the first without touching the open FAQ answer.
No console errors in any run.

Before the earlier fix, About's first section measured `top: -812` — exactly
`88 − 900`, one viewport — which is how the cancelling pair was found.

### Not verified

The CloudCannon editor itself. Worth checking on a test branch:

- **The timeline in editor mode.** It is the most heavily pinned section on the
  site and `cms.css` flattens it.
- **The footer shows content.** It is now in the built HTML, so it should appear
  immediately — but it will not update until you save and rebuild.
One local-only note: `npx @bookshop/generate --editable-regions` cannot finish
in this sandbox because the `node_modules` in the handover zip carries the macOS
esbuild binary and this machine has no npm access. Component discovery and the
"added live editing to 3 pages" step both succeed; only the final bundling step
stops. On CloudCannon the postbuild runs `npm i` on a Linux builder first, so it
gets the right binary — the same path the About page already builds through.
