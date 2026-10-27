/* Legal documents — the clause you are reading takes the blue in the index.
   =====================================================================
   ondc.org carries this as an inline script on each legal page. Here it is
   a file, for the reason every other page script is: an inline script in a
   page's front matter is deleted the first time CloudCannon saves that page.

   It only ever toggles a class on a link that is already in the page. It
   creates nothing — Bookshop replaces a section's DOM while an editor types,
   and a node this script built would vanish on the next keystroke.

   Markup contract:
     [data-bk-doc-link]   one index link, href="#<clause id>"
     [data-bk-clause]     the clause it points at, id matching that href

   Safe to load on any page: does nothing where there is no index.
   ===================================================================== */
(function () {
  'use strict';

  function setup() {
    var links = [].slice.call(document.querySelectorAll('[data-bk-doc-link]'));
    if (!links.length || !('IntersectionObserver' in window)) return;

    var byId = {};
    var clauses = [];
    links.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      if (href.charAt(0) !== '#') return;
      var clause = document.getElementById(href.slice(1));
      if (!clause) return;
      byId[clause.id] = link;
      clauses.push(clause);
    });
    if (!clauses.length) return;

    /* A band across the upper-middle of the window: a clause counts as the
       one being read from a little below the top until most of the way down,
       so the index does not flicker between two of them at a boundary. */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = byId[entry.target.id];
        if (link) link.classList.toggle('bk-doc-index-active', entry.isIntersecting);
      });
    }, { rootMargin: '-15% 0px -70% 0px' });

    clauses.forEach(function (clause) { io.observe(clause); });

    /* Dropped on the next run, which the observer below triggers after a
       re-render: observing a detached node is harmless but pointless. */
    if (window._bkDocIndex) window._bkDocIndex.disconnect();
    window._bkDocIndex = io;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }

  // Bookshop swaps the section's DOM while editing, which leaves the observer
  // watching nodes that are no longer in the page. Re-running setup rebuilds
  // it against the new ones.
  if (window.MutationObserver) {
    var pending = null;
    new MutationObserver(function () {
      clearTimeout(pending);
      pending = setTimeout(setup, 80);
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
