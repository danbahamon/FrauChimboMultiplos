const FX = (() => {
  const bg = document.getElementById('bg-canvas');
  const fx = document.getElementById('fx-canvas');
  const bctx = bg.getContext('2d');
  const fctx = fx.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLORS = ['#ff4fa3', '#22d3ee', '#ffd23f', '#a78bfa', '#34d399', '#ff8c42', '#60a5fa'];
  const GLYPHS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '÷', '×', '?', '='];
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  let W = 0;
  let H = 0;
  let floaters = [];
  let stars = [];
  let particles = [];
  let pointerX = 0;
  let pointerY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    for (const [c, cx] of [[bg, bctx], [fx, fctx]]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      c.style.width = W + 'px';
      c.style.height = H + 'px';
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    seed();
  }

  function makeFloater(anywhere) {
    const r = Math.random();
    return {
      kind: r < 0.6 ? 'glyph' : r < 0.82 ? 'ring' : 'blob',
      glyph: pick(GLYPHS),
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 60,
      size: 16 + Math.random() * 40,
      vy: -(8 + Math.random() * 18),
      vx: (Math.random() - 0.5) * 8,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.5,
      color: pick(COLORS),
      alpha: 0.1 + Math.random() * 0.22,
      depth: 0.3 + Math.random() * 0.7,
      phase: Math.random() * Math.PI * 2,
    };
  }

  function seed() {
    const n = reduceMotion ? 10 : Math.round(Math.max(14, Math.min(48, (W * H) / 26000)));
    floaters = Array.from({ length: n }, () => makeFloater(true));
    stars = Array.from({ length: reduceMotion ? 20 : 70 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.6 + Math.random() * 1.6,
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.8,
    }));
  }

  function drawBackground(t, dt) {
    bctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      bctx.globalAlpha = a;
      bctx.fillStyle = '#fff';
      bctx.beginPath();
      bctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      bctx.fill();
    }

    const px = (pointerX / (W || 1) - 0.5) * 24;
    const py = (pointerY / (H || 1) - 0.5) * 24;
    for (const f of floaters) {
      if (!reduceMotion) {
        f.y += f.vy * dt * f.depth;
        f.x += f.vx * dt * f.depth + Math.sin(t + f.phase) * 0.15;
        f.rot += f.vr * dt;
      }
      if (f.y < -80) Object.assign(f, makeFloater(false));
      const x = f.x + px * f.depth;
      const y = f.y + py * f.depth;
      bctx.save();
      bctx.globalAlpha = f.alpha;
      bctx.translate(x, y);
      bctx.rotate(f.rot);
      if (f.kind === 'glyph') {
        bctx.fillStyle = f.color;
        bctx.font = `700 ${f.size}px Fredoka, "Segoe UI", sans-serif`;
        bctx.textAlign = 'center';
        bctx.textBaseline = 'middle';
        bctx.fillText(f.glyph, 0, 0);
      } else if (f.kind === 'ring') {
        bctx.strokeStyle = f.color;
        bctx.lineWidth = 3;
        bctx.beginPath();
        bctx.arc(0, 0, f.size * 0.45, 0, Math.PI * 2);
        bctx.stroke();
      } else {
        const g = bctx.createRadialGradient(0, 0, 0, 0, 0, f.size);
        g.addColorStop(0, f.color);
        g.addColorStop(1, 'transparent');
        bctx.fillStyle = g;
        bctx.beginPath();
        bctx.arc(0, 0, f.size, 0, Math.PI * 2);
        bctx.fill();
      }
      bctx.restore();
    }
    bctx.globalAlpha = 1;
  }

  function drawParticles(dt) {
    fctx.clearRect(0, 0, W, H);
    if (!particles.length) return;
    const alive = [];
    for (const p of particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      alive.push(p);
      const a = Math.min(1, p.life / p.fade);
      if (p.kind === 'ring') {
        p.r += p.vr * dt;
        fctx.globalAlpha = a * 0.8;
        fctx.strokeStyle = p.color;
        fctx.lineWidth = 4 * a + 1;
        fctx.beginPath();
        fctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        fctx.stroke();
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= 1 - 0.9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      fctx.globalAlpha = a;
      fctx.fillStyle = p.color;
      fctx.save();
      fctx.translate(p.x, p.y);
      fctx.rotate(p.rot);
      if (p.kind === 'rect') {
        fctx.scale(1, Math.cos(p.rot * 2.3));
        fctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else if (p.kind === 'star') {
        star(fctx, p.w);
      } else {
        fctx.beginPath();
        fctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        fctx.fill();
      }
      fctx.restore();
    }
    fctx.globalAlpha = 1;
    particles = alive;
  }

  function star(c, size) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? size * 0.22 : size * 0.55;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    drawBackground(now / 1000, dt);
    drawParticles(dt);
    requestAnimationFrame(frame);
  }

  function burst(x, y, { count = 90, power = 520, colors = COLORS, spread = Math.PI * 2, angle = -Math.PI / 2 } = {}) {
    const n = reduceMotion ? Math.round(count / 4) : count;
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = power * (0.35 + Math.random() * 0.75);
      const r = Math.random();
      particles.push({
        kind: r < 0.6 ? 'rect' : r < 0.85 ? 'star' : 'dot',
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        g: 900,
        w: 7 + Math.random() * 9,
        h: 4 + Math.random() * 6,
        rot: Math.random() * 6.28,
        spin: (Math.random() - 0.5) * 14,
        color: pick(colors),
        life: 1.6 + Math.random() * 1.2,
        fade: 0.6,
      });
    }
  }

  function ring(x, y, color = '#fff') {
    particles.push({ kind: 'ring', x, y, r: 10, vr: 420, color, life: 0.6, fade: 0.6 });
  }

  function rain(duration = 2.2) {
    const n = reduceMotion ? 30 : 160;
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      particles.push({
        kind: r < 0.65 ? 'rect' : r < 0.9 ? 'star' : 'dot',
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.8,
        vx: (Math.random() - 0.5) * 120,
        vy: 120 + Math.random() * 200,
        g: 160,
        w: 7 + Math.random() * 9,
        h: 4 + Math.random() * 6,
        rot: Math.random() * 6.28,
        spin: (Math.random() - 0.5) * 10,
        color: pick(COLORS),
        life: duration + Math.random() * 2,
        fade: 0.8,
      });
    }
  }

  function fromElement(el, opts) {
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, opts);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', e => {
    pointerX = e.clientX;
    pointerY = e.clientY;
  }, { passive: true });

  resize();
  requestAnimationFrame(frame);

  return { burst, ring, rain, fromElement, COLORS };
})();
