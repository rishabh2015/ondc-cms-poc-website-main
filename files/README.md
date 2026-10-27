# files/

Anything dropped in here is copied to the site root as `/files/...`.

The two newsletter PDFs the About page links to (17 MB and 24 MB) are **not**
committed — 41 MB of binaries in Git slows every clone and every CloudCannon
build. The hero buttons and the footer point at the copies ondc.org already
hosts, which is how the Strategy Paper and Consultation Paper are handled too.

To serve them from this repo instead, drop the PDFs in here and change the four
URLs back to `/files/<name>.pdf`:
  - `src/pages/about-us.liquid` — the two hero buttons
  - `src/_data/site.json` — the two links in the "About ONDC" footer column
