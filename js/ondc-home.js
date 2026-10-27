/* =====================================================================
   ONDC home page behaviour — a vanilla-JS port of the React app
   (Hero.jsx, HeroCarousel.jsx, MetricsBar.jsx, DPISection.jsx,
   App.jsx, SocialProof.jsx) so the page can stay plain HTML that
   CloudCannon edits.

   Two modes:
   • LIVE (preview / published site): everything below runs.
   • EDITOR (CloudCannon visual editor): nothing animates and nothing is
     moved around. We only add  html.is-editing  so cms.css lays every
     section out flat and every editable region stays visible.

   Rule that keeps editing safe: this script never changes the contents of
   an element that has data-editable. It builds NEW elements next to them
   (the hero, the counter overlays) or toggles classes on wrappers.
   ===================================================================== */
(function () {
  'use strict';

  var doc = document, html = doc.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp01 = function (t) { return t < 0 ? 0 : t > 1 ? 1 : t; };
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };

  /* ---- a scope = a bag of listeners/timers that can be switched off ---- */
  function Scope() {
    var ac = new AbortController(), fns = [];
    return {
      on: function (t, e, f, o) { t.addEventListener(e, f, Object.assign({ signal: ac.signal }, o || {})); },
      add: function (fn) { fns.push(fn); },
      dispose: function () { ac.abort(); fns.splice(0).forEach(function (f) { try { f(); } catch (e) { } }); }
    };
  }
  function observe(scope, opts, cb, els) {
    var io = new IntersectionObserver(cb, opts);
    els.forEach(function (e) { io.observe(e); });
    scope.add(function () { io.disconnect(); });
    return io;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var page = null;          // live-mode scope
  var heroCtl = null;       // hero scope + nodes

  /* =====================================================================
     EDITOR MODE
     ===================================================================== */
  var editorReady = false;
  function enterEditor() {
    if (editorReady) return;
    editorReady = true;
    html.classList.add('is-editing');
    if (page) { page.dispose(); page = null; }
    if (heroCtl) { heroCtl.dispose(); heroCtl = null; }
    $$('.ondc-hero, .home-ambient, .intro-skip, .metric-num-ghost').forEach(function (n) { n.remove(); });
    $$('.is-counting').forEach(function (n) { n.classList.remove('is-counting'); });
    $$('.slide').forEach(function (s) { s.removeAttribute('inert'); });
  }

  /* =====================================================================
     HERO — "forming India" scroll story  (Hero.jsx)
     ===================================================================== */
  var DEF = {
    beats: [
      ['Every business in India', 'deserves access to every customer in India.'],
      ['ONDC connects them', 'through one open network.'],
      ['Sellers, buyer apps, logistics and payments', 'speak one shared language.'],
      ['And when every connection holds hands,', 'a country takes shape.']
    ],
    impact: ['One Open network.', 'A connected India.'],
    headline: 'Across cities, categories and communities.',
    wordmark: 'ONDC',
    title: "Building India's Digital Commerce Infrastructure",
    tagline: 'One Network. Efficiency by Design. Inclusion by Intent.',
    ctas: [['Explore the network', '#site-top'], ['Join the ecosystem', '#find-your-place']],
    metrics: []   // ondc.org shows no counters inside the hero; add a [data-key="hero-numbers"] list to bring them back
  };
  var MESH_EVENTS = ['pulse-accelerate', 'participant-flare', 'city-glints', 'seller-shimmer'];
  var BEAT_WINDOWS = [
    { id: 'beat-1', from: 0, to: 0.15 }, { id: 'beat-2', from: 0.15, to: 0.35 },
    { id: 'beat-3', from: 0.35, to: 0.55 }, { id: 'beat-1b', from: 0.55, to: 0.85 }
  ];

  function textOf(html_) {
    var d = doc.createElement('div'); d.innerHTML = html_;
    return d.textContent.replace(/\s+/g, ' ').trim();
  }
  function linesOf(p) { return p.innerHTML.split(/<br\s*\/?>/i).map(textOf).filter(Boolean); }

  /* read the editable hero copy; anything missing falls back to the default */
  function readHeroCopy() {
    var out = JSON.parse(JSON.stringify(DEF));
    var story = $('[data-key="hero-story"]');
    if (story) {
      var ps = $$('p', story).filter(function (p) { return !p.querySelector('a'); });
      var L = ps.map(linesOf);
      for (var i = 0; i < 4; i++) if (L[i] && L[i].length) out.beats[i] = [L[i][0], L[i][1] || ''];
      if (L[4] && L[4].length) out.impact = [L[4][0], L[4][1] || ''];
      if (L[5] && L[5][0]) out.headline = L[5][0];
      if (L[6] && L[6][0]) out.wordmark = L[6][0];
      if (L[7] && L[7][0]) out.title = L[7][0];
      if (L[8] && L[8][0]) out.tagline = L[8][0];
      $$('a', story).slice(0, 2).forEach(function (a, i) {
        var t = a.textContent.trim();
        if (t) out.ctas[i] = [t, a.getAttribute('href') || out.ctas[i][1]];
      });
    }
    var nums = $('[data-key="hero-numbers"]');
    if (nums) {
      var rows = $$('li', nums).map(function (li) {
        var s = li.querySelector('strong, b');
        var num = s ? s.textContent.trim() : '';
        var label = li.textContent.replace(s ? s.textContent : '', '').replace(/\s+/g, ' ').trim();
        return [num, label];
      }).filter(function (r) { return r[0]; });
      if (rows.length) out.metrics = rows.slice(0, 4);
    }
    return out;
  }

  /* ---- slot-reel words: deterministic anagram strips ending in the real word ---- */
  var REEL_WORD_DEPTH = 3; // keep in sync with hero.css --reel-depth
  function heroHash01(i, salt) {
    var x = (i + 1) * 374761393 + salt * 668265263;
    x = (x ^ (x >> 13)) * 1274126177;
    x = x ^ (x >> 16);
    return (x >>> 0) / 4294967296;
  }
  function scramble(letters, seed, salt) {
    var arr = letters.split('');
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(heroHash01(seed, salt * 31 + i + 1) * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr.join('');
  }
  function reelWord(word, seed, delayMs) {
    var style = ' style="--rdelay: ' + delayMs + 'ms;"';
    var m = /^([A-Za-z]*)(.*)$/.exec(word), core = m[1], rest = m[2];
    if (!core) return '<span class="hb-static"' + style + '>' + esc(word) + '</span>';
    var rows = [];
    for (var d = 0; d < REEL_WORD_DEPTH - 1; d++) rows.push(scramble(core, seed, d + 1) + rest);
    rows.push(word);
    return '<span class="hb-mask"' + style + '><span class="hb-reel">' +
      rows.map(function (r) { return '<span>' + esc(r) + '</span>'; }).join('') + '</span></span>';
  }
  function beatBlock(id, tag, align, line1, line2) {
    var wi = 0;
    function line(text) {
      if (!text) return '';
      return '<span class="hb-line">' + text.split(' ').filter(Boolean).map(function (w) {
        var h = '<span>' + reelWord(w, wi, wi * 80) + ' </span>'; wi++; return h;
      }).join('') + '</span>';
    }
    return '<' + tag + ' class="hero-beat" data-beat="' + id + '" data-align="' + align + '">' +
      line(line1) + line(line2) + '</' + tag + '>';
  }

  function buildHero() {
    if (heroCtl || !window.OndcHeroMap) return;
    var header = $('#site-header');
    if (!header) return;
    var c = readHeroCopy(), S = new Scope();

    var metricsHtml = c.metrics.map(function (m, i) {
      var id = i === 0 ? 'metric-transactions' : i === 1 ? 'metric-participants' : 'metric-' + (i + 1);
      return '<div class="hero-metric" data-metric="' + id + '" data-index="' + i + '">' +
        '<span class="hero-metric-wash" aria-hidden="true"></span><span class="hero-metric-node" aria-hidden="true"></span>' +
        '<svg class="hero-metric-leader" aria-hidden="true" viewBox="0 0 120 24" preserveAspectRatio="none"><path data-leader="true" d="M120 12 H8 L0 12"></path></svg>' +
        '<div><span class="hero-metric-numeral" data-numeral="true">' + esc(m[0]) + '</span><span class="hero-metric-label">' + esc(m[1]) + '</span></div></div>';
    }).join('');

    var root = doc.createElement('div');
    root.className = 'ondc-hero';
    root.innerHTML =
      '<div class="mesh-stage" aria-hidden="true"><canvas class="mesh-canvas"></canvas></div>' +
      '<section id="story" aria-label="Story" class="hero-act-genesis"><div class="hero-genesis-stage" data-genesis-stage="true">' +
      '<div class="hero-spine" aria-hidden="true"></div>' +
      '<div class="hero-beat-stack">' +
      c.beats.map(function (b, i) {
        return beatBlock(BEAT_WINDOWS[i].id, i === 0 ? 'h1' : 'p', 'center', b[0], b[1]);
      }).join('') +
      '</div>' +
      '<div class="hero-lockup" data-lockup="true" data-painted="false"><span class="hero-lockup-swish" aria-hidden="true"></span>' +
      '<p class="hero-wordmark">' + esc(c.wordmark) + '</p><p class="hero-title">' + esc(c.title) + '</p><p class="hero-tagline">' + esc(c.tagline) + '</p>' +
      '<div class="hero-ctas"><a class="hero-cta-primary" href="' + esc(c.ctas[0][1]) + '">' + esc(c.ctas[0][0]) + '</a>' +
      '<a class="hero-cta-secondary" href="' + esc(c.ctas[1][1]) + '">' + esc(c.ctas[1][0]) + '</a></div></div>' +
      '</div></section>' +
      '<section id="impact" aria-label="Impact" class="hero-act-impact"><div class="hero-map-dock" aria-hidden="true"></div>' +
      '<div class="hero-impact-content">' + beatBlock('beat-act2', 'h2', 'left', c.impact[0], c.impact[1]) +
      '<p class="hero-impact-headline">' + esc(c.headline) + '</p>' + (metricsHtml ? '<div class="hero-metrics">' + metricsHtml + '</div>' : '') + '</div></section>';
    header.after(root);

    var canvas = $('.mesh-canvas', root);
    var story = $('#story', root), impact = $('#impact', root);
    var map = null, disposed = false, inView = false;
    var sync = function () { if (map) map.setVisible(inView && !doc.hidden); };

    /* mesh: fetch the India outline, hand it to hero-map.js */
    fetch('/images/home-india-scaffold.svg').then(function (r) { return r.text(); }).then(function (svg) {
      if (disposed) return;
      var d = (svg.match(/\sd="([^"]+)"/) || [])[1];
      if (!d) throw new Error('no path');
      map = window.OndcHeroMap.create(canvas, d, { reduced: reduced });
      canvas.classList.add('visible');
      sync();
      // the map is created asynchronously: replay the current scroll state onto it
      genesisUpdate(true); impactUpdate(true);
      if (reduced) map.setProgress(1);
    }).catch(function (e) { console.error('[hero] map outline failed to load', e); });
    S.on(doc, 'visibilitychange', sync);
    observe(S, {}, function (es) { inView = es.some(function (e) { return e.isIntersecting; }); sync(); }, [canvas.parentElement]);

    /* Act 1 — beats painted by scroll progress over #story */
    var beats = BEAT_WINDOWS.map(function (w) {
      return { from: w.from, to: w.to, el: $('[data-beat="' + w.id + '"]', story) };
    });
    var lockup = $('[data-lockup]', story), prevP = -1;
    if (reduced) {
      $$('[data-beat]', root).forEach(function (el) { el.dataset.painted = 'true'; });
      lockup.dataset.painted = 'true';
      root.style.setProperty('--hero-spine', '1');
    } else {
      beats.forEach(function (b) { if (b.el) b.el.dataset.armed = 'true'; });
    }
    function genesisUpdate(force) {
      if (reduced) return;
      var rect = story.getBoundingClientRect();
      var travel = rect.height - innerHeight;
      var p = clamp01(-rect.top / travel);
      if (p === prevP && !force) return;
      prevP = p;
      beats.forEach(function (b) {
        var on = p >= b.from && p < b.to;
        if (b.el && (b.el.dataset.painted === 'true') !== on) b.el.dataset.painted = on ? 'true' : 'false';
      });
      if (map) map.setProgress(p);
      root.style.setProperty('--hero-spine', p.toFixed(3));
      var lit = p >= 0.85;
      if (lit && lockup.dataset.painted !== 'true' && !lockup.dataset.swished) lockup.dataset.swished = 'true';
      lockup.dataset.painted = lit ? 'true' : 'false';
    }

    /* Act 2 — map docks left; fades out over the act's last half viewport */
    var prevT = -1, prevExit = -1;
    function impactUpdate(force) {
      if (reduced) return;
      var vh = innerHeight, rect = impact.getBoundingClientRect();
      var t = clamp01((vh * 0.85 - rect.top) / (vh * 0.7));
      var exit = clamp01((-rect.bottom + vh * 1.5) / (vh * 0.5));
      if (exit !== prevExit) { prevExit = exit; root.style.setProperty('--hero-exit', exit.toFixed(3)); }
      if (t === prevT && !force) return;
      var leftBack = t <= 0 && prevT > 0;
      prevT = t;
      if (map && (t > 0 || leftBack || force)) map.setDock(t);
    }
    var onScroll = function () { genesisUpdate(); impactUpdate(); };
    S.on(window, 'scroll', onScroll, { passive: true });
    S.on(window, 'resize', onScroll);
    genesisUpdate(); impactUpdate();

    /* metric modules: leader line draws, numeral counts once, mesh gets an impulse */
    $$('.hero-metric', impact).forEach(function (el, i) {
      var numeral = $('[data-numeral]', el), leader = $('[data-leader]', el);
      var m = /^(\D*)(\d+)(.*)$/.exec(numeral.textContent.trim());
      var fired = false;
      if (!reduced) el.dataset.armed = 'true';
      var io = observe(S, { rootMargin: '0px 0px -22% 0px' }, function (es) {
        if (!es.some(function (e) { return e.isIntersecting; })) return;
        io.disconnect();
        if (fired) return; fired = true;
        el.dataset.ignited = 'true';
        if (map) map.impulse(MESH_EVENTS[i] || MESH_EVENTS[0]);
        if (reduced) return;
        if (leader) {
          var len = leader.getTotalLength();
          leader.style.strokeDasharray = '' + len;
          leader.style.strokeDashoffset = '' + len;
          void leader.getBoundingClientRect();
          leader.style.transition = 'stroke-dashoffset var(--t-line) ease-out';
          leader.style.strokeDashoffset = '0';
        }
        if (numeral && m) {
          var to = parseInt(m[2], 10), start = performance.now();
          var tick = function (now) {
            var t = Math.min(1, (now - start) / 1200), e = 1 - Math.pow(1 - t, 3);
            numeral.textContent = m[1] + Math.round(to * e) + m[3];
            if (t < 1) requestAnimationFrame(tick); else numeral.textContent = m[1] + to + m[3];
          };
          requestAnimationFrame(tick);
        }
      }, [el]);
    });

    /* the impact beat paints when it scrolls in (BeatPainter) */
    var outside = $$('[data-beat]', root).filter(function (el) { return !el.closest('#story'); });
    if (!reduced) outside.forEach(function (el) { el.dataset.armed = 'true'; });
    var pio = observe(S, { threshold: 0.6 }, function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.dataset.painted = 'true'; pio.unobserve(e.target); } });
    }, outside);

    /* "Skip Intro" + 2s auto-play (shared with the About page) */
    if (!$('script[data-intro]')) {
      var s = doc.createElement('script');
      s.src = '/js/ondc/intro.js'; s.dataset.intro = '1';
      doc.body.appendChild(s);
    }

    heroCtl = {
      root: root,
      dispose: function () {
        disposed = true; S.dispose();
        if (map) { try { map.dispose(); } catch (e) { } }
        root.remove();
        $$('.intro-skip').forEach(function (n) { n.remove(); });
        var sc = $('script[data-intro]'); if (sc) sc.remove();
        heroCtl = null;
      }
    };
  }

  /* =====================================================================
     AMBIENT NETWORK behind the light half of the page  (HomeAmbient)
     ===================================================================== */
  function startAmbient(S) {
    var Net = window.HomeNetwork;
    if (!Net || reduced) return;
    var canvas = doc.createElement('canvas');
    canvas.className = 'home-ambient'; canvas.setAttribute('aria-hidden', 'true');
    var tag = $('.tagline-strip');
    if (tag) tag.before(canvas); else doc.body.prepend(canvas);
    var net = Net.create(canvas); net.resize();
    var raf = 0, running = false;
    var frame = function (now) { if (!running) return; net.frame(now); raf = requestAnimationFrame(frame); };
    var setRunning = function (on) {
      if (on === running) return;
      running = on;
      canvas.toggleAttribute('data-on', on);
      if (on) { raf = requestAnimationFrame(frame); return; }
      cancelAnimationFrame(raf); net.clear();
    };
    var sync = function () { setRunning(net.past() && !doc.hidden); };
    S.on(window, 'scroll', sync, { passive: true });
    S.on(doc, 'visibilitychange', sync);
    S.on(window, 'resize', function () { net.resize(); sync(); });
    sync();
    var heads = $$('.metrics-header, .dpi-header, .infra .section-header, .testimonials .section-header, .news .section-header');
    observe(S, { threshold: 0.4 }, function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var r = e.target.getBoundingClientRect();
        net.flareAt(r.left + r.width / 2, r.top + r.height / 2);
      });
    }, heads);
    S.add(function () { cancelAnimationFrame(raf); canvas.remove(); try { net.destroy(); } catch (e) { } });
  }

  /* =====================================================================
     SECTOR CAROUSEL  (HeroCarousel.jsx) — 6s autoplay, pauses on hover/focus
     ===================================================================== */
  function startCarousel(S) {
    var hero = $('.hero');
    if (!hero) return;
    var slides = $$('.slide', hero), pills = $$('.sector-pill', hero);
    var total = slides.length; if (!total) return;
    var cur = Math.max(0, slides.findIndex(function (s) { return s.classList.contains('active'); }));
    var paused = false, timer = null;
    var rail = $('.sector-rail', hero);

    function show(i, fromPill) {
      cur = ((i % total) + total) % total;
      slides.forEach(function (s, k) {
        var on = k === cur;
        s.classList.toggle('active', on);
        if (on) s.removeAttribute('inert'); else s.setAttribute('inert', '');
      });
      pills.forEach(function (p, k) {
        p.classList.toggle('active', k === cur);
        if (k === cur) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current');
      });
      // keep the active pill in view on narrow screens — drive the rail itself, not the page
      var el = pills[cur];
      if (rail && el && rail.scrollWidth > rail.clientWidth) {
        rail.scrollTo({ left: el.offsetLeft - (rail.clientWidth - el.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' });
      }
      restart();
    }
    function restart() {
      clearInterval(timer);
      if (paused || reduced) return;
      timer = setInterval(function () { show(cur + 1); }, 6000);
    }
    slides.forEach(function (s, k) { if (k !== cur) s.setAttribute('inert', ''); });
    S.on(hero, 'mouseenter', function () { paused = true; restart(); });
    S.on(hero, 'mouseleave', function () { paused = false; restart(); });
    S.on(hero, 'focusin', function () { paused = true; restart(); });
    S.on(hero, 'focusout', function () { paused = false; restart(); });
    var prev = $('.hero-arrow.prev', hero), next = $('.hero-arrow.next', hero);
    if (prev) S.on(prev, 'click', function () { show(cur - 1); });
    if (next) S.on(next, 'click', function () { show(cur + 1); });
    pills.forEach(function (p, k) {
      S.on(p, 'click', function () {
        show(k);
        var tall = hero.getBoundingClientRect().height > innerHeight;
        hero.scrollIntoView({ block: tall ? 'end' : 'center', behavior: reduced ? 'auto' : 'smooth' });
      });
    });
    S.add(function () { clearInterval(timer); });
    restart();
  }

  /* =====================================================================
     REVEAL-ON-SCROLL  (.hv-rv children rise when the section enters)
     ===================================================================== */
  function reveal(S, el, threshold, after) {
    if (!el) return;
    if (reduced || !('IntersectionObserver' in window)) { el.classList.add('hv-in'); if (after) after(true); return; }
    var io = observe(S, { threshold: threshold || 0.18 }, function (es) {
      if (!es.some(function (e) { return e.isIntersecting; })) return;
      el.classList.add('hv-in'); io.disconnect();
      var t = setTimeout(function () { el.classList.add('hv-done'); }, 1400);
      S.add(function () { clearTimeout(t); });
      if (after) after(false);
    }, [el]);
  }

  /* metrics band: count-up on a copy that sits OUTSIDE the editable region,
     so the real (editable) number is never touched */
  function countUp(S, metricsEl) {
    $$('.metric-num', metricsEl).forEach(function (num) {
      var m = /^(\D*)(\d+)(.*)$/.exec(num.textContent.trim());
      if (!m) return;
      var metric = num.parentNode, to = parseInt(m[2], 10);
      if (getComputedStyle(metric).position === 'static') metric.style.position = 'relative';
      var ghost = doc.createElement('div');
      ghost.className = num.className.replace(/\bdata-editable\b/, '') + ' metric-num-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.cssText = 'position:absolute;left:' + num.offsetLeft + 'px;top:' + num.offsetTop + 'px;width:' + num.offsetWidth +
        'px;text-align:center;pointer-events:none;margin:0';
      ghost.textContent = m[1] + '0' + m[3];
      metric.classList.add('is-counting');
      num.before(ghost);
      var t0 = performance.now(), raf = 0;
      var tick = function (now) {
        var t = Math.min(1, (now - t0) / 1200);
        ghost.textContent = m[1] + Math.round((1 - Math.pow(1 - t, 3)) * to) + m[3];
        if (t < 1) raf = requestAnimationFrame(tick);
        else { ghost.remove(); metric.classList.remove('is-counting'); }
      };
      raf = requestAnimationFrame(tick);
      S.add(function () { cancelAnimationFrame(raf); ghost.remove(); metric.classList.remove('is-counting'); });
    });
  }

  /* =====================================================================
     BUILDING BLOCKS — pinned deck of cards that slide in from the right
     as you scroll down, and slide back out as you scroll up (DPISection)
     ===================================================================== */
  function startDeck(S) {
    var section = $('.dpi'); if (!section) return;
    var deck = $('.dpi-deck', section);
    var cards = $$('.dpi-card', deck), N = cards.length; if (!N) return;
    var dots = $$('.dpi-dot', section), prevBtn = $('.dpi-arrow.prev', section), nextBtn = $('.dpi-arrow.next', section);
    var flat = matchMedia('(max-width: 820px)');
    var active = 0, prevP = -1, queued = false;
    cards.forEach(function (c, i) { c.style.zIndex = String(i + 1); });

    function setActive(a) {
      active = a;
      cards.forEach(function (c, i) {
        c.classList.toggle('is-behind', i < a);
        c.classList.toggle('is-front', i === a);
      });
      dots.forEach(function (d, i) { d.classList.toggle('active', i === a); });
      if (prevBtn) prevBtn.disabled = a <= 0;
      if (nextBtn) nextBtn.disabled = a >= N - 1;
    }
    function paint() {
      queued = false;
      if (flat.matches) {
        if (prevP !== -1) cards.forEach(function (c) { c.style.transform = ''; });
        prevP = -1; return;
      }
      var rect = section.getBoundingClientRect();
      var travel = rect.height - innerHeight;
      if (travel <= 0) return;
      var p = Math.max(0, Math.min(1, -rect.top / travel));
      if (p === prevP) return; prevP = p;
      var d = p * (N - 1);
      for (var i = 0; i < N; i++) {
        var t = i === 0 ? 1 : Math.max(0, Math.min(1, d - (i - 1)));   // card i slides in across d ∈ [i−1, i]
        var depth = Math.max(0, Math.min(1, d - i));                    // buried cards sink slightly
        cards[i].style.transform = 'translateX(' + ((1 - t) * 106).toFixed(2) + 'vw) scale(' + (1 - 0.04 * depth).toFixed(4) + ')';
      }
      var next = Math.max(0, Math.min(N - 1, Math.round(d)));
      if (next !== active) setActive(next);
    }
    var onScroll = function () { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    function scrollToCard(i) {
      i = Math.max(0, Math.min(N - 1, i));
      var travel = section.offsetHeight - innerHeight; if (travel <= 0) return;
      var top = section.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + (i / (N - 1)) * travel, behavior: reduced ? 'auto' : 'smooth' });
    }
    dots.forEach(function (d, i) { S.on(d, 'click', function () { scrollToCard(i); }); });
    if (prevBtn) S.on(prevBtn, 'click', function () { scrollToCard(active - 1); });
    if (nextBtn) S.on(nextBtn, 'click', function () { scrollToCard(active + 1); });

    /* phone layout: a plain list, tap a card to open it */
    function toggle(c) {
      var o = c.classList.toggle('is-open'); c.setAttribute('aria-expanded', o ? 'true' : 'false');
    }
    cards.forEach(function (c) {
      S.on(c, 'click', function (e) { if (flat.matches && !e.target.closest('a')) toggle(c); });
      S.on(c, 'keydown', function (e) {
        if (flat.matches && (e.key === 'Enter' || e.key === ' ') && e.target === c) { e.preventDefault(); toggle(c); }
      });
    });
    function syncFlat() {
      cards.forEach(function (c) {
        if (flat.matches) { c.setAttribute('role', 'button'); c.tabIndex = 0; c.setAttribute('aria-expanded', c.classList.contains('is-open') ? 'true' : 'false'); }
        else { c.removeAttribute('role'); c.removeAttribute('tabindex'); c.removeAttribute('aria-expanded'); c.classList.remove('is-open'); }
      });
      onScroll();
    }
    setActive(0);
    if (!reduced) {
      S.on(window, 'scroll', onScroll, { passive: true });
      S.on(window, 'resize', onScroll);
      paint();
    }
    flat.addEventListener('change', syncFlat);
    S.add(function () { flat.removeEventListener('change', syncFlat); });
    syncFlat();
  }

  /* =====================================================================
     RAILS — "Find your place" doors + news clippings
     ===================================================================== */
  function glideTo(el, left) {
    var max = el.scrollWidth - el.clientWidth;
    var target = Math.max(0, Math.min(max, left)), from = el.scrollLeft;
    if (Math.abs(target - from) < 1) return;
    if (el._glide) cancelAnimationFrame(el._glide);
    var cleanup = function () { ['wheel', 'touchstart', 'pointerdown'].forEach(function (t) { el.removeEventListener(t, cancel); }); };
    var cancel = function () { cancelAnimationFrame(el._glide); el._glide = 0; cleanup(); };
    ['wheel', 'touchstart', 'pointerdown'].forEach(function (t) { el.addEventListener(t, cancel, { passive: true, once: true }); });
    var t0 = performance.now(), dur = 450;
    var frame = function (now) {
      var p = Math.min(1, (now - t0) / dur);
      el.scrollLeft = from + (target - from) * (1 - Math.pow(1 - p, 3));
      if (p < 1) el._glide = requestAnimationFrame(frame); else { el._glide = 0; cleanup(); }
    };
    el._glide = requestAnimationFrame(frame);
  }
  function stepOf(track, sel) {
    var card = $(sel, track);
    return card ? card.offsetWidth + (parseFloat(getComputedStyle(track).gap) || 0) : 0;
  }

  function startDoors(S) {
    var wrap = $('.doors-wrap'), track = wrap && $('.doors-track', wrap);
    if (!track) return;
    var prev = $('.doors-arrow.prev', wrap), next = $('.doors-arrow.next', wrap);
    var bar = $('.doors-progress-bar'), total = $$('.door-card', track).length || 1;
    function upd() {
      var max = track.scrollWidth - track.clientWidth;
      var p = max > 0 ? track.scrollLeft / max : 0;
      wrap.dataset.end = String(p >= 0.999);
      if (prev) prev.disabled = p <= 0;
      if (next) next.disabled = p >= 0.999;
      if (bar) bar.style.transform = 'scaleX(' + Math.min(1, 1 / total + p * (1 - 1 / total)) + ')';
    }
    if (prev) S.on(prev, 'click', function () { glideTo(track, track.scrollLeft - stepOf(track, '.door-card')); });
    if (next) S.on(next, 'click', function () { glideTo(track, track.scrollLeft + stepOf(track, '.door-card')); });
    S.on(track, 'scroll', upd, { passive: true });
    S.on(window, 'resize', upd);
    upd();
  }

  /* The news cards and the story posters are rendered by the build from the
     page's own data (src/pages/*.njk -> sections), so there is nothing to fetch
     here any more. This file only animates what the HTML already contains. */

  function startNews(S) {
    var wrap = $('.news-rail-wrap'), track = wrap && $('.news-rail', wrap);
    if (!track) return;
    var prev = $('.doors-arrow.prev', wrap), next = $('.doors-arrow.next', wrap);
    function upd() {
      var atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 8;
      var atStart = track.scrollLeft <= 8;
      wrap.dataset.end = String(atEnd);
      if (prev) prev.disabled = atStart;
      if (next) next.disabled = atEnd;
    }
    if (prev) S.on(prev, 'click', function () { glideTo(track, track.scrollLeft - stepOf(track, '.news-card')); });
    if (next) S.on(next, 'click', function () { glideTo(track, track.scrollLeft + stepOf(track, '.news-card')); });
    S.on(track, 'scroll', upd, { passive: true });
    S.on(window, 'resize', upd);
    upd();
    var cards = $$('.news-card', track);
    if (reduced) { cards.forEach(function (c) { c.classList.add('in'); }); return; }
    var io = observe(S, { threshold: 0.12 }, function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, cards);
  }

  /* =====================================================================
     LIVE MODE
     ===================================================================== */
  function startLive() {
    if (page || editorReady) return;
    var S = page = new Scope();

    startCarousel(S);
    reveal(S, $('.infra'), 0.18);
    reveal(S, $('.testimonials'), 0.18);
    var mb = $('.metrics-bar');
    reveal(S, mb, 0.25, function (instant) { if (!instant && mb) countUp(S, mb); });
    startDeck(S);
    startDoors(S);
    startNews(S);
    $$('.block-cards').forEach(function (el) { reveal(S, el, 0.18); });
    if ($('[data-key="hero-story"]')) startAmbient(S);

    /* nav "Sign Up" and any element carrying data-href */
    $$('[data-href]').forEach(function (b) {
      S.on(b, 'click', function () { window.open(b.getAttribute('data-href'), '_blank', 'noopener'); });
    });

    /* deep links: the hero was built after load, so re-apply the hash */
    if (location.hash) {
      var t = doc.getElementById(location.hash.slice(1));
      if (t) t.scrollIntoView({ behavior: 'instant', block: 'start' });
    }

    /* The scroll story only exists on pages that carry a "Hero — scrolling story"
       section. Other pages (About, a new page an editor made) must not grow one. */
    if (!$('[data-key="hero-story"]')) return;

    /* the hero is desktop-only (below 900px the page opens on the carousel) */
    var mq = matchMedia('(max-width: 900px)');
    var syncHero = function () { if (mq.matches) { if (heroCtl) heroCtl.dispose(); } else buildHero(); };
    mq.addEventListener('change', syncHero);
    S.add(function () { mq.removeEventListener('change', syncHero); });
    syncHero();

  }

  /* Decide editor vs live. The CloudCannon visual editor loads this page inside an
     iframe and flags it with window.inEditorMode — but that flag can arrive a moment
     after our script runs. So: if the page is framed by cloudcannon.com we wait for the
     flag before touching anything; only when it never arrives (e.g. CloudCannon's plain
     "preview") do we start the live animations. In editor mode this file changes nothing
     except adding the class html.is-editing. */
  function framedByCloudCannon() {
    try {
      if (window.self === window.top) return false;
      var ao = window.location.ancestorOrigins;
      if (ao && ao.length) return Array.prototype.some.call(ao, function (o) { return /cloudcannon/i.test(o); });
      return /cloudcannon/i.test(doc.referrer || '');
    } catch (e) { return true; }
  }
  function init() {
    if (window.inEditorMode) { enterEditor(); return; }
    if (!framedByCloudCannon()) { startLive(); return; }
    /* Framed by CloudCannon: assume the editor straight away. The flat editing layout
       (all slides shown, hero copy block shown) must be in place BEFORE CloudCannon
       looks for the editable regions, otherwise regions inside hidden slides / the
       hidden hero block are "not found". The class is also set by a tiny inline script
       in <head>; if the editor flag never arrives (plain preview) we undo it. */
    html.classList.add('is-editing');
    var tries = 0;
    (function wait() {
      if (window.inEditorMode) { enterEditor(); return; }
      if (++tries < 20) { setTimeout(wait, 100); return; }
      html.classList.remove('is-editing');
      startLive();
    })();
  }
  // CloudCannon fires this when the visual editor takes over the page
  doc.addEventListener('cloudcannon:load', function () { if (window.inEditorMode) enterEditor(); });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})();
