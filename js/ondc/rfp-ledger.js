/* RFP / RFQ ledger — the tender table on /rfp.html.
 *
 * The tenders themselves are CMS content: they live in the page's "RFP / RFQ
 * ledger" section and are already in the HTML when this file runs. Nothing is
 * fetched. This script only does the three things the markup cannot:
 *
 *   1. decides which tenders are Open and which are Closed, from today's date
 *   2. filters rows as you type in the search box
 *   3. counts the open tenders into the hero counter
 *
 * Why the deadline check is here and not at build time: a tender has to move
 * to Closed the moment its deadline passes, and nobody is going to rebuild the
 * site at 17:30 to make that happen. The deadlines are baked into the page; the
 * comparison is live.
 *
 * Every feed panel is rendered with ALL tenders in it and this script hides the
 * ones that do not belong in that panel. It never moves or creates row
 * elements — that matters, because inside the CloudCannon editor Bookshop
 * re-renders the section whenever a field changes, and a script that reshuffled
 * the DOM would fight that re-render in a loop. Hiding is idempotent: running
 * it twice does the same thing as running it once.
 */
(function () {
  'use strict';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  /* The deadline is written by the editor as plain text:
   *     dd.mm.yyyy              -> the end of that day
   *     dd.mm.yyyy HH:MM        -> that minute
   *     dd.mm.yyyy HH:MM:SS     -> that second
   *
   * It is INDIA STANDARD TIME, always, for every reader — a tender closes at a
   * moment in India, not at each reader's local midnight. So the parts are
   * turned into an instant with Date.UTC and IST's fixed +5:30 subtracted,
   * rather than `new Date(y, m, d, ...)`, which would silently mean something
   * different in every timezone. India has no daylight saving, so the offset
   * is a constant and this needs no timezone database. */
  var IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  function dueTime(row) {
    var raw = (row.getAttribute('data-rfp-due') || '').trim();
    if (!raw) return NaN;
    var m = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!m) return NaN;
    var d = +m[1], mo = +m[2], y = +m[3];
    if (!d || !mo || !y || mo > 12 || d > 31) return NaN;
    var hasTime = m[4] !== undefined;
    // No time given means the deadline is the end of that day.
    var hh = hasTime ? +m[4] : 23;
    var mi = hasTime ? +m[5] : 59;
    var ss = hasTime ? (m[6] !== undefined ? +m[6] : 0) : 59;
    if (hh > 23 || mi > 59 || ss > 59) return NaN;
    return Date.UTC(y, mo - 1, d, hh, mi, ss, hasTime ? 0 : 999) - IST_OFFSET_MS;
  }

  /* A row whose deadline cannot be read falls back to the tab the editor chose,
   * so a bad value never makes a live tender disappear. The warning names it. */
  function warnBadDate(row) {
    if (row._rfpWarned) return;
    var raw = (row.getAttribute('data-rfp-due') || '').trim();
    // No deadline at all is a normal state — an empanelled agency never has
    // one, and a tender may not have been given one yet. Only a value that is
    // present but unreadable is worth saying anything about.
    if (!raw) return;
    row._rfpWarned = true;
    var name = (row.querySelector('.bk-rfp-name') || {}).textContent || '(unnamed)';
    console.warn('RFP ledger: could not read the deadline ' +
      (raw ? '"' + raw + '" ' : '') + 'on "' + name +
      '". Expected dd.mm.yyyy, optionally followed by HH:MM. ' +
      'Leaving it in the tab it was given.');
  }

  /* The hero counter counts up, matching the easing beckn.js uses for every
   * other [data-bk-count] on the site. */
  function countUpTo(el, target) {
    if (!el) return;
    if (el._rfpShown === target) return;      // nothing changed, don't re-animate
    el._rfpShown = target;
    if (!target) { el.textContent = '0'; return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = String(target);
      return;
    }
    var t0 = performance.now(), dur = 1200;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function emptyState(box) {
    var d = document.createElement('div');
    d.className = 'bk-directory-state';
    d.setAttribute('data-rfp-empty', '');
    d.innerHTML = '<div class="bk-directory-state-inner"><h3>' +
      esc(box.getAttribute('data-rfp-empty-heading') || 'No records found') +
      '</h3><p>' +
      esc(box.getAttribute('data-rfp-empty-body') || 'Nothing matches this filter right now.') +
      '</p></div>';
    return d;
  }

  /* Which tab does this row belong under?
   *
   * An empanelled agency is whatever the editor said and is never moved. For a
   * tender, the closing date normally wins — that is the whole point of
   * "Move tenders between Open and Closed automatically". The editor's own
   * choice is the fallback: when the switch is off, or when the date is
   * missing or unreadable. */
  function placeOf(row, now, auto) {
    var chosen = row.getAttribute('data-rfp-tab') || 'open';
    if (chosen === 'empanelled') return 'empanelled';
    if (auto) {
      var t = dueTime(row);
      if (!isNaN(t)) return t < now ? 'closed' : 'open';
      warnBadDate(row);
    }
    return chosen === 'closed' ? 'closed' : 'open';
  }

  /* Decide what is visible. Called on load, on every keystroke in the search
   * box, and again after the editor re-renders the section. */
  function apply(section) {
    var now = Date.now();
    var auto = section.getAttribute('data-rfp-auto') !== 'off';
    var input = section.querySelector('.bk-rfp-search');
    var q = input ? input.value.trim().toLowerCase() : '';
    var openCount = 0;

    section.querySelectorAll('[data-rfp-rows]').forEach(function (box) {
      var role = box.getAttribute('data-rfp-rows') || 'open';
      var shown = 0;

      box.querySelectorAll('.bk-rfp-row').forEach(function (row) {
        var place = placeOf(row, now, auto);
        // Closed tenders are greyed down; the class is the one beckn.css styles.
        row.classList.toggle('bk-rfp-row-closed', place === 'closed');
        var matches = !q || row.textContent.toLowerCase().indexOf(q) !== -1;
        row.hidden = !(place === role && matches);
        if (!row.hidden) shown++;
      });

      // Count the open tenders from the open panel, ignoring the search so the
      // headline figure is the real total rather than whatever is filtered.
      if (role === 'open') {
        openCount = 0;
        box.querySelectorAll('.bk-rfp-row').forEach(function (row) {
          if (placeOf(row, now, auto) === 'open') openCount++;
        });
      }

      var placeholder = box.querySelector('[data-rfp-empty]');
      if (shown === 0 && !placeholder) box.appendChild(emptyState(box));
      if (shown > 0 && placeholder) placeholder.remove();
    });

    var tallyId = section.getAttribute('data-rfp-tally');
    countUpTo(tallyId ? document.getElementById(tallyId) : null, openCount);
  }

  function init(section) {
    if (!section._rfpReady) {
      section._rfpReady = true;

      // Tabs. Each button owns one panel; only the chosen panel is shown.
      var tabs = [].slice.call(section.querySelectorAll('.bk-tab'));
      tabs.forEach(function (tab) {
        tab.addEventListener('click', function () {
          tabs.forEach(function (t) {
            var on = t === tab;
            t.setAttribute('aria-selected', String(on));
            var panel = document.getElementById(t.getAttribute('aria-controls'));
            if (panel) panel.hidden = !on;
          });
        });
      });

      var input = section.querySelector('.bk-rfp-search');
      if (input) input.addEventListener('input', function () { apply(section); });
    }
    apply(section);
  }

  /* apply() can add or remove the "nothing here" block, which is a DOM change
   * the observer below would see. apply() is idempotent so it would settle
   * after one extra pass anyway, but muting the observer while it runs keeps
   * that off the table entirely. */
  var busy = false;
  function scan() {
    if (busy) return;
    busy = true;
    try { document.querySelectorAll('.bk-rfp-ledger').forEach(init); }
    finally { busy = false; }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  /* The visual editor replaces the section's DOM when a field changes. Pick the
   * fresh copy up, debounced, so editing stays responsive. Safe to run as often
   * as it likes: init() only binds handlers once per section element and
   * apply() only ever sets .hidden. */
  if (window.MutationObserver) {
    var pending = null;
    new MutationObserver(function () {
      clearTimeout(pending);
      pending = setTimeout(scan, 50);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
