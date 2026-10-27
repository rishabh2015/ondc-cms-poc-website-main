/* .reveal — fade-and-rise on scroll.
   =====================================================================
   legal.css holds `.reveal` at `opacity: 0` and only paints it once the
   class `in` arrives, so WITHOUT this script every element carrying
   `.reveal` is invisible. ondc.org ships the same observer inline at the
   bottom of each legal and resources page; it lives here instead so a new
   page gets it by listing one script rather than copying ten lines.

   This is a second reveal system alongside `.bk-rv` (beckn.js), not a
   replacement: the two stylesheets stage their elements differently and
   the resources pages were built against this one.

   Nodes rendered after load — none today, but the rule should hold — are
   picked up by a MutationObserver, the same way the directories re-scan
   after Bookshop re-renders a section in the editor.
   ===================================================================== */
(function () {
  'use strict';

  var SEL = '.reveal:not(.in)';

  /* No IntersectionObserver, or the reader asked for no motion: show
     everything at once rather than leaving the page blank. */
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!window.IntersectionObserver || reduced) {
    var showAll = function () {
      document.querySelectorAll(SEL).forEach(function (el) { el.classList.add('in'); });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showAll);
    else showAll();
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { threshold: 0.07 });

  function scan() {
    document.querySelectorAll(SEL).forEach(function (el) { io.observe(el); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();

  if (window.MutationObserver) {
    var pending = null;
    new MutationObserver(function () {
      clearTimeout(pending);
      pending = setTimeout(scan, 80);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
