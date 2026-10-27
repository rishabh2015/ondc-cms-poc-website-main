/* About Us — the Board of Directors as one growing network.
 *
 * A section-local sibling of the homepage field and the journey map: seeded
 * square nodes, two-neighbour hairlines and one blue origin. The difference is
 * restraint. There is no idle wobble or autonomous pulse; scroll position is
 * the only clock, and upward scrolling retracts the field exactly.
 */
(function () {
  'use strict';

  const section = document.getElementById('board-of-directors');
  const canvas = document.getElementById('boardNetworkCanvas');
  if (!section || !canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BLUE = '#2151F5';
  const TINTS = ['#c9ced4', '#8a8f95'];
  const FW = 1200;
  const FH = 820;
  const SX = FW * .5;
  const SY = FH * .07;
  const mobile = innerWidth < 700;
  const AREA_PER_NODE = mobile ? 7200 : 3600;
  const MIN_D = Math.sqrt(AREA_PER_NODE) * .86;
  const MAX_D = MIN_D * 2.55;
  const MAX_NODES = mobile ? 145 : 340;
  const HOLD = .045;
  const FADE = .045;

  let seed = 20260824;
  function random() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  const vx = [SX];
  const vy = [SY];
  const size = [3.4];
  const tint = [null];
  const grid = new Map();
  const cellKey = (x, y) => ((x / MIN_D) | 0) * 8192 + ((y / MIN_D) | 0);

  function store(i) {
    const key = cellKey(vx[i], vy[i]);
    (grid.get(key) || grid.set(key, []).get(key)).push(i);
  }

  function farEnough(x, y) {
    const cx = (x / MIN_D) | 0;
    const cy = (y / MIN_D) | 0;
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
      const nearby = grid.get((cx + gx) * 8192 + (cy + gy));
      if (!nearby) continue;
      for (const i of nearby) {
        if (Math.hypot(vx[i] - x, vy[i] - y) < MIN_D) return false;
      }
    }
    return true;
  }

  store(0);
  for (let attempt = 0; attempt < 50000 && vx.length < MAX_NODES; attempt++) {
    const x = random() * FW;
    const y = random() * FH;
    if (!farEnough(x, y)) continue;
    const i = vx.length;
    vx.push(x);
    vy.push(y);
    size.push(random() < .11 ? 2.5 + random() * .7 : 1.25 + random() * .9);
    tint.push(random() < .12 ? TINTS[(random() * TINTS.length) | 0] : null);
    store(i);
  }

  const count = vx.length;
  const order = Array.from({ length: count }, (_, i) => i);
  function rank(i) {
    if (i === 0) return -1;
    const organic = ((i * 2654435761) % 1000) / 1000;
    const fromSeed = Math.hypot(vx[i] - SX, vy[i] - SY);
    return vy[i] * .70 + fromSeed * .20 + organic * FH * .10;
  }
  order.sort((a, b) => rank(a) - rank(b));

  const threshold = new Float32Array(count);
  threshold[0] = -FADE;
  for (let i = 1; i < count; i++) {
    threshold[order[i]] = HOLD + ((i - 1) / Math.max(1, count - 2)) * (1 - HOLD);
  }

  const edges = [];
  const edgeGrid = new Map();
  const edgeKey = (x, y) => ((x / MAX_D) | 0) * 8192 + ((y / MAX_D) | 0);
  for (let i = 0; i < count; i++) {
    const key = edgeKey(vx[i], vy[i]);
    (edgeGrid.get(key) || edgeGrid.set(key, []).get(key)).push(i);
  }
  for (let i = 0; i < count; i++) {
    const cx = (vx[i] / MAX_D) | 0;
    const cy = (vy[i] / MAX_D) | 0;
    const near = [];
    for (let gx = -1; gx <= 1; gx++) for (let gy = -1; gy <= 1; gy++) {
      const nearby = edgeGrid.get((cx + gx) * 8192 + (cy + gy));
      if (!nearby) continue;
      for (const j of nearby) {
        if (j <= i) continue;
        const distance = Math.hypot(vx[i] - vx[j], vy[i] - vy[j]);
        if (distance <= MAX_D) near.push([j, distance]);
      }
    }
    near.sort((a, b) => a[1] - b[1]);
    for (let j = 0; j < Math.min(2, near.length); j++) {
      edges.push([i, near[j][0], .34 * (1 - near[j][1] / MAX_D)]);
    }
  }

  let width = 0;
  let height = 0;
  let dpr = 1;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let visible = reduced;
  let raf = 0;

  function clamp(value) {
    return Math.max(0, Math.min(1, value));
  }

  function progress() {
    if (reduced) return 1;
    const rect = section.getBoundingClientRect();
    const start = innerHeight * .72;
    const end = innerHeight * .28 - rect.height;
    return clamp((start - rect.top) / Math.max(1, start - end));
  }

  function alphaAt(i, p) {
    return clamp((p - threshold[i]) / FADE);
  }

  function draw() {
    raf = 0;
    if (!visible && !reduced) return;

    const p = progress();
    const nodeScale = mobile ? 1.22 : 1.08;
    const xAt = i => offsetX + vx[i] * scale;
    const yAt = i => offsetY + vy[i] * scale;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = BLUE;

    for (const edge of edges) {
      const a = alphaAt(edge[0], p);
      const b = alphaAt(edge[1], p);
      const opacity = edge[2] * Math.min(a, b);
      if (opacity <= .01) continue;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      ctx.moveTo(xAt(edge[0]), yAt(edge[0]));
      ctx.lineTo(xAt(edge[1]), yAt(edge[1]));
      ctx.stroke();
    }

    for (let i = 0; i < count; i++) {
      const alpha = alphaAt(i, p);
      if (alpha <= .01) continue;
      const side = size[i] * 1.4 * nodeScale;
      ctx.globalAlpha = alpha * (tint[i] ? .72 : .92);
      ctx.fillStyle = tint[i] || BLUE;
      ctx.fillRect(xAt(i) - side / 2, yAt(i) - side / 2, side, side);
    }

    for (let i = 0; i < count; i++) {
      const alpha = alphaAt(i, p);
      if (size[i] < 2.45 || alpha < .65) continue;
      ctx.globalAlpha = alpha * .11;
      ctx.fillStyle = BLUE;
      ctx.beginPath();
      ctx.arc(xAt(i), yAt(i), size[i] * 5.4 * nodeScale, 0, Math.PI * 2);
      ctx.fill();
    }

    const seedAlpha = alphaAt(0, p);
    if (seedAlpha > .01) {
      ctx.fillStyle = BLUE;
      for (const ring of [[30 * nodeScale, .055], [15 * nodeScale, .12]]) {
        ctx.globalAlpha = seedAlpha * ring[1];
        ctx.beginPath();
        ctx.arc(xAt(0), yAt(0), ring[0], 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function schedule() {
    if ((!visible && !reduced) || raf) return;
    raf = requestAnimationFrame(draw);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    scale = Math.max(width / FW, height / FH);
    offsetX = (width - FW * scale) / 2;
    offsetY = (height - FH * scale) / 2;
    schedule();
  }

  function onVisibility() {
    const rect = section.getBoundingClientRect();
    visible = !document.hidden && rect.bottom > 0 && rect.top < innerHeight;
    if (visible) schedule();
  }

  resize();
  if (!reduced) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting && !document.hidden;
      if (visible) schedule();
    });
    observer.observe(section);
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
  } else {
    addEventListener('resize', resize);
  }
})();
