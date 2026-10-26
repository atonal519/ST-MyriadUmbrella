/* User-approved rain-window material. Local image only; hidden/offscreen pages
   keep their last frame, with no animation loop or repeated image requests. */
const bainiaoRainGlass = (() => {
  'use strict';
  const canvas = document.getElementById('bn-rain-glass');
  const root = document.getElementById('bn-home-preview');
  const image = new Image();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let ctx, source, backdrop, droplets = [], trails = [];
  let lastPaint = 0, frame = 0, running = false, dark = null, inView = true;
  let seed = 48103, time = 0, merges = 0, pixelScale = 1;
  const FRAME_INTERVAL = 1000 / 30;
  const random = () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const scale = () => pixelScale;
  const active = () => !document.hidden && root.dataset.hostVisible !== 'false'
    && (root.dataset.view || 'home') === 'home'
    && !document.getElementById('bn-home').hidden && inView;
  function fallback() {
    if (!ctx) return;
    const wash = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    wash.addColorStop(0, dark ? '#30413f' : '#c1d0ca');
    wash.addColorStop(1, dark ? '#162625' : '#7e9990');
    ctx.fillStyle = wash; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  function drop(x, y, r, speed = 0, hold = 0) {
    return { x, y, r, speed, hold, velocity: 0, lean: (random() - .5) * .22,
      round: .86 + random() * .17, phase: random() * Math.PI * 2, dead: false };
  }
  function reset(newSeed = 48103) {
    seed = newSeed; time = 0; merges = 0; droplets = []; trails = [];
    const s = scale(), w = canvas.width, h = canvas.height;
    // Most condensation is quiet, with a range of round/flattened beads.
    const count = Math.min(160, Math.round(w * h / (900 * s * s)));
    for (let i = 0; i < count; i++) droplets.push(drop(random() * w, random() * h, (.55 + random() * 1.65) * s));
    for (let i = 0; i < Math.min(9, Math.round(w / (54 * s))); i++) {
      const d = drop((.08 + random() * .84) * w, random() * h, (2.3 + random() * 2.3) * s,
        (13 + random() * 20) * s, random() * 4);
      droplets.push(d);
    }
    // One representative collection/slide sequence is visible in the short clip.
    const x = w * .37;
    droplets.push(drop(x, h * .13, 3.1 * s, 23 * s, .3));
    droplets.push(drop(x + s, h * .38, 3.8 * s, 0, 99));
    droplets.push(drop(w * .74, h * .29, 3.4 * s, 20 * s, 1.1));
  }

  function buildBackground() {
    if (!ctx || !image.naturalWidth) return;
    const w = canvas.width, h = canvas.height, ratio = w / h;
    let sw = image.naturalWidth, sh = image.naturalHeight;
    if (sw / sh > ratio) sw = sh * ratio; else sh = sw / ratio;
    source = document.createElement('canvas'); source.width = w; source.height = h;
    source.getContext('2d').drawImage(image, (image.naturalWidth - sw) / 2,
      (image.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
    backdrop = document.createElement('canvas'); backdrop.width = w; backdrop.height = h;
    const bc = backdrop.getContext('2d'), blur = Math.max(2.5, w / 150);
    bc.filter = `blur(${blur}px)`;
    bc.drawImage(source, -blur * 2, -blur * 2, w + blur * 4, h + blur * 4);
  }
  function resize() {
    const cssWidth = canvas.clientWidth, cssHeight = canvas.clientHeight;
    if (cssWidth <= 0 || cssHeight <= 0) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.5, 780 / cssWidth);
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (ctx && canvas.width === w && canvas.height === h) return;
    canvas.width = w; canvas.height = h; pixelScale = w / cssWidth;
    ctx = canvas.getContext('2d');
    buildBackground(); reset(); paint(); sync();
  }
  function advance(dt) {
    time += dt;
    const s = scale(), h = canvas.height;
    for (const d of droplets) {
      if (d.dead || !d.speed || time < d.hold) continue;
      const target = d.speed * (1 + (d.r / s - 3) * .14);
      d.velocity += (target - d.velocity) * Math.min(1, dt * 2.8);
      const beforeX = d.x, beforeY = d.y;
      d.y += d.velocity * dt;
      d.x += Math.sin(d.y / (24 * s) + d.phase) * d.velocity * dt * .025;
      if (d.velocity > 3 * s) {
        let trail = d.trail;
        if (!trail) {
          trail = { r: d.r * .47, points: [[beforeX, beforeY]], age: 0 };
          trails.push(trail); d.trail = trail;
        }
        trail.age = 0;
        if (Math.hypot(d.x - trail.points[trail.points.length - 1][0], d.y - trail.points[trail.points.length - 1][1]) > 2 * s)
          trail.points.push([d.x, d.y]);
        if (trail.points.length > 85) trail.points.shift();
      }
      for (const other of droplets) {
        if (other === d || other.dead || other.r > d.r * 1.35) continue;
        const distance = Math.hypot(other.x - d.x, other.y - d.y);
        if (distance < (other.r + d.r) * .72) {
          d.r = Math.min(6.5 * s, Math.sqrt(d.r * d.r + other.r * other.r * .85));
          d.speed = Math.max(d.speed, 27 * s); other.dead = true; merges++;
        }
      }
      if (d.y > h + d.r * 3) {
        d.x = (random() * .88 + .06) * canvas.width;
        d.y = -8 * s; d.r = (2.5 + random() * 1.7) * s;
        d.hold = time + 1.5 + random() * 4; d.velocity = 0; d.trail = null;
      }
    }
    droplets = droplets.filter(d => !d.dead);
    for (const trail of trails) trail.age += dt;
    trails = trails.filter(t => t.age < 20).slice(-28);
  }

  function outline(d) {
    const r = d.r, elongation = clamp(d.velocity / (35 * scale()), 0, 1);
    const rx = r * d.round, top = -r * (1 + elongation * .6), bottom = r * .9;
    ctx.beginPath(); ctx.moveTo(d.lean * r, top);
    ctx.bezierCurveTo(rx * .65, top * .97, rx * 1.05, -r * .38, rx, r * .12);
    ctx.bezierCurveTo(rx * .94, bottom * .8, rx * .28, bottom * 1.08, 0, bottom);
    ctx.bezierCurveTo(-rx * .7, bottom, -rx * 1.03, r * .54, -rx, 0);
    ctx.bezierCurveTo(-rx * 1.06, -r * .5, -rx * .62, top, d.lean * r, top);
    ctx.closePath();
    return { rx, top, bottom };
  }
  function drawTrail(trail) {
    if (trail.points.length < 2) return;
    const fade = Math.min(1, (20 - trail.age) / 5), points = trail.points;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // A wet trace is a faint clear ribbon, with an uneven contact edge.
    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const half = Math.max(.5, trail.r * (.42 + .14 * Math.sin(i * .64)));
      const p = points[i]; if (!i) ctx.moveTo(p[0] - half, p[1]); else ctx.lineTo(p[0] - half, p[1]);
    }
    for (let i = points.length - 1; i >= 0; i--) {
      const half = Math.max(.5, trail.r * (.42 + .14 * Math.sin(i * .64)));
      ctx.lineTo(points[i][0] + half, points[i][1]);
    }
    ctx.closePath(); ctx.save(); ctx.clip(); ctx.globalAlpha = .22 * fade;
    ctx.drawImage(source, 0, 0); ctx.restore();
    ctx.beginPath(); ctx.moveTo(...points[0]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
    ctx.lineWidth = Math.max(.45, trail.r * .34);
    ctx.strokeStyle = `rgba(17,35,21,${.075 * fade})`; ctx.stroke();
    ctx.restore();
  }
  function drawDrop(d) {
    const r = d.r, s = scale();
    ctx.save(); ctx.translate(d.x, d.y);
    const shape = outline(d);
    ctx.save(); ctx.clip();
    // A water lens contains a compressed/inverted view of the scene, rather
    // than a white fill. An uneven light/dark rim completes the contact edge.
    const sample = Math.max(14 * s, r * 9), sx = clamp(d.x - sample / 2, 0, canvas.width - sample);
    const sy = clamp(d.y - sample / 2, 0, canvas.height - sample);
    ctx.save(); ctx.scale(-1, -1);
    ctx.drawImage(source, sx, sy, sample, sample, -shape.rx, -shape.bottom,
      shape.rx * 2, shape.bottom - shape.top);
    ctx.restore();
    const shade = ctx.createLinearGradient(-r, -r, r, r);
    shade.addColorStop(0, 'rgba(9,20,11,.28)');
    shade.addColorStop(.32, 'rgba(15,32,17,.05)');
    shade.addColorStop(.68, 'rgba(231,242,230,.02)');
    shade.addColorStop(1, 'rgba(247,252,240,.30)');
    ctx.fillStyle = shade; ctx.fillRect(-r * 1.3, shape.top, r * 2.6, shape.bottom - shape.top);
    ctx.restore();
    outline(d); ctx.lineWidth = Math.max(.4, .36 * s);
    ctx.strokeStyle = dark ? 'rgba(8,14,9,.65)' : 'rgba(9,25,12,.57)'; ctx.stroke();
    // Uneven light rim and a small caustic; the centre stays transparent.
    ctx.beginPath(); ctx.ellipse(r * .10, r * .06, shape.rx * .91, r * .82, 0, .1, 1.95);
    ctx.lineWidth = Math.max(.45, .39 * s);
    ctx.strokeStyle = dark ? 'rgba(236,246,227,.52)' : 'rgba(250,255,241,.77)'; ctx.stroke();
    if (r > 1.2 * s) {
      ctx.beginPath(); ctx.ellipse(-r * .32, -r * .48, r * .18, r * .25, -.5, 0, Math.PI * 2);
      ctx.fillStyle = dark ? 'rgba(247,253,233,.45)' : 'rgba(253,255,246,.70)'; ctx.fill();
    }
    ctx.restore();
  }
  function paint() {
    if (!ctx || dark === null) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!backdrop) { fallback(); canvas.dataset.ready = 'true'; return; }
    ctx.drawImage(backdrop, 0, 0);
    if (dark) { ctx.fillStyle = 'rgba(8,18,12,.34)'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    for (const trail of trails) drawTrail(trail);
    for (const d of droplets) drawDrop(d);
    canvas.dataset.ready = 'true';
  }
  function loop(t) {
    if (!running) return;
    if (!active() || reduced.matches) { sync(); return; }
    const elapsed = t - lastPaint;
    if (elapsed >= FRAME_INTERVAL) {
      lastPaint = t; advance(Math.min(.1, elapsed / 1000)); paint();
    }
    frame = requestAnimationFrame(loop);
  }
  function sync() {
    const go = active() && !reduced.matches && !!backdrop && dark !== null;
    if (!go) {
      cancelAnimationFrame(frame); running = false;
    } else if (!running) {
      running = true; lastPaint = performance.now();
      frame = requestAnimationFrame(loop);
    }
  }
  image.onload = () => { resize(); buildBackground(); paint(); sync(); };
  image.onerror = () => { backdrop = null; source = null; paint(); sync(); };
  image.src = 'https://bainiao.local/rain-background.webp';
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(entries => {
    inView = !!entries[0]?.isIntersecting; sync();
  }, { threshold: .01 }).observe(canvas);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  addEventListener('resize', resize);
  addEventListener('pagehide', () => { cancelAnimationFrame(frame); running = false; });
  return {
    render(theme) {
      const changed = dark !== !!theme; dark = !!theme;
      if (!ctx) resize();
      else if (changed) paint();
      sync();
    },
    sync,
  };
})();
