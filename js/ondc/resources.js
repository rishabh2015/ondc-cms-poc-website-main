/* Resources knowledge base — the hub search and the per-page filter.
   =====================================================================
   Every row on every Resources page is already in the page: Eleventy renders
   all of them at build time from src/_data/resources.json. This script only
   toggles `hidden`, sets `order`, and writes text into elements that exist.
   It never creates, moves or removes a node — the rule the participant
   directories follow, and for the same reason: Bookshop replaces a section's
   DOM while an editor types, and a row the script built would vanish on the
   next keystroke.

   Markup contract (data attributes, so ids stay free for anchors):
     HUB
       [data-res-search]          the search box, carries [data-res-limit]
       [data-res-search-input]    the input
       [data-res-results]         the results box
       [data-res-results-head]    "12 results"
       [data-res-hit]             one pre-rendered result, with
                                  [data-res-title] and [data-res-hay]
       [data-res-no-results]      the nothing-found line
     SUB-PAGE
       [data-res-library]         the section
       [data-res-filter]          the filter box
       [data-res-filter-count]    "3 matching resources"
       [data-res-filter-empty]    the nothing-matched line
       [data-res-sec]             one section of documents — a <div>, or a
                                  <details class="is-collapsible"> on a page
                                  that folds its groups
       [data-res-row]             one document row
       [data-res-nav-details]     the sidebar disclosure

   Safe to load on any page: does nothing when neither is present.
   ===================================================================== */
(function () {
  'use strict';

  function text(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  /* ── hub: search the whole knowledge base ─────────────────────────── */
  function setupSearch(root) {
    if (root._resReady) return;
    root._resReady = true;

    var input = root.querySelector('[data-res-search-input]');
    var results = document.querySelector('[data-res-results]');
    if (!input || !results) return;

    var head = results.querySelector('[data-res-results-head]');
    var none = results.querySelector('[data-res-no-results]');
    var hits = [].slice.call(results.querySelectorAll('[data-res-hit]')).map(function (el) {
      return {
        el: el,
        title: (el.getAttribute('data-res-title') || ''),
        hay: (el.getAttribute('data-res-hay') || '')
      };
    });
    var limit = parseInt(root.getAttribute('data-res-limit'), 10) || 30;

    function clear() {
      for (var i = 0; i < hits.length; i++) hits[i].el.hidden = true;
      results.hidden = true;
      if (none) none.hidden = true;
      text(head, '');
    }

    function run() {
      var q = input.value.trim().toLowerCase();
      if (!q) { clear(); return; }

      /* Two passes so a title match outranks one found only in the blurb,
         WITHOUT moving a node: the results box is a flex column, so `order`
         does the sorting the original did by rebuilding the list. */
      var shown = 0, total = 0;
      for (var i = 0; i < hits.length; i++) {
        var h = hits[i];
        var match = h.hay.indexOf(q) !== -1;
        if (!match) { h.el.hidden = true; continue; }
        total++;
        if (shown < limit) {
          h.el.hidden = false;
          h.el.style.order = h.title.indexOf(q) !== -1 ? 1 : 2;
          shown++;
        } else {
          h.el.hidden = true;
        }
      }

      /* A title match found after the cap would have outranked something
         already shown. Cheap to be right: when the cap bit, sweep once more
         and swap the tail for any title matches that missed out. */
      if (total > limit) {
        var visible = [], spare = [];
        for (var j = 0; j < hits.length; j++) {
          var hit = hits[j];
          if (hit.hay.indexOf(q) === -1) continue;
          if (!hit.el.hidden) visible.push(hit);
          else if (hit.title.indexOf(q) !== -1) spare.push(hit);
        }
        for (var k = visible.length - 1; k >= 0 && spare.length; k--) {
          if (visible[k].title.indexOf(q) !== -1) continue;   // already a title match
          visible[k].el.hidden = true;
          var promoted = spare.shift();
          promoted.el.hidden = false;
          promoted.el.style.order = 1;
        }
      }

      text(head, total
        ? total + ' result' + (total === 1 ? '' : 's') + (total > limit ? ' — showing first ' + limit : '')
        : 'No results');
      if (none) {
        none.hidden = total !== 0;
        if (!total) text(none, 'Nothing found for “' + input.value.trim() + '”. Try a different term.');
      }
      results.hidden = false;
    }

    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(run, 120);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; run(); input.blur(); }
    });
    if (!root._resHotkey) {
      root._resHotkey = true;
      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') {
          e.preventDefault();
          input.focus();
        }
      });
    }

    clear();
  }

  /* ── sub-page: filter the documents on this page ──────────────────── */
  /* ── the accordion ────────────────────────────────────────────────
     A page that folds its groups renders each one as a <details>. Nothing
     here breaks the no-new-nodes rule: it sets `open` on an element that is
     already in the page and animates the height of a <div> that is too.

     <details> cannot transition its own height, so the body is animated by
     hand and `open` is not cleared until the collapse has actually finished
     — which is why "is it open?" and "where is it heading?" are two
     different questions below. */
  var REDUCED = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : { matches: false };

  function panelBody(d) { return d.querySelector('.res-sec-body'); }

  /* no animation — what the filter and a hash jump want, where the travel is
     something to get past rather than something to sit and watch */
  function setOpenNow(d, open) {
    if (d._anim) { d._anim.cancel(); d._anim = null; }
    d._targetOpen = open;
    d.open = open;
  }

  /* mid-collapse `open` still reads true, and what a click should reverse is
     where the section is heading, not where it currently is */
  function headingOpen(d) {
    return (d._anim && d._anim.playState === 'running') ? d._targetOpen : d.open;
  }

  function slidePanel(d, opening) {
    var b = panelBody(d);
    if (!b || !b.animate) { setOpenNow(d, opening); return; }
    /* A closed <details> still reports its content's full height, so the
       collapsed end of the travel is a literal 0 and never a measurement.
       Mid-flight the live height is what a reversal has to start from —
       measured BEFORE cancelling, or it has already snapped back to rest. */
    var running = d._anim && d._anim.playState === 'running';
    var from = (opening && !running) ? 0 : b.getBoundingClientRect().height;
    if (d._anim) { d._anim.cancel(); d._anim = null; }
    d._targetOpen = opening;
    if (REDUCED.matches) { d.open = opening; return; }
    if (opening) d.open = true;
    var to = opening ? b.scrollHeight : 0;
    if (from === to) { if (!opening) d.open = false; return; }
    // longer lists get a little longer to travel, but never enough to drag
    var dur = Math.min(420, 200 + Math.abs(to - from) * 0.06);
    var anim = b.animate(
      { height: [from + 'px', to + 'px'], opacity: opening ? [0, 1] : [1, 0] },
      { duration: dur, easing: 'cubic-bezier(.22,.61,.36,1)' }
    );
    d._anim = anim;
    anim.onfinish = function () {
      d._anim = null;
      if (!opening) d.open = false;
    };
  }

  /* The sidebar links to #sec-N. A folded section has to open itself, or the
     link lands on a heading with nothing under it. Registered once on the
     window rather than per section, so a Bookshop re-render cannot stack
     listeners or leave one pointing at a node that is gone. */
  function openFromHash(scroll) {
    var id = location.hash ? location.hash.slice(1) : '';
    var target = id ? document.getElementById(id) : null;
    if (!target || !target.classList || !target.classList.contains('is-collapsible')) return;
    var panels = [].slice.call(target.parentNode.querySelectorAll('details.res-sec'));
    panels.forEach(function (o) { if (o !== target) setOpenNow(o, false); });
    setOpenNow(target, true);
    if (scroll && target.scrollIntoView) target.scrollIntoView();
  }

  function setupLibrary(root) {
    if (root._resReady) return;
    root._resReady = true;

    var input = root.querySelector('[data-res-filter]');
    if (!input) return;
    var countEl = root.querySelector('[data-res-filter-count]');
    var emptyEl = root.querySelector('[data-res-filter-empty]');

    var sections = [].slice.call(root.querySelectorAll('[data-res-sec]')).map(function (sec) {
      var headEl = sec.querySelector('.res-sec-head');
      return {
        el: sec,
        head: (headEl ? headEl.textContent : '').toLowerCase(),
        rows: [].slice.call(sec.querySelectorAll('[data-res-row]')).map(function (r) {
          return { el: r, hay: r.textContent.toLowerCase() };
        })
      };
    });

    /* One group open at a time. A <summary>'s own default toggle is not what
       we want — it would open this one without closing the last — so the
       click is taken over entirely. */
    var panels = sections
      .map(function (sec) { return sec.el; })
      .filter(function (el) { return el.tagName === 'DETAILS'; });

    panels.forEach(function (d) {
      var summary = d.querySelector('summary');
      if (!summary) return;
      summary.addEventListener('click', function (e) {
        e.preventDefault();
        var opening = !headingOpen(d);
        if (opening) {
          panels.forEach(function (o) { if (o !== d && headingOpen(o)) slidePanel(o, false); });
        }
        slidePanel(d, opening);
      });
    });
    if (panels.length) openFromHash(true);

    /* The sidebar ships open because the desktop layout shows it flat. On a
       phone it is a disclosure, and open by default it would push the
       documents a screen and a half down. */
    if (window.matchMedia && window.matchMedia('(max-width: 1000px)').matches) {
      [].forEach.call(root.querySelectorAll('[data-res-nav-details]'), function (d) { d.open = false; });
    }

    /* which groups the reader had open before they started typing, so the
       accordion can be put back that way once the box is cleared */
    var openBeforeFilter = null;

    function apply() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;

      sections.forEach(function (sec) {
        /* A query naming the section keeps all of its rows: row titles are
           often just a participant's name, and "static terms" should find the
           section that phrase heads. */
        var secHit = !!q && sec.head.indexOf(q) !== -1;
        var visible = 0;
        sec.rows.forEach(function (row) {
          var on = !q || secHit || row.hay.indexOf(q) !== -1;
          row.el.hidden = !on;
          if (on) visible++;
        });
        /* A section that is prose with no documents has nothing to match, so
           it stays while the page is unfiltered and goes once it is. */
        sec.el.hidden = sec.rows.length === 0 ? !!q : visible === 0;
        shown += visible;
      });

      /* A folded group hides its own matches. While a query is active every
         group still showing a hit is opened — without animating, because five
         of them unfolding at once is noise, not feedback. */
      if (panels.length) {
        if (q && !openBeforeFilter) {
          openBeforeFilter = panels.map(function (d) { return d.open; });
        }
        panels.forEach(function (d, i) {
          if (q) setOpenNow(d, !d.hidden);
          else if (openBeforeFilter) setOpenNow(d, openBeforeFilter[i]);
        });
        if (!q) openBeforeFilter = null;
      }

      text(countEl, q ? shown + ' matching resource' + (shown === 1 ? '' : 's') : '');
      if (emptyEl) emptyEl.hidden = !(q && shown === 0);
    }

    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    });

    apply();
  }

  function scan() {
    document.querySelectorAll('[data-res-search]').forEach(setupSearch);
    document.querySelectorAll('[data-res-library]').forEach(setupLibrary);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  window.addEventListener('hashchange', function () { openFromHash(true); });

  // Bookshop swaps a section's DOM while editing, which drops the listeners
  // and the _resReady flag with it. Re-running setup on the new nodes is all
  // that is needed; the flag stops it stacking listeners on untouched ones.
  if (window.MutationObserver) {
    var pending = null;
    new MutationObserver(function () {
      clearTimeout(pending);
      pending = setTimeout(scan, 80);
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
