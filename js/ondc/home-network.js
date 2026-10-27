/* ── The expanding node field ─────────────────────────────────────────────
 * The About Us journey map (pages/about-us.html:1222-1536) re-cut as a
 * full-viewport background for the homepage: the same constellation —
 * seeded blue-noise nodes, square blue marks, two-nearest-neighbour edges,
 * idle wobble, travelling pulses — but scattered across a flat field
 * instead of sampled inside the India outline.
 *
 * The motion it inherits is not a wipe, it is growth from a place. About Us
 * expands outward from Bengaluru; this expands outward from a seed at the
 * top of the field — where the hero's India map has just dissolved — so the
 * network reads as a continuation of the hero rather than a new decoration.
 * A downward term in the growth rank keeps the journey descending with the
 * reader; a per-node hash keeps the front organic instead of a clean ring.
 *
 * Pure scroll scrub: a node's alpha follows whether page progress has passed
 * its threshold, so scrolling back up retracts the network exactly the way
 * it grew. Canvas 2D only, no libraries — like the rest of this codebase.
 *
 * The About Us engine is deliberately left alone. This is a copy of its
 * core, not a refactor of it: two ~250-line siblings beat one shared
 * abstraction threaded back through a page that already works.
 * ---------------------------------------------------------------------- */
(function () {
  "use strict";

  var BLUE = "#2151F5";
  var TINTS = ["#c9ced4", "#8a8f95"];

  function create(canvas) {
    var ctx = canvas.getContext("2d");
    var mobile = innerWidth < 860;

    /* The field is sized off the boot viewport with headroom, then
     * "cover"-scaled on every resize — so a resize rescales the
     * constellation instead of reshuffling it. */
    var FW = Math.max(900, innerWidth * 1.15);
    var FH = Math.max(700, innerHeight * 1.15);

    /* Denser on mobile than desktop is backwards: the field has a 900x700
     * floor, so a 375px phone was allocating a node count close to a laptop's
     * and repainting all of it every frame on a fraction of the GPU.
     * ponytail: if profiling still shows jank, hide the canvas outright under
     * 480px rather than thinning it further. */
    var AREA_PER = mobile ? 4200 : 2100;          // field area per node, px2
    var N_MAX = Math.min(1500, Math.round((FW * FH) / AREA_PER));
    var MIN_D = 0.95 * Math.sqrt(AREA_PER);       // blue-noise spacing
    var MAX_D = MIN_D * 2.6;                      // edge cull distance

    /* The seed: dead centre. The field is cover-scaled and centred, so field
     * centre is always viewport centre — the single point the reader sees
     * arrive once the sector carousel is behind them. */
    var SX = FW * .5, SY = FH * .5;

    /* Seeded, so nothing about the field is luck. */
    var seed = 20220429;
    var rnd = function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    /* Copy runs down a centre column over this canvas. Thinning the field
     * there is what makes the constellation frame the content instead of
     * sitting under it — the alternative is lifting opacity everywhere,
     * which costs legibility for the same amount of life. */
    var COL_HALF = Math.min(600, FW * .30);
    function columnAccept(x) {
      var d = Math.abs(x - FW * .5);
      if (d >= COL_HALF) return 1;
      var u = d / COL_HALF, s = u * u * (3 - 2 * u);   // smoothstep
      return .45 + .55 * s;
    }

    /* ── nodes: dart-throwing with hash-grid rejection ── */
    var vx = [], vy = [], size = [], phase = [], tint = [];
    var CELL = MIN_D, grid = new Map();
    var gkey = function (x, y) { return ((x / CELL) | 0) * 8192 + ((y / CELL) | 0); };

    function farEnough(x, y) {
      var cx = (x / CELL) | 0, cy = (y / CELL) | 0;
      for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) {
        var list = grid.get((cx + a) * 8192 + (cy + b));
        if (!list) continue;
        for (var n = 0; n < list.length; n++) {
          var i = list[n];
          if (Math.hypot(vx[i] - x, vy[i] - y) < MIN_D) return false;
        }
      }
      return true;
    }

    for (var n = 0; n < 60000 && vx.length < N_MAX; n++) {
      var x = rnd() * FW, y = rnd() * FH;
      if (rnd() > columnAccept(x)) continue;
      if (!farEnough(x, y)) continue;
      var i = vx.length;
      vx.push(x); vy.push(y);
      size.push(rnd() < .12 ? 2.6 + rnd() * .6 : 1.35 + rnd() * .85);
      phase.push(rnd() * 6.283);
      tint.push(rnd() < .13 ? TINTS[(rnd() * 2) | 0] : null);
      var k = gkey(x, y);
      (grid.get(k) || grid.set(k, []).get(k)).push(i);
    }

    var N = vx.length;
    var th = new Float32Array(N);       // scroll progress at which each node lights
    var al = new Float32Array(N);       // current eased alpha
    var flare = new Float32Array(N);    // 0..1, set when a section header arrives

    /* The node nearest the seed is the brightest one, and the one the whole
     * field grows out of — so the composition opens on a place. */
    var first = 0;
    (function () {
      var bd = Infinity;
      for (var q = 0; q < N; q++) {
        var d = Math.hypot(vx[q] - SX, vy[q] - SY);
        if (d < bd) { bd = d; first = q; }
      }
      if (N) { size[first] = 3.4; tint[first] = null; }
    })();

    /* ── growth order: radial from the seed, with a slight downward lean so
     * the journey still descends with the reader, loosened by a per-node hash
     * so the front never reads as a ring or a ruled line. The radial term
     * dominates deliberately — the point is that the field blooms out of one
     * place, and a heavier vy weight would grow it upward first, then down. ── */
    function rank(i) {
      if (i === first) return -1;
      var h = ((i * 2654435761) % 1000) / 1000;
      return Math.hypot(vx[i] - SX, vy[i] - SY) * .72 + vy[i] * .10 + h * .18 * FH;
    }
    var order = [];
    for (var q2 = 0; q2 < N; q2++) order.push(q2);
    order.sort(function (a, b) { return rank(a) - rank(b); });

    /* The seed alone at p = 0 — rank() returns -1 for it, so it is order[0] —
     * and it holds by itself through HOLD before anything grows out of it.
     * That pause is what makes the origin read as a single point rather than
     * as the first frame of a swarm. */
    var HOLD = .04;
    th[order[0]] = 0;
    for (var kk = 1; kk < N; kk++)
      th[order[kk]] = HOLD + ((kk - 1) / Math.max(1, N - 2)) * (1 - HOLD);

    /* ── edges, built once: two nearest neighbours within MAX_D ── */
    var edges = [];
    (function buildEdges() {
      var EC = MAX_D, eg = new Map();
      var k2 = function (x, y) { return ((x / EC) | 0) * 8192 + ((y / EC) | 0); };
      for (var i = 0; i < N; i++) {
        var k = k2(vx[i], vy[i]);
        (eg.get(k) || eg.set(k, []).get(k)).push(i);
      }
      for (var i2 = 0; i2 < N; i2++) {
        var cx = (vx[i2] / EC) | 0, cy = (vy[i2] / EC) | 0, near = [];
        for (var a = -1; a <= 1; a++) for (var b = -1; b <= 1; b++) {
          var list = eg.get((cx + a) * 8192 + (cy + b));
          if (!list) continue;
          for (var m = 0; m < list.length; m++) {
            var j = list[m];
            if (j <= i2) continue;
            var d = Math.hypot(vx[i2] - vx[j], vy[i2] - vy[j]);
            if (d <= MAX_D) near.push([j, d]);
          }
        }
        near.sort(function (p, r) { return p[1] - r[1]; });
        for (var e = 0; e < Math.min(2, near.length); e++)
          edges.push([i2, near[e][0], .44 * (1 - near[e][1] / MAX_D)]);
      }
    })();

    /* ── geometry ── */
    var W = 0, H = 0, DPR = 1, scale = 1, offX = 0, offY = 0;
    var anchorBottom = 0, span = 1;
    var ns = mobile ? 1.5 : 1.3;   // node scale, lifted on small screens
    var ea = mobile ? 1.35 : 1.3;  // edge alpha

    /* Where the run starts and ends: the last pixel of the sector carousel —
     * the homepage's stand-in for the category pages, which the reader must
     * be past before any of this exists — and the foot of the document.
     * Re-read whenever the page changes height. */
    function measure() {
      var anchor = document.querySelector("#site-top") ||
        document.querySelector(".hero") ||
        document.querySelector(".ondc-hero");
      var docH = document.documentElement.scrollHeight;
      anchorBottom = anchor ? anchor.getBoundingClientRect().bottom + scrollY : innerHeight;
      span = Math.max(1, docH - anchorBottom);
    }

    function resize() {
      W = innerWidth; H = innerHeight;
      DPR = Math.min(devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      scale = Math.max(W / FW, H / FH);
      offX = (W - FW * scale) / 2;
      offY = (H - FH * scale) / 2;
      measure();
    }

    /* 0 the moment the carousel clears the bottom of the viewport, 1 at the
     * foot of the document. */
    function progress() {
      return Math.min(1, Math.max(0, (scrollY + H - anchorBottom) / span));
    }

    /* Has the reader passed the carousel? The component gates the whole layer
     * on this, so the trigger is measured in exactly one place. */
    function past() {
      return scrollY + H >= anchorBottom;
    }

    var bodyRo = null;
    if (typeof ResizeObserver === "function") {
      bodyRo = new ResizeObserver(measure);
      bodyRo.observe(document.body);
    }

    /* ── render ── */
    var pulses = [];
    var BUCKETS = 8, BW = .075;   // edge alphas top out at .44 * 1.35
    var bucket = [];
    for (var b0 = 0; b0 < BUCKETS; b0++) bucket.push([]);

    function draw(p, time, dt) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      var finale = p > .92;
      var wob = function (t) { return Math.sin(time * 1.57 + t) * 1.1; };
      var X = function (i) { return offX + vx[i] * scale + wob(phase[i]); };
      var Y = function (i) { return offY + vy[i] * scale + wob(phase[i] * 1.7); };

      /* Edges batched by quantised alpha — one stroke per band instead of
       * one per edge, which is what keeps a full-viewport repaint cheap. */
      for (var b = 0; b < BUCKETS; b++) bucket[b].length = 0;
      for (var e = 0; e < edges.length; e++) {
        var ea0 = edges[e][0], eb0 = edges[e][1];
        var v = edges[e][2] * ea * Math.min(al[ea0], al[eb0]);
        if (v <= .012) continue;
        bucket[Math.min(BUCKETS - 1, (v / BW) | 0)].push(e);
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = BLUE;
      for (var b2 = 0; b2 < BUCKETS; b2++) {
        var list = bucket[b2];
        if (!list.length) continue;
        ctx.globalAlpha = (b2 + .5) * BW;
        ctx.beginPath();
        for (var c = 0; c < list.length; c++) {
          var ed = edges[list[c]];
          ctx.moveTo(X(ed[0]), Y(ed[0]));
          ctx.lineTo(X(ed[1]), Y(ed[1]));
        }
        ctx.stroke();
      }

      for (var i = 0; i < N; i++) {
        if (al[i] <= .02) continue;
        var f = flare[i], s = (size[i] + f * 2.2) * 1.4 * ns;
        ctx.globalAlpha = Math.min(1, al[i] + f * .5);
        ctx.fillStyle = f > .05 ? BLUE : (tint[i] || BLUE);
        ctx.fillRect(X(i) - s / 2, Y(i) - s / 2, s, s);
      }

      /* Glow rides the hubs only — the field would turn to fog otherwise. */
      ctx.fillStyle = "rgba(33,81,245,.45)";
      for (var g = 0; g < N; g++) {
        var gf = flare[g];
        if ((size[g] < 2.2 || al[g] < .7) && gf < .05) continue;
        ctx.globalAlpha = Math.min(.45, (.18 * al[g] + gf * .3) * (finale ? 1.5 : 1));
        ctx.beginPath();
        ctx.arc(X(g), Y(g), (size[g] + gf * 3) * 5 * ns, 0, 6.283);
        ctx.fill();
      }

      /* The seed gets its own beacon, so the field opens on a place rather
       * than on a stray dot. */
      if (N && al[first] > .02) {
        var bx = X(first), by = Y(first);
        var rings = [[38 * ns, .08], [19 * ns, .16]];
        ctx.fillStyle = "rgba(33,81,245,.55)";
        for (var rr = 0; rr < rings.length; rr++) {
          ctx.globalAlpha = rings[rr][1] * al[first];
          ctx.beginPath();
          ctx.arc(bx, by, rings[rr][0], 0, 6.283);
          ctx.fill();
        }
      }

      var rate = .5 + p * 1.8 + (finale ? 2.4 : 0);
      if (pulses.length < 26 && Math.random() < dt * 2.2 * rate) {
        var pe = edges[(Math.random() * edges.length) | 0];
        if (pe && Math.min(al[pe[0]], al[pe[1]]) > .55)
          pulses.push({ e: pe, t: 0, v: .8 + Math.random() * .8 });
      }
      ctx.fillStyle = BLUE;
      for (var u = pulses.length - 1; u >= 0; u--) {
        var pu = pulses[u];
        pu.t += dt * pu.v;
        if (pu.t >= 1) { pulses.splice(u, 1); continue; }
        var pa = pu.e[0], pb = pu.e[1];
        ctx.globalAlpha = Math.sin(pu.t * Math.PI) * .9;
        ctx.beginPath();
        ctx.arc(X(pa) + (X(pb) - X(pa)) * pu.t, Y(pa) + (Y(pb) - Y(pa)) * pu.t, 2.4, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    /* ── one frame: scrub the alphas to the scroll position, then draw ── */
    var last = 0;
    function frame(now) {
      var dt = Math.min(.05, (now - last) / 1000);
      last = now;
      var p = progress();
      var ease = Math.min(1, dt * 3.2);
      for (var i = 0; i < N; i++) {
        al[i] += ((p >= th[i] ? 1 : 0) - al[i]) * ease;
        if (flare[i] > 0) flare[i] = Math.max(0, flare[i] - dt * .55);
      }
      draw(p, now / 1000, dt);
    }

    /* A section header arriving flares the lit node nearest it and pushes
     * pulses out along that node's edges — the About Us milestone gesture,
     * retargeted to wherever on screen the reader actually is. */
    function flareAt(cx, cy) {
      if (!N) return;
      var fx = (cx - offX) / scale, fy = (cy - offY) / scale;
      var best = -1, bd = Infinity;
      for (var i = 0; i < N; i++) {
        if (al[i] < .55) continue;
        var dx = vx[i] - fx, dy = vy[i] - fy, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) return;
      flare[best] = 1;
      for (var e = 0; e < edges.length; e++) {
        if ((edges[e][0] === best || edges[e][1] === best) && pulses.length < 26)
          pulses.push({ e: edges[e], t: 0, v: 1.1 });
      }
    }

    function clear() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function destroy() {
      if (bodyRo) bodyRo.disconnect();
    }

    return {
      resize: resize, measure: measure, frame: frame, past: past,
      flareAt: flareAt, clear: clear, destroy: destroy
    };
  }

  window.HomeNetwork = { create: create };
})();
