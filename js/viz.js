// Draws each number as a bar and chops it into blocks of size d,
// so students can see how many times d fits and whether anything is left over.
const Viz = (() => {
  const ROW_OFFSET = 110;

  const defaultLabel = (row, d) =>
    row.r ? `${row.n} ÷ ${d} = ${row.q} R ${row.r}` : `${row.n} ÷ ${d} = ${row.q}`;

  function render(container, nums, d, { label = defaultLabel, sound = true } = {}) {
    const timers = [];
    container.classList.remove('instant');
    delete container.dataset.tone;
    container.innerHTML = '';

    const maxN = Math.max(...nums);
    const rows = nums.map((n, idx) => ({ n, idx, q: Math.floor(n / d), r: n % d }));
    const maxQ = Math.max(1, ...rows.map(r => r.q));
    const step = Math.max(26, Math.min(170, 1300 / maxQ));
    let duration = 0;
    let lastRemAt = -1;

    for (const row of rows) {
      const start = row.idx * ROW_OFFSET;
      const fillEnd = start + row.q * step;
      const remAt = fillEnd + 120;
      const eqAt = row.r ? remAt + 280 : fillEnd + 100;
      duration = Math.max(duration, eqAt + 260);
      if (row.r) lastRemAt = Math.max(lastRemAt, remAt);

      const el = document.createElement('div');
      el.className = 'viz-row ' + (row.r ? 'fail' : 'fit');
      el.innerHTML = `
        <div class="viz-meta">
          <span class="viz-num c${row.idx}">${row.n}</span>
          <span class="viz-eq" style="animation-delay:${eqAt}ms">${label(row, d)}</span>
          <span class="viz-mark" style="animation-delay:${eqAt}ms">${row.r ? '✕' : '✓'}</span>
        </div>
        <div class="viz-track"><div class="viz-bar" style="width:${(row.n / maxN) * 100}%"></div></div>`;

      const bar = el.querySelector('.viz-bar');
      bar.style.gap = (row.q > 60 ? 0 : row.q > 24 ? 1 : 3) + 'px';
      const frag = document.createDocumentFragment();
      for (let i = 0; i < row.q; i++) {
        const s = document.createElement('div');
        s.className = 'seg' + (i % 2 ? ' alt' : '');
        s.style.flexGrow = d;
        s.style.animationDelay = `${start + i * step}ms`;
        s.innerHTML = `<span>${d}</span>`;
        frag.appendChild(s);
      }
      if (row.r) {
        const s = document.createElement('div');
        s.className = 'seg rem';
        s.style.flexGrow = row.r;
        s.style.animationDelay = `${remAt}ms, ${remAt + 320}ms`;
        s.innerHTML = `<span>${row.r}</span>`;
        frag.appendChild(s);
      }
      bar.appendChild(frag);
      container.appendChild(el);
    }

    requestAnimationFrame(() => {
      container.querySelectorAll('.seg').forEach(s => {
        const label = s.firstElementChild;
        if (label && s.clientWidth < label.offsetWidth + 6) s.classList.add('tiny');
      });
    });

    if (sound) {
      const ticks = Math.min(maxQ, 24);
      const every = (maxQ / ticks) * step;
      for (let i = 0; i < ticks; i++) timers.push(setTimeout(() => Sound.tick(i), i * every));
      if (lastRemAt >= 0) timers.push(setTimeout(() => Sound.remainder(), lastRemAt));
    }

    return {
      duration,
      finish() {
        timers.forEach(clearTimeout);
        timers.length = 0;
        container.classList.add('instant');
      },
    };
  }

  return { render };
})();
