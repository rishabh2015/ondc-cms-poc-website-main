/* Beckn canvas — the shared behaviour for every ONDC category page.
 *
 * Port of the Claude Design component's DCLogic class to plain DOM. Four things:
 *   1. reveal-on-scroll for .bk-rv, plus the hero intro cascade
 *   2. count-up on [data-bk-count] the first time its cell reveals
 *   3. the mechanism spine: a fill line, nodes that pop as the fill passes them,
 *      and per-word colour scrub on [data-bk-scrub] blocks
 *   4. the role tabs in the join section
 *
 * 3 is the only part that runs per frame, so it is the only part on rAF, and it
 * bails immediately when the section is off screen.
 *
 * Every page drives this from markup alone — no per-page config lives here.
 * See docs/beckn-category-template.md for the attribute contract.
 */
(function () {
  'use strict';

  var root = document.querySelector('.bk');
  if (!root) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 0. Marquee doubling ────────────────────────────────────────────────── */
  /* The CSS loops translate by -50%, which only reads as seamless when the
   * track holds exactly two copies of the list. Cloning here keeps the markup
   * to one copy; without JS the cards still render, they just don't loop. */
  /* Skipped on phones: the doubling exists only to make the loop seamless, and
   * a single copy is the documented no-JS state. mobile.css stops the animation
   * at the same width, so the row reads as a static strip of cards instead of
   * dozens of background-image tiles animating behind the content. */
  /* The marked class, not the width, is what stops the animation in mobile.css:
   * a phone rotated to landscape leaves a width-based query but cannot re-double
   * the DOM, and a single copy under a running loop shows the seam. */
  var loopWide = window.matchMedia('(min-width: 701px)').matches;
  root.querySelectorAll('[data-bk-loop]').forEach(function (track) {
    if (loopWide) track.innerHTML += track.innerHTML;
    else track.classList.add('bk-loop-static');
  });

  /* ── 1. Reveal + hero intro ─────────────────────────────────────────────── */
  var revealEls = Array.prototype.slice.call(root.querySelectorAll('.bk-rv'));

  function show(el) {
    el.classList.add('bk-in');
    el.querySelectorAll('[data-bk-count]').forEach(countUp);
  }

  if (reduced || !('IntersectionObserver' in window)) {
    revealEls.forEach(show);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        show(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });

    // Safety net: anything already in view when the observer misses it.
    setTimeout(function () {
      revealEls.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) show(el);
      });
    }, 3000);
  }

  if (!reduced) {
    root.querySelectorAll('[data-bk-intro]').forEach(function (el, i) {
      el.style.opacity = '0';
      el.style.animation = 'bkIntroUp .95s cubic-bezier(.16,1,.3,1) ' +
        (0.15 + i * 0.16).toFixed(2) + 's forwards';
    });
  }

  /* ── 2. Count-up ────────────────────────────────────────────────────────── */
  function countUp(el) {
    if (el._bkDone) return;
    var target = parseInt(el.getAttribute('data-bk-count'), 10);
    if (!target) return;
    el._bkDone = true;

    if (reduced) { el.textContent = String(target); return; }

    var t0 = performance.now(), dur = 1200;
    (function tick(t) {
      var p = Math.min(1, (t - t0) / dur);
      el.textContent = String(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ── 3. Mechanism spine + word scrub ────────────────────────────────────── */
  var mech = document.getElementById('bk-mech');
  var fill = document.getElementById('bk-spine-fill');

  // Split every text node of a [data-bk-scrub] block into per-word spans once.
  var scrubBlocks = [];
  if (mech && !reduced) {
    mech.querySelectorAll('[data-bk-scrub]').forEach(function (block) {
      var walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      var nodes = [], n;
      while ((n = walker.nextNode())) {
        var t = n.textContent.trim();
        if (t && t !== '·') nodes.push(n);
      }
      nodes.forEach(function (node) {
        var orig = getComputedStyle(node.parentElement).color;
        var frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (tok) {
          if (!tok) return;
          if (!tok.trim()) { frag.appendChild(document.createTextNode(tok)); return; }
          var sp = document.createElement('span');
          sp.className = 'bk-scrub-w';
          sp.textContent = tok;
          sp._bkColor = orig;
          frag.appendChild(sp);
        });
        node.parentNode.replaceChild(frag, node);
      });
      var spans = Array.prototype.slice.call(block.querySelectorAll('.bk-scrub-w'));
      if (spans.length) scrubBlocks.push({ el: block, spans: spans });
    });
  }

  var nodes = mech ? Array.prototype.slice.call(mech.querySelectorAll('.bk-step-node')) : [];

  function spineTick() {
    if (!fill || !nodes.length) return;
    var track = fill.parentElement.getBoundingClientRect();
    var line = track.height - 38;
    if (line <= 0) return;
    var px = Math.max(0, Math.min(1, (window.innerHeight * 0.62 - track.top) / line)) * line;
    fill.style.height = px + 'px';

    nodes.forEach(function (node) {
      var offset = node.getBoundingClientRect().top - track.top + 6;
      var on = px >= offset - 2;
      if (node._bkOn === on) return;
      node._bkOn = on;
      node.classList.toggle('bk-on', on);
      if (on && node.animate) {
        node.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.55)' }, { transform: 'scale(1)' }],
          { duration: 460, easing: 'cubic-bezier(.16,1,.3,1)' }
        );
      }
    });
  }

  function scrubTick() {
    var vh = window.innerHeight;
    scrubBlocks.forEach(function (b) {
      var top = b.el.getBoundingClientRect().top;
      var p = Math.max(0, Math.min(1, (vh * 0.82 - top) / (vh * 0.6)));
      var lit = Math.round(p * b.spans.length);
      b.spans.forEach(function (sp, i) {
        sp.style.color = i < lit ? sp._bkColor : '';
      });
    });
  }

  if (mech && !reduced) {
    var queued = false;
    var frame = function () {
      queued = false;
      var box = mech.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) return;
      spineTick();
      scrubTick();
    };
    var onScroll = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(frame);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    frame();
  }

  /* ── 3b. Gateway relay ───────────────────────────────────────────────── */
  var relay = root.querySelector('[data-bk-relay]');
  if (relay && !reduced) {
    var relayQueued = false;
    var relayTick = function () {
      relayQueued = false;
      var box = relay.getBoundingClientRect();
      var progress = Math.max(0, Math.min(1, (window.innerHeight * .68 - box.top) / (box.height + window.innerHeight * .1)));
      relay.style.setProperty('--bk-relay-progress', progress.toFixed(3));
    };
    var relayScroll = function () {
      if (relayQueued) return;
      relayQueued = true;
      requestAnimationFrame(relayTick);
    };
    window.addEventListener('scroll', relayScroll, { passive: true });
    window.addEventListener('resize', relayScroll);
    relayTick();
  }

  /* ── 4. Role tabs ───────────────────────────────────────────────────────── */
  /* Content-free on purpose: every panel is authored in the page markup and
   * addressed by aria-controls, so one script serves three-tab and four-tab
   * sectors with whatever copy and calls to action each one needs. */
  var tabs = Array.prototype.slice.call(root.querySelectorAll('.bk-tab'));

  if (tabs.length) {
    var panelFor = function (tab) {
      var id = tab.getAttribute('aria-controls');
      return id ? document.getElementById(id) : null;
    };

    var select = function (chosen) {
      tabs.forEach(function (tab) {
        var on = tab === chosen;
        var panel = panelFor(tab);
        tab.setAttribute('aria-selected', String(on));
        if (panel) panel.hidden = !on;
      });
    };

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { select(tab); });
    });

    // Honour whichever tab the markup marked selected; fall back to the first.
    select(tabs.filter(function (t) {
      return t.getAttribute('aria-selected') === 'true';
    })[0] || tabs[0]);
  }
})();
