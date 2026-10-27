/* The homepage hero map — the fourth sibling of the About "Our journey"
 * network (pages/about-us.html), after home-network.js and
 * about-board-network.js. Same recipe, re-cut for the navy hero ground and
 * driven by the hero's own scroll choreography:
 *
 *   - nodes are sampled once from the India outline (coastline resampled at
 *     an even spacing, interior dart-thrown inside the path), seeded so a
 *     resize never reshuffles the constellation;
 *   - edges are built once, two nearest neighbours each, and never rebuilt —
 *     the topology never changes, so nothing flickers;
 *   - growth is ranked outward from Bengaluru (the first order, where the
 *     About map opens too) and bucketed to the four beats of copy, so what
 *     the map is doing at each stage of the scroll is decided, not
 *     proportional;
 *   - one blue for the network, the page's neutral for the country.
 *
 * Deliberately a copy, not a shared module: the three siblings drift in
 * their constants, and one engine with four switches is worse than four
 * short files. Exposes window.OndcHeroMap = { create, setProgress, setDock,
 * impulse } — the last three forward to the live instance (Hero.jsx's
 * choreographers run before the canvas has mounted, so their first values
 * are held and applied at create). */
(function () {
  'use strict';

  var BLUE = '#2151F5';
  var CYAN = '#6E8CFF';
  var TINTS = ['#92a5bf', '#55677f'];          // --text-mid, --text-low
  var HALO = 'rgba(110,140,255,.45)';
  var BEACON = 'rgba(110,140,255,.55)';
  var COAST = 'rgba(237,242,249,';               // --text-hi, alpha appended

  /* Where each beat of copy sits in the act, and how much of the network has
   * lit by the end of it. Beat 1 is one place. Beat 2 is its first
   * connections. Beat 3 is a network. Beat 4 is a country. */
  var BANDS = [0, .15, .35, .55, .85];
  var CUM = [.004, .10, .48, 1];
  var FINALE = .85;

  /* Hubs, in the outline's 1000-unit frame; the sampled node nearest each is
   * promoted. Bengaluru first — it is also the seed. */
  var BLR = [359, 762];
  var CITIES = [
    BLR, [348, 291], [212, 596], [380, 656], [434, 796], [671, 482],
    [241, 616], [307, 345], [512, 398], [306, 895], [399, 534], [762, 361],
  ];

  var desired = { p: 0, dock: 0 };
  var active = null;

  function create(cv, pathD, opts) {
    var reduced = !!(opts && opts.reduced);
    var ctx = cv.getContext('2d');
    var path = new Path2D(pathD);

    /* Seeded so a resize never reshuffles the constellation. */
    var seed = 20220429;
    var rnd = function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    /* ── the outline as rings of points, and its box ── */
    var rings = pathD.split('Z').filter(function (s) { return s.trim(); }).map(function (ring) {
      var pts = [];
      var re = /(-?[\d.]+)[ ,](-?[\d.]+)/g, m;
      while ((m = re.exec(ring))) pts.push([+m[1], +m[2]]);
      return pts;
    }).filter(function (pts) { return pts.length >= 3; });
    var VX = 1e9, VY = 1e9, mx = -1e9, my = -1e9;
    rings.forEach(function (pts) {
      pts.forEach(function (q) {
        if (q[0] < VX) VX = q[0]; if (q[1] < VY) VY = q[1];
        if (q[0] > mx) mx = q[0]; if (q[1] > my) my = q[1];
      });
    });
    var VW = mx - VX, VH = my - VY;

    /* ── sample node positions (once) ── */
    var vx = [], vy = [], size = [], phase = [], tint = [], city = [];
    var MIN_D = 34, CELL = MIN_D, grid = new Map();
    var gkey = function (x, y) { return ((x / CELL) | 0) * 8192 + ((y / CELL) | 0); };
    function farEnough(x, y) {
      var cx = (x / CELL) | 0, cy = (y / CELL) | 0;
      for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) {
        var list = grid.get((cx + a) * 8192 + (cy + b));
        if (!list) continue;
        for (var k = 0; k < list.length; k++) {
          var i = list[k];
          if (Math.hypot(vx[i] - x, vy[i] - y) < MIN_D) return false;
        }
      }
      return true;
    }
    function addNode(x, y, s) {
      var i = vx.length;
      vx.push(x); vy.push(y); size.push(s); phase.push(rnd() * 6.283); city.push(false);
      tint.push(rnd() < .13 ? TINTS[(rnd() * 2) | 0] : null);
      var k = gkey(x, y);
      (grid.get(k) || grid.set(k, []).get(k)).push(i);
    }

    /* Coastline first, resampled at an even spacing so the outline reads.
     * The cumulative length is kept so beat 1 can draw the coast in. */
    var coastLen = 0;
    rings.forEach(function (pts) {
      var closed = pts.concat([pts[0]]);
      var carry = 0;
      for (var i = 1; i < closed.length; i++) {
        var x0 = closed[i - 1][0], y0 = closed[i - 1][1], x1 = closed[i][0], y1 = closed[i][1];
        var seg = Math.hypot(x1 - x0, y1 - y0);
        coastLen += seg;
        var d = MIN_D - carry;
        while (d <= seg) {
          var t = d / seg;
          var x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
          if (farEnough(x, y)) addNode(x, y, 1.2 + rnd() * .5);
          d += MIN_D;
        }
        carry = (carry + seg) % MIN_D;
      }
    });

    /* Interior fill by dart-throwing inside the path. The canvas is sized to
     * cover the whole box first — hit-testing outside the bitmap is not
     * reliable across engines. resize() gives it its real size after. */
    cv.width = 1000; cv.height = 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (var n = 0; n < 30000 && vx.length < 260; n++) {
      var px = VX + rnd() * VW, py = VY + rnd() * VH;
      if (!ctx.isPointInPath(path, px, py) || !farEnough(px, py)) continue;
      addNode(px, py, rnd() < .12 ? 2.6 + rnd() * .6 : 1.35 + rnd() * .85);
    }
    var N = vx.length;

    /* Cities become hubs; the first order becomes the seed and the beacon. */
    function nearest(cx, cy) {
      var best = 0, bd = 1e9;
      for (var i = 0; i < N; i++) {
        var d = Math.hypot(vx[i] - cx, vy[i] - cy);
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    }
    var hubs = [];
    CITIES.forEach(function (c) {
      var i = nearest(c[0], c[1]);
      if (size[i] < 2.6) size[i] = 2.6 + rnd() * .6;
      city[i] = true; hubs.push(i);
    });
    var first = hubs[0];
    size[first] = 3.4; tint[first] = null;

    /* ── growth order: outward from Bengaluru, loosened so it is not a ring ── */
    function rank(i) {
      if (i === first) return -1;
      var h = ((i * 2654435761) % 1000) / 1000;
      return Math.hypot(vx[i] - BLR[0], vy[i] - BLR[1]) * .7 + h * .3 * 760;
    }
    var order = []; for (var q = 0; q < N; q++) order.push(q);
    order.sort(function (a, b) { return rank(a) - rank(b); });
    var th = new Float32Array(N);       // scroll progress at which each node lights
    var al = new Float32Array(N);       // current eased alpha
    var flare = new Float32Array(N);    // 0..1, set by an impact metric
    (function bucket() {
      var from = 0;
      for (var beat = 0; beat < 4; beat++) {
        var to = Math.max(from + 1, Math.round(CUM[beat] * N));
        var a = BANDS[beat], b = BANDS[beat + 1];
        for (var k = from; k < to && k < N; k++)
          th[order[k]] = a + (b - a) * (to > from ? (k - from) / (to - from) : 0);
        from = to;
      }
      th[first] = 0;
    })();

    /* ── edges, built once: topology is scale-invariant in outline space ── */
    var edges = [], incident = [];
    for (var e0 = 0; e0 < N; e0++) incident.push([]);
    (function buildEdges() {
      var MAX_D = MIN_D * 2.3, EC = MAX_D, eg = new Map();
      var k2 = function (x, y) { return ((x / EC) | 0) * 8192 + ((y / EC) | 0); };
      for (var i = 0; i < N; i++) {
        var k = k2(vx[i], vy[i]);
        (eg.get(k) || eg.set(k, []).get(k)).push(i);
      }
      for (var j0 = 0; j0 < N; j0++) {
        var cx = (vx[j0] / EC) | 0, cy = (vy[j0] / EC) | 0, near = [];
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) {
          var list = eg.get((cx + a) * 8192 + (cy + b));
          if (!list) continue;
          for (var m = 0; m < list.length; m++) {
            var j = list[m];
            if (j <= j0) continue;
            var d = Math.hypot(vx[j0] - vx[j], vy[j0] - vy[j]);
            if (d <= MAX_D) near.push([j, d]);
          }
        }
        near.sort(function (p, q) { return p[1] - q[1]; });
        for (var nn = 0; nn < Math.min(2, near.length); nn++) {
          var ed = [j0, near[nn][0], .44 * (1 - near[nn][1] / MAX_D)];
          incident[j0].push(ed); incident[near[nn][0]].push(ed);
          edges.push(ed);
        }
      }
    })();

    /* ── geometry ── */
    var W = 0, H = 0, DPR = 1, scale = 1, mapX = 0, mapY = 0;
    var ns = 1.3, ea = 1.3;                        // node scale / edge alpha
    var p = desired.p, dock = desired.dock;
    function resize() {
      var r = cv.getBoundingClientRect();
      W = r.width; H = r.height;
      DPR = Math.min(devicePixelRatio || 1, 1.75);
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      if (reduced) { al.fill(1); draw(1, 0, 0); }
    }
    /* The impact act docks the formed map left at 60%; both are read here
     * per frame so the tween is the choreographer's scrub, reversible. */
    function frameFit() {
      var box = Math.min(H * .78, W * .52 / (VW / VH)) * (1 - .4 * dock);
      scale = box / VH;
      mapX = (W - VW * scale) / 2 - .22 * W * dock;
      mapY = (H - box) / 2;
    }

    /* ── render ── */
    var pulses = [];
    var rateBoost = 0, shimmer = 0;
    function draw(p, time, dt) {
      frameFit();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var wob = function (t) { return Math.sin(time * 1.57 + t) * 1.1; };
      var X = function (i) { return mapX + (vx[i] - VX) * scale + wob(phase[i]); };
      var Y = function (i) { return mapY + (vy[i] - VY) * scale + wob(phase[i] * 1.7); };
      var finale = p >= FINALE;

      // the coast, always faintly there — the country before the network is
      // a neutral hairline; only the network itself takes the blue. Under the
      // first beat it draws itself in, so the act opens on a place being
      // outlined rather than on a map that was simply there.
      ctx.save();
      ctx.translate(mapX, mapY); ctx.scale(scale, scale); ctx.translate(-VX, -VY);
      ctx.lineWidth = 1 / scale;
      ctx.strokeStyle = COAST + (.10 + .06 * p).toFixed(3) + ')';
      var f = p / BANDS[1];
      if (f >= 1) ctx.stroke(path);
      else {
        f = 1 - (1 - f) * (1 - f);
        var budget = coastLen * f;
        ctx.beginPath();
        for (var r0 = 0; r0 < rings.length && budget > 0; r0++) {
          var pts = rings[r0], closed = pts.concat([pts[0]]);
          ctx.moveTo(closed[0][0], closed[0][1]);
          for (var i0 = 1; i0 < closed.length; i0++) {
            var seg = Math.hypot(closed[i0][0] - closed[i0 - 1][0], closed[i0][1] - closed[i0 - 1][1]);
            if (seg <= budget) { ctx.lineTo(closed[i0][0], closed[i0][1]); budget -= seg; }
            else {
              var t = budget / seg;
              ctx.lineTo(closed[i0 - 1][0] + (closed[i0][0] - closed[i0 - 1][0]) * t,
                         closed[i0 - 1][1] + (closed[i0][1] - closed[i0 - 1][1]) * t);
              budget = 0; break;
            }
          }
        }
        ctx.stroke();
      }
      ctx.restore();

      ctx.lineWidth = 1; ctx.strokeStyle = BLUE;
      for (var e = 0; e < edges.length; e++) {
        var a = edges[e][0], b = edges[e][1];
        var v = edges[e][2] * ea * Math.min(al[a], al[b]);
        if (v <= .012) continue;
        ctx.globalAlpha = v;
        ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
      }

      for (var i = 0; i < N; i++) {
        if (al[i] <= .02) continue;
        var fl = flare[i], s = (size[i] + fl * 2.2) * 1.4 * ns;
        var lift = tint[i] ? shimmer * .4 : 0;
        ctx.globalAlpha = Math.min(1, al[i] + fl * .5 + lift);
        ctx.fillStyle = fl > .05 ? CYAN : (tint[i] || CYAN);
        ctx.fillRect(X(i) - s / 2, Y(i) - s / 2, s, s);
      }

      // Glow rides the hubs only — the field would turn to fog otherwise. A
      // second, larger, flat arc: no shadow, no gradient.
      for (var h = 0; h < N; h++) {
        var fh = flare[h];
        if ((size[h] < 2.2 || al[h] < .7) && fh < .05) continue;
        ctx.globalAlpha = Math.min(.45, (.18 * al[h] + fh * .3) * (finale ? 1.5 : 1));
        ctx.fillStyle = HALO;
        ctx.beginPath(); ctx.arc(X(h), Y(h), (size[h] + fh * 3) * 5 * ns, 0, 6.283); ctx.fill();
      }

      // The first order gets its own beacon, so the act opens on a place
      // rather than on a stray dot.
      if (al[first] > .02) {
        var fx = X(first), fy = Y(first);
        var ringsB = [[38 * ns, .08], [19 * ns, .16]];
        for (var rb = 0; rb < 2; rb++) {
          ctx.globalAlpha = ringsB[rb][1] * al[first];
          ctx.fillStyle = BEACON;
          ctx.beginPath(); ctx.arc(fx, fy, ringsB[rb][0], 0, 6.283); ctx.fill();
        }
      }

      var rate = (.5 + p * 1.8 + (finale ? 2.4 : 0)) * (1 + 2 * rateBoost);
      if (!reduced && pulses.length < 26 && Math.random() < dt * 2.2 * rate) {
        var pe = edges[(Math.random() * edges.length) | 0];
        if (Math.min(al[pe[0]], al[pe[1]]) > .55) pulses.push({ e: pe, t: 0, v: .8 + Math.random() * .8 });
      }
      ctx.fillStyle = CYAN;
      for (var k = pulses.length - 1; k >= 0; k--) {
        var u = pulses[k];
        u.t += dt * u.v;
        if (u.t >= 1) { pulses.splice(k, 1); continue; }
        var ua = u.e[0], ub = u.e[1];
        ctx.globalAlpha = Math.sin(u.t * Math.PI) * .9;
        ctx.beginPath();
        ctx.arc(X(ua) + (X(ub) - X(ua)) * u.t, Y(ua) + (Y(ub) - Y(ua)) * u.t, 2.4, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* ── loop ── */
    var running = false, last = 0;
    function frame(now) {
      if (!running) return;
      var dt = Math.min(.05, (now - last) / 1000); last = now;
      var ease = Math.min(1, dt * 3.2);
      for (var i = 0; i < N; i++) {
        al[i] += ((p >= th[i] ? 1 : 0) - al[i]) * ease;
        if (flare[i] > 0) flare[i] = Math.max(0, flare[i] - dt * .55);
      }
      if (rateBoost > 0) rateBoost = Math.max(0, rateBoost - dt / 2);
      if (shimmer > 0) shimmer = Math.max(0, shimmer - dt / 1.5);
      draw(p, now / 1000, dt);
      requestAnimationFrame(frame);
    }

    /* Lighting a node the way a milestone does on the About page: it swells,
     * and every edge it touches sends a pulse outward. */
    function flareNode(i) {
      flare[i] = 1;
      var inc = incident[i];
      for (var k = 0; k < inc.length && pulses.length < 26; k++)
        pulses.push({ e: inc[k], t: 0, v: 1.1 });
    }

    var inst = {
      setProgress: function (v) { p = v; },
      setDock: function (t) { dock = t; if (reduced) draw(1, 0, 0); },
      setVisible: function (on) {
        if (reduced) return;
        if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
        else if (!on) running = false;
      },
      impulse: function (kind) {
        if (reduced) return;
        if (kind === 'participant-flare') {
          var lit = hubs.filter(function (i) { return al[i] > .5; });
          for (var k = 0; k < 8 && lit.length; k++) flareNode(lit.splice((Math.random() * lit.length) | 0, 1)[0]);
        } else if (kind === 'city-glints') {
          hubs.forEach(function (i) { if (al[i] > .5) flareNode(i); });
        } else if (kind === 'pulse-accelerate') rateBoost = 1;
        else if (kind === 'seller-shimmer') shimmer = 1;
      },
      resize: resize,
      dispose: function () {
        running = false;
        removeEventListener('resize', resize);
        if (active === inst) active = null;
      },
    };

    resize();
    addEventListener('resize', resize);
    active = inst;
    return inst;
  }

  window.OndcHeroMap = {
    create: create,
    setProgress: function (p) { desired.p = p; if (active) active.setProgress(p); },
    setDock: function (t) { desired.dock = t; if (active) active.setDock(t); },
    impulse: function (kind) { if (active) active.impulse(kind); },
  };
})();
