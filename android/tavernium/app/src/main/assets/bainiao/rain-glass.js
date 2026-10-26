/* Static rain glass, directly transferred from the user-approved preview.
   Only real size or system-theme changes repaint an existing home view. */
const bainiaoRainGlass = (() => {
  'use strict';
  const banner = document.getElementById('bn-rain-glass');
  const state = { seed: 71023, density: 1.9, fog: .62, refraction: 1 };
  let dark = null, lastRender = '';
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  function random(seed) { return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function canvas(width, height) { const image = document.createElement('canvas'); image.width = width; image.height = height; return image; }
  function outside(width, height, dark) {
    const image = canvas(width, height), c = image.getContext('2d'), s = width / 390;
    const rnd = random(state.seed ^ 8172);
    const wash = c.createLinearGradient(0, 0, width * .2, height);
    wash.addColorStop(0, dark ? '#647476' : '#d6e0de'); wash.addColorStop(.52, dark ? '#354443' : '#b0bcb7'); wash.addColorStop(1, dark ? '#1b2e30' : '#889c93');
    c.fillStyle = wash; c.fillRect(0, 0, width, height);
    c.filter = 'blur(' + 12 * s + 'px)';
    for (let i = 0; i < 20; i++) {
      const x = rnd() * width, y = rnd() * height, r = (14 + rnd() * 38) * s;
      c.globalAlpha = .13 + rnd() * .2; c.fillStyle = dark ? ['#182e31', '#697266', '#7f8771'][i % 3] : ['#4d6865', '#dae0d9', '#8ca29d'][i % 3];
      c.beginPath(); c.ellipse(x, y, r * .7, r * 1.5, -.3, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = .32; c.filter = 'blur(' + 3 * s + 'px)';
    c.fillStyle = dark ? '#14252a' : '#526e68';
    for (const [x, w] of [[.12, .023], [.36, .06], [.61, .035], [.91, .02]]) c.fillRect(width * x, height * .25, width * w, height);
    c.globalAlpha = 1; c.filter = 'blur(' + 5 * s + 'px)';
    for (const [x, y, r] of [[.18, .63, 8], [.68, .34, 12], [.83, .74, 6]]) {
      const light = c.createRadialGradient(width * x, height * y, 0, width * x, height * y, r * s * 3.2);
      light.addColorStop(0, dark ? 'rgba(223,193,143,.7)' : 'rgba(242,231,195,.65)'); light.addColorStop(.28, dark ? 'rgba(190,166,122,.36)' : 'rgba(226,222,189,.34)'); light.addColorStop(1, 'rgba(200,185,150,0)');
      c.fillStyle = light; c.fillRect(0, 0, width, height);
    }
    c.filter = 'none'; return image;
  }
  function material(width, height, dark) {
    const s = width / 390, rnd = random(state.seed), scene = outside(width, height, dark);
    const fogged = canvas(width, height), fogContext = fogged.getContext('2d');
    fogContext.filter = 'blur(' + (3 + state.fog * 9) * s + 'px)'; fogContext.drawImage(scene, -10 * s, -4 * s, width + 20 * s, height + 8 * s); fogContext.filter = 'none';
    fogContext.fillStyle = dark ? 'rgba(80,96,97,.12)' : 'rgba(223,228,216,.20)'; fogContext.fillRect(0, 0, width, height);
    const source = scene.getContext('2d').getImageData(0, 0, width, height).data;
    const output = fogContext.getImageData(0, 0, width, height), pixels = output.data;
    const sample = (x, y, channel) => {
      x = clamp(x, 0, width - 1.001); y = clamp(y, 0, height - 1.001);
      const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy, a = (iy * width + ix) * 4 + channel;
      return source[a] * (1 - fx) * (1 - fy) + source[a + 4] * fx * (1 - fy) + source[a + width * 4] * (1 - fx) * fy + source[a + width * 4 + 4] * fx * fy;
    };
    for (let i = 0; i < pixels.length; i += 4) {
      const grain = (rnd() - .5) * 2.1; pixels[i] += grain; pixels[i + 1] += grain; pixels[i + 2] += grain;
    }
    const drops = [];
    const appendDrop = (x, y, r, fall = false) => drops.push({ x, y, rx: r * (.74 + rnd() * .27), ry: r * (fall ? 1.35 + rnd() * .45 : .84 + rnd() * .4), phase: rnd() * 6.28, strength: .84 + rnd() * .22 });
    // Narrow wet ribbons refract the same outside image and finish in a heavier bead.
    for (let n = 0; n < Math.round(6 * state.density * width / 780); n++) {
      const x = (.08 + rnd() * .84) * width, end = (.28 + rnd() * .78) * height, start = -rnd() * height * .15;
      const phase = rnd() * 6.28, radius = (.48 + rnd() * .78) * s;
      const center = y => x + Math.sin(y / (23 * s) + phase) * .85 * s + Math.sin(y / (7 * s) + phase) * .22 * s;
      for (let y = Math.max(0, start | 0); y < Math.min(height, end); y++) {
        const cx = center(y), rw = radius * (.65 + .25 * Math.sin(y / (11 * s) + phase));
        for (let px = Math.max(0, Math.floor(cx - rw - 1)); px <= Math.min(width - 1, Math.ceil(cx + rw + 1)); px++) {
          const u = (px - cx) / rw, distance = Math.abs(u); if (distance > 1) continue;
          const opacity = .45 * clamp((1 - distance) * rw), index = (y * width + px) * 4;
          for (let k = 0; k < 3; k++) pixels[index + k] = pixels[index + k] * (1 - opacity) + (sample(px - u * 7 * s * state.refraction, y + 2 * s, k) + (u < 0 ? -10 : 13) * distance * distance) * opacity;
        }
      }
      appendDrop(center(end), end, (2.5 + rnd() * 2.6) * s, true);
    }
    for (let i = 0; i < Math.round(width * height / (700 * s * s) * state.density); i++) {
      const r = (1 + Math.pow(rnd(), 1.5) * 4.6) * s, x = rnd() * width, y = rnd() * height;
      if (drops.every(d => Math.hypot(d.x - x, (d.y - y) * .9) > (d.rx + r) * 1.1)) appendDrop(x, y, r, rnd() > .83);
    }
    for (let i = 0; i < Math.round(width * height / (60 * s * s) * state.density); i++) appendDrop(rnd() * width, rnd() * height, (.25 + Math.pow(rnd(), 2) * .8) * s);
    for (const d of drops) {
      const x0 = Math.max(0, Math.floor(d.x - d.rx * 1.23)), x1 = Math.min(width - 1, Math.ceil(d.x + d.rx * 1.23));
      const y0 = Math.max(0, Math.floor(d.y - d.ry * 1.15)), y1 = Math.min(height - 1, Math.ceil(d.y + d.ry * 1.15));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const v = (y - d.y) / d.ry, u = (x - d.x) / (d.rx * (1 + .1 * v));
        const angle = Math.atan2(v, u), outline = 1 + .045 * Math.sin(angle * 3 + d.phase) + .025 * Math.cos(angle * 5 - d.phase);
        const radius = Math.hypot(u, v) / outline, edge = 1 - radius;
        if (edge < 0) continue;
        const alpha = clamp(edge * Math.min(d.rx, d.ry) * 1.6), dome = Math.sqrt(Math.max(.01, 1 - radius * radius));
        const bending = (12 * s + d.rx * 2.8) * state.refraction;
        const sx = d.x - u * bending, sy = height * .30 + d.y * .24 - v * height * .52 * state.refraction;
        const rim = Math.exp(-edge * Math.min(d.rx, d.ry) * 1.8);
        const light = Math.pow(Math.max(0, -.46 * u + .88 * v), 3), shade = Math.pow(Math.max(0, .35 * u - .93 * v), 2);
        const glint = Math.exp(-((u + .23) ** 2 / .014 + (v + .47) ** 2 / .009)) * (d.rx > 3 * s ? 1 : .2);
        const reflection = (light * 115 - shade * 22) * rim + glint * 18;
        const index = (y * width + x) * 4;
        for (let k = 0; k < 3; k++) {
          const refracted = .10 + .45 * (1 - dome);
          const transmitted = pixels[index + k] * (1 - refracted) + sample(sx, sy, k) * 1.025 * refracted + reflection * d.strength;
          pixels[index + k] = clamp(pixels[index + k] * (1 - alpha) + transmitted * alpha, 0, 255);
        }
      }
    }
    fogContext.putImageData(output, 0, 0);
    return fogged;
  }
  function render() {
    const preview = banner.closest('#bn-home-preview');
    if (dark === null || !banner.getClientRects().length || document.getElementById('bn-home')?.hidden || (preview?.dataset.view && preview.dataset.view !== 'home')) return;
    const width = Math.round(banner.getBoundingClientRect().width);
    if (width <= 0) return;
    const key = width + '/' + dark;
    if (key === lastRender) return;
    lastRender = key;
    const field = material(width * 2, 192, dark);
    banner.width = width * 2; banner.height = 192;
    banner.getContext('2d').drawImage(field, 0, 0);
  }
  let resizeFrame = 0;
  const scheduleResize = () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(render); };
  const resize = new ResizeObserver(scheduleResize);
  resize.observe(banner);
  return { render(theme) { dark = theme; render(); } };
})();
