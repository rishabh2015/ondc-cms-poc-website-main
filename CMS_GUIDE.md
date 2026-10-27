# ONDC site — CloudCannon guide

The site is now built from **sections**. A page is a list of sections; editors add,
duplicate, reorder and delete them without a developer. The look, the theme and the
animations are unchanged.

---

## 1. One-time setup in CloudCannon (do this first)

The site used to be plain HTML with no build. It now builds with Eleventy, so the
build settings have to change once. In CloudCannon: **Site Settings → Build**

| Setting         | Value                |
| --------------- | -------------------- |
| Site generator  | Eleventy             |
| Install command | `npm install`        |
| Build command   | `npx @11ty/eleventy --config=eleventy.config.js` |
| Output path     | `_site`              |

> The repo deliberately contains **no hidden (dot) files**. macOS Finder hides
> those, and copying a folder without them is what makes the build fail with a
> `TemplateLayoutPathResolver` error.

Then push this repo and let the build run. Until the build settings are changed the
site will not publish.

Pages are served flat: `/about-us.html`, `/rfp.html`. The home page is the one
exception — it is `src/pages/index.liquid` and is served at `/`. Each new page
keeps that shape.

The postbuild hook `.cloudcannon/postbuild` must stay **executable in Git** — it is
what turns on click-to-edit. If click-to-edit stops working after a change, check
that first: `git update-index --chmod=+x .cloudcannon/postbuild`.

---

## 2. What editors can do

### Text, numbers, headings, buttons
Open **Pages → Home**. The page preview is on the right; the form is on the left.
Open a section in **Page sections** and every number, heading, description, button
label and piece of small print in it is a field. Save, and the preview refreshes once
the build finishes.

You can also **click text on the page itself** and type. Both routes edit the same
thing: use the form when you want to see every field at once, click the page when
you know exactly which words you want to change. Text edited on the page updates in
the preview as you type.

Two things are edited only from the sidebar, never by clicking the page: the
**navbar** and the **footer**. They appear on every page, so they live under
**Header & Footer** — and because they are baked in when the site builds, a change
to them shows up after you save, not as you type.

### Images and video
Every picture is an image field: **Upload** a new one or pick an existing one, and use
**Crop** in CloudCannon's image editor to change the framing.

The **Image or video** section (and each card in a **Cards** section) also offers:

- a picture,
- a video file you upload (an `.mp4` under about 20 MB),
- a YouTube or Vimeo link — paste the normal address and the player is embedded.

### Sections: add, duplicate, reorder, delete
In the page's sidebar, open **Page sections**:

- **+** adds a section — pick one from the list,
- the **⋮** menu on a section duplicates or deletes it,
- **drag** a section by its handle to move it up or down.

Save, and the change is live after the build.

### Pages: create, duplicate
In **Pages**, click **+**:

- **Blank page** — starts with one text section,
- **Landing page starter** — text, an image, three cards and a call to action.

To copy an existing page, use the **⋮** menu on it in the Pages list and choose
Duplicate. Set **Page address** (for example `/contact.html`) and keep it unique.

Developers: never point a schema at a file inside `src/pages`. CloudCannon treats a
file used as a schema as a template and hides it from the Pages list.

### Site-wide bits
**Site settings** holds the logo, the top menu (including the drop-down) and the shared
footer. Changing it changes every page.

### The navbar and footer
These are **not** page sections — they are the same on every page, so they are edited
once under **Header & Footer** in the sidebar.

- **Menu** — the top navigation, including the drop-down. The current page's item is
  highlighted automatically. A link written as `#find-your-place` points at a spot on
  the home page and works from every page; you do not need to write the page part.
- **Footer** — the logo, blurb, link columns, social links, copyright line and the wide
  background illustration (a long, low picture works best, about 2400 x 900).

Because they are built into every page, these two update after you **save**, not as
you type. That is the trade for them never rendering blank.

A single page can override the footer if it ever needs its own — ask a developer to
set `page_footer` on it.

### Previewing
The visual editor shows the page as it will look, next to the form. Use the device
buttons for desktop and mobile. Nothing is public until the build finishes and the site
is published.

---

## 3. The section library

| Section | What it is |
| --- | --- |
| Rich text | Heading + body text. The everyday section. |
| Image or video | One picture, an uploaded video, or a YouTube / Vimeo embed. |
| Cards | A row of 2–4 cards, each with a picture or video, a title and text. |
| Call to action | Wide banner with a heading and buttons. |
| Hero — scrolling story | The animated opening story. One per page, at the top. |
| Tagline strip | One large statement with a line underneath. |
| Sector carousel | The full-screen sector slides with "By the numbers". One per page. |
| Key numbers | The row of big numbers that count up. |
| Building blocks deck | The dark deck of cards that slide across on scroll. |
| Doors — find your place | Swipeable row of large cards with a list and a button. |
| Story posters | Quote posters linked to LinkedIn posts. |
| News rail | Swipeable press cards, numbered automatically. |
| Page hero | Full-bleed opening banner with a background photo. |
| Role page hero | Opening band with a big heading and an optional live counter. |
| Closing call to action | A closing heading and buttons. Two layouts — see below. |
| Numbered points | A summary beside groups of auto-numbered points. |
| Institutions | Named organisations plus a logo strip with a counter. |
| People | Photo, name, role and organisation. |
| Awards | A featured award plus awards grouped by year. |
| Timeline | A year-by-year story with the animated India map. |
| RFP / RFQ ledger | Tabs and a search box over the live tender table. |
| Page title band | A plain heading at the top of a page, with one line under it. |
| Contact form | The message form, office details and map, side by side. |
| Numbered journey (spine) | Numbered steps down a line that fills as you scroll, with optional expandable detail. One per page. |
| Escalation panel | A dark call-out: conditions, buttons, and key facts down the side. |
| Buyer App directory | The searchable, paged list of Buyer Apps and their contacts. |
| Participant directory | The filterable, paged participant ledger — category tree, role toggles, search and CSV export. |
| Knowledge base index | The grid of cards on the Resources hub, one per area of the library. |
| Resources search | The search box that searches every document in the knowledge base at once. |
| Knowledge base area | The body of a Resources sub-page — sidebar, breadcrumbs and that area's documents. |
| Newsletter rows | A heading and a stack of wide rows, each linking to a newsletter to download. |
| FAQ | Questions that open one at a time. |
| Key numbers | Big figures that count up, in labelled rows, with an optional legend. |

**Closing call to action** has a **Layout** choice: *Plain* is the wide band used at
the foot of the About page, *Panel* is the white rounded card used at the foot of the
role pages — the Panel layout can also carry a paragraph.

**Use once per page:** Hero — scrolling story, Sector carousel, Building blocks deck,
Timeline. They each take over the scroll, so a second copy on the same page will fight
the first. The other sections can be used as many times as you like.

---

## 3a. Publishing a new RFP, RFQ or empanelled agency

Everything happens in CloudCannon — there is no spreadsheet and no S3 step.

1. Open **Pages → RFPs/RFQs**.
2. In **Page sections**, open the **RFP / RFQ ledger** section.
3. Scroll to **RFPs, RFQs and empanelled agencies** and click **+**. Pick one:

   | Choose | For |
   | --- | --- |
   | **Open RFP / RFQ** | A tender you are inviting proposals for |
   | **Closed RFP / RFQ** | A past tender, for the record |
   | **Empanelled agency** | An agency on the empanelled list |

4. Fill in the fields:

   | Field | What to put |
   | --- | --- |
   | Which tab it appears under | Already set by what you picked |
   | RFP / RFQ number | The reference, e.g. `ONDC/RFP/2026/001` |
   | Name | The title applicants will read |
   | Deadline — last date and time to apply | Pick the day on the left, then set the time on the right. Leave empty for an agency. |

   To set the **time**: click on the hour, type it, and keep typing through the
   minutes and AM/PM — or use the up and down arrow keys. The box shows the
   time in India Standard Time.

5. Add the documents — see below.
6. **Save.** It is live once the build finishes, about a minute.

### Attaching a document

Under **Documents**, click **+**. Each document has two fields:

| Field | What to do |
| --- | --- |
| **What this document is** | The wording that will appear as the download link — *RFP document*, *Corrigendum 1*, *Annexure A* |
| **Link to the document** | The full web address of the file, for example an existing link on ONDC's S3 bucket |

**Documents are linked, not uploaded.** Put the PDF wherever ONDC already
hosts its files, copy the address, and paste it here. There is no upload
field — nothing is ever stored on the website itself, so there is no size
limit to worry about and deleting a tender can never leave a stray file behind.

Once a link is in, the collapsed row shows what the document is and where it
points, so you can check a list of them at a glance without opening each one.

A document with an empty link is skipped when the page is built, so a
half-finished row will not show a broken link to visitors.

### Deadlines have a time, not just a date

The deadline is a date **and** a time of day, and the tender closes at exactly
that moment — 17:30 means half past five that afternoon, not midnight.

Times are **India Standard Time** for everyone. Someone reading the page in
London or New York sees the same `30.11.2026, 17:30 IST`, not a time converted
into their own zone. That is deliberate: a tender deadline is a single moment,
and quoting it in each reader's local time invites mistakes.

Seconds appear only when you set them, so an ordinary deadline reads
`30.11.2026, 17:30` and a last-moment one reads `15.12.2026, 23:59:59`.

### Open and Closed look after themselves

You never move a tender between tabs. It sits under **Open** until its deadline
passes and appears under **Closed** straight after, and the big number in the
hero counts whatever is open. That happens in the reader's browser, so it stays
right even if nobody touches the site for months.

That is the **Move tenders between Open and Closed automatically** tick box, and
it should stay ticked. Untick it only if you want to decide every tender's tab
by hand — then whatever you picked in step 3 is final.

Empanelled agencies are never moved either way. An entry with no usable
deadline stays in the tab you chose rather than disappearing.

### When a tab is empty

Each tab has its own **Heading when this tab is empty** and **Message when this
tab is empty**. That is where "No empanelled agencies yet" comes from — put a
real agency in that tab and the message is replaced by the list.

### The four example entries

The page ships with four made-up entries so every tab has something in it.
**Delete all four** before the page goes live, and delete the two sample PDFs in
`files/rfp/` with them.

### While you are editing

All three tabs are shown stacked so you can click into any of them. On the live
page only the selected tab shows.

---

## 3b. Editing the Contact page

The Contact page is two sections: a **Page title band** and a **Contact form**.

### Where the messages go

There is no database behind the form. When a visitor presses **Submit**, their
own email program opens with the message already written and addressed — they
still have to press send. Nothing is stored on the website.

The address is the **Send messages to** field on the Contact form section.
Change it and every message from then on goes to the new inbox.

### Changing the questions

The form is built from **Form rows**. Each row holds one or two fields — two
sit side by side, one fills the width. Drag rows to reorder the form.

Open a field and you can change:

| Field | What it does |
| --- | --- |
| **Label** | The small heading above the box. Also the heading this answer gets in the email. |
| **Kind of field** | Short text, Email, Phone, Dropdown or Long message. Email and Phone bring up the right keyboard on a mobile and check the format. |
| **Grey hint inside the box** | The faint text shown before anything is typed. For a dropdown, the first unselected line. |
| **Visitor must fill this in** | On by default. |
| **Dropdown choices** | Only used by a Dropdown. Click **+** to add a choice. |

Adding a question is enough on its own — the answer automatically appears in
the email, in the same position it has on the page. Nothing else needs changing.

Two fields are more technical and are best left alone unless you know you need
them: **Autofill hint** lets the browser fill the box from the visitor's saved
details, and **Format check** is a pattern the answer must match (the phone box
uses one to require exactly ten digits).

**Field name** is the one to be careful with. It is the internal name, never
shown to visitors, and it must be lower-case letters, numbers and underscores.
If you rename the one named in **Which field finishes the subject line**,
change that setting to match.

### The subject line

Subjects read *ONDC Contact Form Request — General Enquiries*. The first part
is **Subject line starts with**; the rest is whatever the visitor picked in the
dropdown, or **Subject if that field is left empty** when they picked nothing.

### After Submit

Gmail opens in a new tab, and a small panel appears under the button with other
ways to send for people who do not use Gmail. **While you are editing, that
panel is always shown** so you can click into its wording — on the live page it
stays hidden until someone presses Submit. Pressing Submit in the editor will
not open a Gmail tab.

### The address panel and map

**Office details** are the stacked blocks on the right. Click **+** for another
one. Inside an address, use **Shift+Enter** for a line break so it stays one
block.

To change the **Map**: open the place in Google Maps, choose **Share**, then
**Embed a map**, then **Copy HTML**, and paste only the part between `src="`
and the next quote. **Directions link** is the ordinary Google Maps link for
the same place, not the embed address.

Clear the office details, the map and the directions link and the whole
right-hand column disappears, letting the form run the full width of the page.

---

## 3c. Editing the Complaints page

Six sections: the hero, **How to get help**, **Escalate to ONDC**, the **Buyer
App directory**, the **FAQ** and **Status of complaints**.

### The numbered steps

Open **Numbered journey (spine)**. Each entry under **Steps** is a title and a
short description; the numbers and the left/right alternation are automatic, so
adding, deleting or dragging a step renumbers everything.

One setting to leave alone: **Link anchor** must stay `bk-mech`. It is the id
the animation script looks for — change it and the line stops filling and the
dots stop lighting up. For the same reason there can only be **one** of these
sections on a page.

Under **Expandable detail below the steps** are the longer answers. Each has a
title and a list of bullet points. Only one is open at a time and the first one
starts open, so the order matters.

### Escalate to ONDC

**Conditions** are the bulleted situations. **Key facts on the right** are the
bold figures ("48 hours") with a line explaining each. **Document link** is the
PDF at the bottom of that panel — leave it empty to hide the link.

### The Buyer App directory

The wording is editable here: the heading, the line under it, the search box
hint, the button labels, and the message shown when a search finds nothing.

**The 143 apps themselves are not edited in this section.** They are a copy of
the published ONDC Buyer App directory and live in a separate data file,
`buyer_apps.json`, which you will find under the site's data in CloudCannon.
Each entry has a name, the organisation, a logo and its contact rows. If an
app's logo is missing or fails to load, the card falls back to the app's
initials rather than showing a broken image.

**Cards per page to start with** must be one of the **Per-page choices** —
if you add a new choice, that is the only place it needs adding.

### Status of complaints

These are the complaint figures, and they are **typed in here**, not pulled from
the complaints team's spreadsheet. Updating them is:

1. open **Key numbers**;
2. change the figures in each row;
3. update **Small note beside the heading** to the new "Last updated on…" date.

Each figure counts up from zero when it scrolls into view. Type digits only —
no commas. If you ever need to show something that is not a plain whole number,
turn **Count up when it scrolls into view** off for that tile and it will be
shown exactly as typed.

**Rows of numbers** are the two bands — one per year, one for where this year's
complaints stand. Turn **Size tiles to their content** on for a row of years so
they sit together, off for a row that should share the width equally. The
**Legend** underneath explains what each status means.

### While you are editing

The steps appear fully lit rather than filling in as you scroll, every
expandable section and FAQ answer is open so you can click into the text, and
all 143 directory cards are shown with their contacts visible. On the live page
only the first answer in each group is open, and the directory shows one page at
a time.

---

## 3d. Editing the Network Participants page

Three sections: the hero, the **Participant directory**, and the closing
**Participant Portal** panel. The hero and the closing panel are ordinary
sections — heading, paragraph, buttons.

### What is edited on the section, and what is not

Open **Participant directory** and you can change everything *around* the
table: the tabs across the top, the names and descriptions of the two lists,
the search hint, how many rows a page starts with, whether the **Export CSV**
button shows, and the disclaimer underneath. Column headings and the small
wording inside the table ("Email", "Call", "Website", "Enabled by", the
"nothing matches" message) are grouped under **Wording inside the directory**
— open that only when you need to reword something specific.

**The participants themselves are not edited here.** They are in their own
place in the sidebar.

### Adding, changing and deleting a participant

In the CloudCannon sidebar, open **Network Participants**. You will find two
lists — **Key Network Participants** and **Integrated Network Participants** —
matching the two tabs on the page.

- **Add one** with the **+** button. Fill in the name, upload or pick a logo,
  tick its roles and its live categories, and fill in the contact details.
- **Change one** by clicking it open.
- **Delete one** with the item menu (**⋮**) → Delete. It is gone from the
  website on the next publish. The same goes for duplicating: **⋮** →
  Duplicate gives you a copy to edit.

Two things you do not have to think about:

- **Order.** The page sorts by name every time it builds, so it does not matter
  where in the list a new entry ends up — it will appear in its alphabetical
  place on the site.
- **A missing logo.** Leave the logo empty and the row shows a grey circle with
  the participant's initials rather than a broken image. The same happens if a
  logo file goes missing later. You can set the two letters yourself in
  **Initials**, or leave that empty and the first two letters of the name are
  used.

Only **Name** really matters. Every other field can be empty, and the row
simply does not draw that part.

### Adding a new category or role

Open **Participant categories & roles** in the sidebar.

**Categories** is the list behind the filter panel on the left of the directory
*and* behind the category picker on each participant. Add the category here
first, then tag participants with it. **Sits under** decides where it appears
in the panel: leave it empty for a top-level category, or pick a top-level one
to nest it underneath.

A category only shows in the filter panel when the list you are looking at
actually has participants in it — an option nobody can tick is left out rather
than greyed, and the two tabs genuinely carry different sets. The number beside
each one is how many participants are in it.

**Roles** carries the short key the table prints (BNP, SNP) and the full
wording behind it. **Role** must match exactly what is written on the
participants; changing it here does not change it on them.

### Changing the order of a list

Each list has an **Order** setting:

- **Alphabetical by name** — the default for both lists, and what keeps a newly
  added participant in the right place by itself.
- **As listed in the data file** — keeps the order of the entries exactly as
  they sit in **Network Participants**.

The Key list is a volume ranking on ondc.org. It is set to alphabetical here;
switch it to **As listed in the data file** to restore the ranking, and reword
the list's **Line under the switcher** to match.

### The tabs across the top

**Tabs above the directory** is the row of links for moving between this
directory and the other participant directories. Tick **This is the current
page** on exactly one — that is the one drawn as selected.

### While you are editing

The list switcher is shown open, so both list names can be clicked and
reworded. The table itself pages the same way it does on the live site, twenty
rows at a time — the rows are not editable here anyway, and everything on the
section that *is* editable is visible without paging.

---

## 3e. Editing the Ecosystem Participants page

The same three sections as Network Participants — hero, **Participant
directory**, closing **Participant Portal** panel — and the directory is the
same section type, so §3d applies to it word for word. Two differences:

- **One list, so no switcher.** The directory shows a single list and the
  "Participant list" dropdown is not drawn. Add a second list under **Lists in
  this directory** and the switcher appears by itself.
- **The sub-line under a participant's name says "Live NPs supported"** rather
  than "Enabled by". That is **Wording inside the directory → Label before the
  technology service provider**. Nothing on the page uses it today — the sheet
  carries no values — but fill the field on a participant and the line appears.

### Adding, changing and deleting an ecosystem participant

Sidebar → **Ecosystem Participants** (hub icon). It works exactly like
**Network Participants**: **+** to add, **⋮ → Delete** to remove, **⋮ →
Duplicate** to copy, click a row to edit. Deleting removes it from the site on
the next publish, and the page sorts by name, so a new entry lands in its
alphabetical place by itself.

It is a **separate file** from Network Participants on purpose — editing one
directory never touches the other, so two people can work on them at the same
time without colliding.

### Moving a participant between the two directories

There is no "move" button. Open the entry, copy its fields into a new entry in
the other list, then delete the original. An organisation that genuinely
belongs in both — a TSP that is also a Buyer NP — should be listed in both.

### The tabs at the top

Both pages carry the same two tabs, and each page ticks **This is the current
page** on its own one. If you rename a tab, rename it on *both* pages or the
pair will disagree.

---

## 3f. Editing the Resources section

Resources is **nineteen pages** — the hub at `/resources.html` and eighteen
sub-pages, one per area of the knowledge base. All nineteen are drawn from a
single place in the sidebar: **Resources library**.

### The one rule that explains everything here

Add a document to an area and it appears **in four places at once**: on that
area's page, in the hub's search, in the count on the hub card, and in the
count on any parent area's sub-area card. Delete it and it leaves all four.
You never update a number by hand.

### Adding, changing and deleting a document

Sidebar → **Resources library** → open the file → you get the list of
**Areas**. Each area opens to **Groups of documents**, and each group opens to
its **Documents**.

- **Add** with **+** at whichever level you need — a document, a whole group,
  or a new area.
- **Delete** with the item menu (**⋮**) → Delete.
- **Reorder** by dragging. Order matters here and is exactly what the page
  shows: the order of areas is the order of the hub cards and the sidebar, and
  the order of groups is the order they appear down the page.

A document has a **Title**, a **Kind of document** (PDF, Video, Link, Page on
this site…) which picks its icon and tag, a **Link address**, and three
optional tags: **Language**, **Date tag** and a short **Note beside the
title**. Leave the link empty for something announced but not published yet —
the row shows without a link, which is how "coming soon" is done.

### Adding a whole new area (a new page)

Two steps, in this order:

1. **In Resources library**, add the area. Give it an **id** (lower-case, no
   spaces — for example `payments`), a title, a short description, an icon,
   and a **Page address** such as `/resources-payments.html`. Tick **Show a
   card on the Resources hub** if it should appear on the hub. To nest it
   under an existing area, put that area's id in **Sits under** — that one
   field drives the sidebar tree, the breadcrumbs and the parent's sub-area
   cards together.
2. **In Pages**, duplicate any existing `resources-…` page and change three
   things: the **Page address** to match what you just typed, the hero wording,
   and — on the **Knowledge base area** section — **Which part of the library**
   to the new id.

Until step 2 is done the hub card points at a page that does not exist.

### What is edited on the page, and what is not

Open a Resources sub-page and you can edit the hero, the intro paragraph, the
closing call to action, and the wording around the documents (the sidebar
heading, the breadcrumb, the filter hint, the "nothing matched" message, under
**Wording around the documents**). **The documents themselves are not edited
there** — they are in Resources library.

On the hub the same split applies: the masthead, the search wording, the index
heading and the newsletter rows are page content; the cards are the areas.

### The newsletters

The only list on these pages that *is* edited on the page. Open **Newsletter
rows** on the hub: each row has a small label, a title, a description, the link
text (put the file size in it — "Download PDF · 17 MB") and the address.

### Two settings not to change by accident

- **Which part of the library** on a sub-page is the area's id. Change it and
  the page shows a different area's documents — or nothing, if no area has
  that id.
- **Menu item to highlight** in Page settings is `/resources.html` on every
  sub-page. That is what keeps "Resources" lit in the top menu while a reader
  is on one of them.

### While you are editing

Everything that normally fades in as you scroll is shown already faded in, and
the sidebar is held open so you can see which area the page is. The search
results box stays empty — it fills only when somebody types, and nothing in it
is editable anyway.

---

## 4. How it fits together (for developers)

```
eleventy.config.js             build config (passthrough for css/js/images/fonts/files)
cloudcannon.config.yml         collections, structures and every field's editor
.cloudcannon/postbuild         runs @bookshop/generate --editable-regions  (must be +x)
schemas/                       the "blank page" / "landing page" starting points
src/_data/site.json            logo, menu, footer — every page uses it
src/pages/*.liquid             one file per page; front matter holds `sections`
src/_includes/base.liquid      the page shell
src/_includes/chrome/          header, sector rail, footer — rendered at build time
component-library/components/  one folder per section type (template + .bookshop.yml)
component-library/shared/      the page helper that loops over `sections`
css/ js/ images/ fonts/        unchanged assets, copied straight through
css/ondc/cms.css               editor-mode overrides. Loads LAST. See ADDING_PAGES.md
files/rfp/                     RFP documents uploaded through the CMS
```

**To add a new KIND of section**, create
`component-library/components/<name>/` with `<name>.eleventy.liquid` and
`<name>.bookshop.yml`, then add any new field names to `_inputs` in
`cloudcannon.config.yml` so they get a proper label. Bookshop finds it
automatically — there is no list of sections to update.

`ADDING_PAGES.md` is the full version of this, including the four rules a
component has to follow to behave in the editor. Read it before writing one.

**Click-to-edit works**, through Bookshop. Components are authored as plain
`{{ field }}` output and `@bookshop/generate --editable-regions` does the rest
in the postbuild step. Two things stay sidebar-only on purpose: the navbar and
footer, which are rendered by the layout so they can never come out blank.

**`js/ondc-home.js`** only animates what the HTML already contains — it never
rewrites the contents of an editable region, and it skips the scroll story on
pages that do not have one.
