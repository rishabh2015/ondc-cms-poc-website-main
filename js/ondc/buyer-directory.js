/* Buyer App directory — search and paging.
   =====================================================================
   Every card is already in the page: Eleventy renders all of them at build
   time from src/_data/buyer_apps.json. This script only ever toggles `hidden`
   on cards that exist, and writes text into elements that exist. It never
   creates, moves or removes a node.

   That is deliberate, and it is the same rule the RFP ledger follows. Inside
   the CloudCannon editor Bookshop replaces the section's DOM on every
   keystroke; a script that rebuilt the list would fight the re-render in a
   loop. Hiding is idempotent — running it twice does what running it once
   does — so a re-render costs nothing but a re-run.

   Markup contract (all data attributes, so ids stay free for anchors):
     [data-ba-directory]      the section, carries the settings
     [data-ba-card]           one card, with [data-ba-search-text] to match on
     [data-ba-search]         the search box
     [data-ba-count]          "Showing 1–24 of 143 Buyer Apps"
     [data-ba-empty]          the no-match block, with [data-ba-query]
     [data-ba-clear]          the button inside it
     [data-ba-perpage]        the per-page <select>
     [data-ba-prev/next]      the paging buttons
     [data-ba-pageinfo]       "Page 1 of 6"

   Safe to load on any page: does nothing when no directory is present.
   ===================================================================== */
(function () {
  'use strict';

  function setup(root) {
    if (root._baReady) return;          // survives a re-render without stacking listeners
    root._baReady = true;

    var cards = Array.prototype.slice.call(root.querySelectorAll('[data-ba-card]'));
    if (!cards.length) return;

    var search = root.querySelector('[data-ba-search]');
    var countEl = root.querySelector('[data-ba-count]');
    var emptyEl = root.querySelector('[data-ba-empty]');
    var queryEl = root.querySelector('[data-ba-query]');
    var clearEl = root.querySelector('[data-ba-clear]');
    var perPageEl = root.querySelector('[data-ba-perpage]');
    var prevEl = root.querySelector('[data-ba-prev]');
    var nextEl = root.querySelector('[data-ba-next]');
    var pageInfo = root.querySelector('[data-ba-pageinfo]');
    var pagination = root.querySelector('[data-ba-pagination]');

    var noun = root.getAttribute('data-ba-noun') || 'item';
    var nounPlural = root.getAttribute('data-ba-noun-plural') || noun + 's';
    var perPage = parseInt(root.getAttribute('data-ba-per-page'), 10) || 24;
    var page = 1;
    var query = '';

    function matches() {
      if (!query) return cards;
      var q = query.toLowerCase();
      return cards.filter(function (c) {
        return (c.getAttribute('data-ba-search-text') || '').indexOf(q) !== -1;
      });
    }

    function apply() {
      var shown = matches();
      var total = shown.length;
      var pages = Math.max(1, Math.ceil(total / perPage));
      if (page > pages) page = pages;
      if (page < 1) page = 1;

      var first = (page - 1) * perPage;
      var last = first + perPage;

      // Hidden first, then reveal this page's slice — one pass over every card.
      var visible = {};
      shown.slice(first, last).forEach(function (c) { visible[c._baId] = true; });
      cards.forEach(function (c) { c.hidden = !visible[c._baId]; });

      if (emptyEl) emptyEl.hidden = total !== 0;
      if (queryEl) queryEl.textContent = query;

      if (countEl) {
        countEl.textContent = total === 0
          ? 'No matches'
          : 'Showing ' + (first + 1) + '–' + Math.min(last, total) +
            ' of ' + total + ' ' + (total === 1 ? noun : nounPlural);
      }
      if (pagination) pagination.hidden = total === 0;
      if (pageInfo) pageInfo.textContent = 'Page ' + page + ' of ' + pages;
      if (prevEl) prevEl.disabled = page <= 1;
      if (nextEl) nextEl.disabled = page >= pages;
    }

    cards.forEach(function (c, i) { c._baId = i; });

    if (search) {
      search.addEventListener('input', function (e) {
        query = e.target.value.trim();
        page = 1;
        apply();
      });
    }
    if (clearEl) {
      clearEl.addEventListener('click', function () {
        if (search) { search.value = ''; search.focus(); }
        query = '';
        page = 1;
        apply();
      });
    }
    if (perPageEl) {
      perPageEl.addEventListener('change', function (e) {
        perPage = parseInt(e.target.value, 10) || perPage;
        page = 1;
        apply();
      });
    }
    function step(delta) {
      page += delta;
      apply();
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    if (prevEl) prevEl.addEventListener('click', function () { if (page > 1) step(-1); });
    if (nextEl) nextEl.addEventListener('click', function () { step(1); });

    apply();
  }

  function scan() {
    document.querySelectorAll('[data-ba-directory]').forEach(setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // Bookshop swaps the section's DOM while editing, which drops the listeners
  // and the _baReady flag with it. Re-running setup on the new nodes is all
  // that is needed; the flag stops it stacking listeners on untouched ones.
  if (window.MutationObserver) {
    var pending = null;
    new MutationObserver(function () {
      clearTimeout(pending);
      pending = setTimeout(scan, 80);
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
