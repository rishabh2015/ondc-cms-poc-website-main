/* Our journey. Canvas network that spreads across an India outline as the
   timeline scrolls. Ships with the `timeline` section component. */
    /* ── OUR JOURNEY: the living network ───────────────────────────────────
     * Nodes are sampled inside the India outline in #jnIndia (viewBox units),
     * then ordered by distance from Bengaluru — where the first order was
     * delivered — so the network lights up spreading outward from that point
     * as the reader scrolls the years. Beckn recolor: a single blue carries
     * the whole network on the light dotted canvas; the coast is a neutral
     * ink hairline. Canvas 2D only, no libraries.
     * ------------------------------------------------------------------- */
    (function () {
      const sec = document.getElementById('our-journey');
      const cv = document.getElementById('jnCanvas');
      const pathEl = document.getElementById('jnIndia');
      if (!sec || !cv || !pathEl) return;
      const ctx = cv.getContext('2d');
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

      const BLUE = '#2151F5';
      const TINTS = ['#c9ced4', '#8a8f95'];

      /* Bounding box of the outline, and the point the story starts from. */
      const VX = 91.4, VY = 20, VW = 825.7, VH = 935.1;
      const BLR_X = 359, BLR_Y = 762;                 // Bengaluru, in viewBox units
      const path = new Path2D(pathEl.getAttribute('d'));

      /* Seeded so a resize never reshuffles the constellation. */
      let seed = 20220429;
      const rnd = () => {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };

      /* ── sample node positions (once) ── */
      const vx = [], vy = [], size = [], phase = [], tint = [];
      const MIN_D = 36, CELL = MIN_D, grid = new Map();
      const gkey = (x, y) => ((x / CELL) | 0) * 8192 + ((y / CELL) | 0);
      function farEnough(x, y) {
        const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
          const list = grid.get((cx + a) * 8192 + (cy + b));
          if (!list) continue;
          for (const i of list) if (Math.hypot(vx[i] - x, vy[i] - y) < MIN_D) return false;
        }
        return true;
      }
      function addNode(x, y, s) {
        const i = vx.length;
        vx.push(x); vy.push(y); size.push(s); phase.push(rnd() * 6.283);
        tint.push(rnd() < .13 ? TINTS[(rnd() * 2) | 0] : null);
        const k = gkey(x, y);
        (grid.get(k) || grid.set(k, []).get(k)).push(i);
      }

      /* Coastline first, resampled at an even spacing so the outline reads. */
      (function coastline() {
        const rings = pathEl.getAttribute('d').split('Z').filter(s => s.trim());
        for (const ring of rings) {
          const pts = [...ring.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m => [+m[1], +m[2]]);
          if (pts.length < 3) continue;
          pts.push(pts[0]);
          let carry = 0;
          for (let i = 1; i < pts.length; i++) {
            const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
            const seg = Math.hypot(x1 - x0, y1 - y0);
            let d = MIN_D - carry;
            while (d <= seg) {
              const t = d / seg, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
              if (farEnough(x, y)) addNode(x, y, 1.2 + rnd() * .5);
              d += MIN_D;
            }
            carry = (carry + seg) % MIN_D;
          }
        }
      })();

      /* Interior fill by dart-throwing inside the path. The canvas is sized to
         cover the whole viewBox first — hit-testing outside the bitmap is not
         reliable across engines. resize() gives it its real size after. */
      cv.width = 1000; cv.height = 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      for (let n = 0; n < 22000 && vx.length < 620; n++) {
        const x = VX + rnd() * VW, y = VY + rnd() * VH;
        if (!ctx.isPointInPath(path, x, y) || !farEnough(x, y)) continue;
        addNode(x, y, rnd() < .12 ? 2.6 + rnd() * .6 : 1.35 + rnd() * .85);
      }

      const N = vx.length;
      /* The first order is a node of its own, and the brightest one. */
      const first = (function () {
        let best = 0, bd = 1e9;
        for (let i = 0; i < N; i++) {
          const d = Math.hypot(vx[i] - BLR_X, vy[i] - BLR_Y);
          if (d < bd) { bd = d; best = i; }
        }
        size[best] = 3.4; tint[best] = null;
        return best;
      })();

      /* ── growth order: outward from Bengaluru, loosened so it is not a ring ── */
      const order = [...Array(N).keys()].sort((a, b) => rank(a) - rank(b));
      function rank(i) {
        if (i === first) return -1;
        const h = ((i * 2654435761) % 1000) / 1000;
        return Math.hypot(vx[i] - BLR_X, vy[i] - BLR_Y) * .7 + h * .3 * 760;
      }
      const th = new Float32Array(N);       // scroll progress at which each node lights
      const al = new Float32Array(N);       // current eased alpha
      const flare = new Float32Array(N);    // 0..1, set when a milestone scrolls in

      /* ── edges, built once: topology is scale-invariant in viewBox space ── */
      const edges = [];
      (function buildEdges() {
        const MAX_D = 82, EC = MAX_D, eg = new Map();
        const k2 = (x, y) => ((x / EC) | 0) * 8192 + ((y / EC) | 0);
        for (let i = 0; i < N; i++) {
          const k = k2(vx[i], vy[i]);
          (eg.get(k) || eg.set(k, []).get(k)).push(i);
        }
        for (let i = 0; i < N; i++) {
          const cx = (vx[i] / EC) | 0, cy = (vy[i] / EC) | 0, near = [];
          for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
            const list = eg.get((cx + a) * 8192 + (cy + b));
            if (list) for (const j of list) {
              if (j <= i) continue;
              const d = Math.hypot(vx[i] - vx[j], vy[i] - vy[j]);
              if (d <= MAX_D) near.push([j, d]);
            }
          }
          near.sort((p, q) => p[1] - q[1]);
          for (let n = 0; n < Math.min(2, near.length); n++)
            edges.push([i, near[n][0], .44 * (1 - near[n][1] / MAX_D)]);
        }
      })();

      /* ── milestone rows drive flares on the nodes they belong to ── */
      const cards = [...sec.querySelectorAll('.bk-tl-entry, .bk-tl-beat')];
      const cardNode = cards.map((_, k) =>
        order[Math.min(N - 1, Math.round((k + .6) / cards.length * (N - 1)))]);

      /* ── geometry ── */
      const years = [...sec.querySelectorAll('.bk-tl-year')];
      const finaleEl = sec.querySelector('.bk-tl-finale');

      /* The blue spine is drawn in as the reader descends: the line reaches a
       * row at the moment that row passes 62% of the viewport, the same place
       * the kit's mechanism spine fills to. Written as a scale factor, so the
       * hairline never changes size and nothing reflows. */
      const spine = sec.querySelector('.bk-tl-years');
      function spineTick() {
        if (!spine) return;
        const r = spine.getBoundingClientRect();
        if (r.height <= 0) return;
        const v = Math.max(0, Math.min(1, (innerHeight * .62 - r.top) / r.height));
        spine.style.setProperty('--tl-fill', v.toFixed(4));
      }
      const CUM = [.06, .22, .45, .63, .82, 1];
      let W = 0, H = 0, DPR = 1, scale = 1, mapX = 0, mapY = 0, bands = [];

      function measure() {
        const r = sec.getBoundingClientRect(), vh = innerHeight;
        const span = Math.max(1, r.height - vh);
        const at = el => Math.min(1, Math.max(0,
          (el.getBoundingClientRect().top - r.top - vh * .58) / span));
        bands = years.map(at); bands.push(finaleEl ? at(finaleEl) : 1);
        let from = 0;
        for (let y = 0; y < 6; y++) {
          const to = Math.round(CUM[y] * N);
          const a = bands[y], b = bands[y + 1];
          for (let k = from; k < to; k++)
            th[order[k]] = a + (b - a) * (to > from ? (k - from) / (to - from) : 0);
          from = to;
        }
        th[first] = 0;
      }

      function resize() {
        const r = cv.getBoundingClientRect();
        W = r.width; H = r.height;
        DPR = Math.min(devicePixelRatio || 1, 1.75);
        ns = W < 860 ? 1.5 : 1.3; ea = W < 860 ? 1.35 : 1.3;
        cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
        const box = W < 860 ? Math.min(H * .64, W * .94 / (VW / VH)) : Math.min(H * .76, W * .48 / (VW / VH));
        scale = box / VH;
        /* Desktop: right-anchor the map beside the timeline column; mobile: centre it behind. */
        mapX = W < 860 ? (W - VW * scale) / 2 : W - VW * scale - W * .05;
        mapY = (H - box) / 2 + (W < 860 ? 0 : 28);
        measure();
        if (reduced) { al.fill(1); draw(1, 0, 0); }
      }

      /* ── render ── */
      const pulses = [];
      let ns = 1, ea = 1;   // node scale / edge alpha, lifted on small screens
      function draw(p, time, dt) {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.clearRect(0, 0, W, H);
        const wob = t => Math.sin(time * 1.57 + t) * 1.1;
        const X = i => mapX + (vx[i] - VX) * scale + wob(phase[i]);
        const Y = i => mapY + (vy[i] - VY) * scale + wob(phase[i] * 1.7);

        // the coast, always faintly there — the country before the network is
        // a neutral ink hairline; only the network itself takes the blue
        ctx.save();
        ctx.translate(mapX, mapY); ctx.scale(scale, scale); ctx.translate(-VX, -VY);
        ctx.lineWidth = 1 / scale;
        ctx.strokeStyle = 'rgba(27,27,27,' + (.12 + .06 * p).toFixed(3) + ')';
        ctx.stroke(path);
        ctx.restore();

        ctx.lineWidth = 1; ctx.strokeStyle = BLUE;
        for (let e = 0; e < edges.length; e++) {
          const a = edges[e][0], b = edges[e][1];
          const v = edges[e][2] * ea * Math.min(al[a], al[b]);
          if (v <= .012) continue;
          ctx.globalAlpha = v;
          ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
        }

        for (let i = 0; i < N; i++) {
          if (al[i] <= .02) continue;
          const f = flare[i], s = (size[i] + f * 2.2) * 1.4 * ns;
          ctx.globalAlpha = Math.min(1, al[i] + f * .5);
          ctx.fillStyle = f > .05 ? BLUE : (tint[i] || BLUE);
          ctx.fillRect(X(i) - s / 2, Y(i) - s / 2, s, s);
        }

        for (let i = 0; i < N; i++) {
          const f = flare[i];
          if ((size[i] < 2.2 || al[i] < .7) && f < .05) continue;
          ctx.globalAlpha = Math.min(.45, (.18 * al[i] + f * .3) * (p > bands[6] ? 1.5 : 1));
          ctx.fillStyle = 'rgba(33,81,245,.45)';
          ctx.beginPath(); ctx.arc(X(i), Y(i), (size[i] + f * 3) * 5 * ns, 0, 6.283); ctx.fill();
        }

        // The first order gets its own beacon, so the section opens on a place
        // rather than on a stray dot.
        if (al[first] > .02) {
          const fx = X(first), fy = Y(first);
          for (const [r, a] of [[38 * ns, .08], [19 * ns, .16]]) {
            ctx.globalAlpha = a * al[first];
            ctx.fillStyle = 'rgba(33,81,245,.55)';
            ctx.beginPath(); ctx.arc(fx, fy, r, 0, 6.283); ctx.fill();
          }
        }

        const rate = .5 + p * 1.8 + (p > bands[6] ? 2.4 : 0);
        if (!reduced && pulses.length < 26 && Math.random() < dt * 2.2 * rate) {
          const e = edges[(Math.random() * edges.length) | 0];
          if (Math.min(al[e[0]], al[e[1]]) > .55) pulses.push({ e, t: 0, v: .8 + Math.random() * .8 });
        }
        ctx.fillStyle = BLUE;
        for (let k = pulses.length - 1; k >= 0; k--) {
          const u = pulses[k];
          u.t += dt * u.v;
          if (u.t >= 1) { pulses.splice(k, 1); continue; }
          const a = u.e[0], b = u.e[1];
          ctx.globalAlpha = Math.sin(u.t * Math.PI) * .9;
          ctx.beginPath();
          ctx.arc(X(a) + (X(b) - X(a)) * u.t, Y(a) + (Y(b) - Y(a)) * u.t, 2.4, 0, 6.283);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      /* ── loop ── */
      let running = false, last = 0;
      function frame(now) {
        if (!running) return;
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        const r = sec.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
        const e = Math.min(1, dt * 3.2);
        for (let i = 0; i < N; i++) {
          al[i] += ((p >= th[i] ? 1 : 0) - al[i]) * e;
          if (flare[i] > 0) flare[i] = Math.max(0, flare[i] - dt * .55);
        }
        spineTick();
        draw(p, now / 1000, dt);
        requestAnimationFrame(frame);
      }

      resize();
      spineTick();
      addEventListener('resize', resize);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

      if (!reduced) {
        new IntersectionObserver(es => {
          const on = es[0].isIntersecting;
          if (on && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
          else if (!on) running = false;
        }).observe(sec);

        /* Arriving at a row lights it — the milestones sweep their wash and pop
         * their node on the spine, and the map flares the matching place. */
        const finaleIn = sec.querySelector('.bk-tl-finale-in');
        const flareIo = new IntersectionObserver(es => {
          es.forEach(en => {
            if (!en.isIntersecting) return;
            en.target.classList.add('bk-lit');
            flareIo.unobserve(en.target);
            const i = cardNode[cards.indexOf(en.target)];
            if (i === undefined) return;
            flare[i] = 1;
            for (const ed of edges) {
              if ((ed[0] === i || ed[1] === i) && pulses.length < 26)
                pulses.push({ e: ed, t: 0, v: 1.1 });
            }
          });
        }, { threshold: .5 });
        cards.forEach(c => flareIo.observe(c));
        if (finaleIn) flareIo.observe(finaleIn);
      }
    })();
  
