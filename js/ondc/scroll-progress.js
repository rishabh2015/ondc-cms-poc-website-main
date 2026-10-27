/* Scroll progress bar. Fills <span id="progBar"> as the page scrolls.
   Safe to load on any page: does nothing when the element is absent. */
(function () {
  'use strict';
    // ── SCROLL PROGRESS ──────────────────────────────────────────────────────
    const bar = document.getElementById('progBar');
    if (!bar) return;
    window.addEventListener('scroll', () => {
      const p = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      // category-chrome.css paints this span with transform: scaleX(0) and a
      // transform-origin of left, deliberately keeping it off the layout path.
      // Setting `width` alone therefore moved nothing — the bar stayed at
      // scaleX(0) and never appeared on any page. legal.css redefines the span
      // as width-driven instead, so both are set and whichever rule won paints.
      bar.style.width = '100%';
      bar.style.transform = 'scaleX(' + Math.max(0, Math.min(p, 1)) + ')';
    }, { passive: true });
})();
