(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const t = I18n.t;

  const ROUNDS = 5;
  const MAX_DIGITS = 7;
  // Any 8 consecutive numbers contain 4 even ones, so every slider setting can produce a GCD >= 2.
  const MIN_GAP = 7;
  const HINT_AFTER = 3;
  const PERFECT_BONUS = 0.1;

  I18n.setLang(Store.get('lang'));
  Sound.setEnabled(Store.get('sound'));

  const els = {
    title: $('#title'),
    demoNums: $('#demo-nums'),
    demoBadge: $('#demo-badge'),
    demoBars: $('#demo-bars'),
    demoCaption: $('#demo-caption'),
    legend: $('#legend'),
    sCount: $('#s-count'),
    sMin: $('#s-min'),
    sMax: $('#s-max'),
    vCount: $('#v-count'),
    vMin: $('#v-min'),
    vMax: $('#v-max'),
    rangeInfo: $('#range-info'),
    diffStars: $('#diff-stars'),
    diffMult: $('#diff-mult'),
    btnStart: $('#btn-start'),
    btnSettings: $('#btn-settings'),
    menuScores: $('#menu-scores'),

    btnQuit: $('#btn-quit'),
    progress: $('#progress'),
    timer: $('#timer'),
    qLabel: $('#q-label'),
    qStars: $('#q-stars'),
    runScore: $('#run-score'),
    orbs: $('#orbs'),
    answer: $('#answer'),
    answerText: $('#answer-text'),
    answerLabel: $('#answer-label'),
    hint: $('#hint'),
    snail: $('#game-snail'),
    keypad: $('#keypad'),
    viz: $('#viz'),
    vizCard: $('#viz-card'),
    vizBadge: $('#viz-badge'),
    vizVerdict: $('#viz-verdict'),
    vizMsg: $('#viz-msg'),
    vizBars: $('#viz-bars'),
    vizPoints: $('#viz-points'),
    vizBtn: $('#viz-btn'),

    sumList: $('#sum-list'),
    totalCard: $('#total-card'),
    bonusLine: $('#bonus-line'),
    totalScore: $('#total-score'),
    totalTime: $('#total-time'),
    sumScores: $('#sum-scores'),
    btnAgain: $('#btn-again'),
    btnMenu: $('#btn-menu'),

    modalSettings: $('#modal-settings'),
    modalName: $('#modal-name'),
    modalQuit: $('#modal-quit'),
    soundSwitch: $('#sound-switch'),
    btnReset: $('#btn-reset'),
    nameRank: $('#name-rank'),
    nameScore: $('#name-score'),
    nameInput: $('#name-input'),
    btnSaveName: $('#btn-save-name'),
    btnSkipName: $('#btn-skip-name'),
  };

  let screen = 'menu';
  let game = null;
  let settings = { count: 2, min: 4, max: 40 };
  let summaryTimers = [];
  let pendingScore = null;
  let lastSavedId = null;

  // ---------------------------------------------------------------- helpers

  const esc = s =>
    String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const toneOf = v => (v === 'correct' ? 'ok' : v === 'partial' ? 'mid' : 'bad');
  const pct = inp => ((inp.value - inp.min) / (inp.max - inp.min)) * 100;

  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function starsHTML(n) {
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<svg class="${i <= n ? 'on' : ''}"><use href="#i-star"/></svg>`;
    return h;
  }

  function rowLabel(row, d) {
    return row.r ? t('eqRem', { n: row.n, d, q: row.q, r: row.r }) : t('eqFit', { n: row.n, d, q: row.q });
  }

  function verdictFor(nums, g, d) {
    if (d < 1 || d > Math.min(...nums)) return 'invalid';
    if (nums.some(n => n % d)) return 'wrong';
    return d === g ? 'correct' : 'partial';
  }

  function countUp(el, to, dur, { tick = false, done } = {}) {
    const start = performance.now();
    let lastTick = 0;
    const frame = now => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = I18n.num(Math.round(to * eased));
      if (tick && p < 1 && now - lastTick > 60) {
        Sound.count();
        lastTick = now;
      }
      if (p < 1) requestAnimationFrame(frame);
      else if (done) done();
    };
    requestAnimationFrame(frame);
  }

  function later(ms, fn) {
    summaryTimers.push(setTimeout(fn, ms));
  }

  function ripple(btn, x, y) {
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 1.5;
    const cx = (x ?? r.left + r.width / 2) - r.left;
    const cy = (y ?? r.top + r.height / 2) - r.top;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `width:${size}px;height:${size}px;left:${cx - size / 2}px;top:${cy - size / 2}px`;
    btn.appendChild(s);
    setTimeout(() => s.remove(), 600);
  }

  function setSnail(mood) {
    els.snail.classList.remove('happy', 'sad');
    if (mood) restartAnim(els.snail, mood);
  }

  // ---------------------------------------------------------------- screens

  function show(name) {
    screen = name;
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    $('#screen-' + name).scrollTop = 0;
    if (name === 'menu') {
      Demo.start();
      renderScores(els.menuScores, lastSavedId);
    } else {
      Demo.stop();
    }
    if (name !== 'summary') {
      summaryTimers.forEach(clearTimeout);
      summaryTimers = [];
    }
  }

  // ---------------------------------------------------------------- modals

  const openModalEl = () => $('.modal.open');

  function openModal(m) {
    m.classList.add('open');
  }

  function closeModal(m) {
    m.classList.remove('open');
  }

  // ---------------------------------------------------------------- language

  function renderTitle() {
    const colors = ['#ff6fb5', '#ffd23f', '#22d3ee', '#a3e635', '#ff8c42', '#a78bfa', '#34d399'];
    const title = t('appTitle');
    els.title.innerHTML = [...title]
      .map((ch, i) =>
        ch === ' '
          ? '<span class="sp"> </span>'
          : `<span style="--i:${i};--lc:${colors[i % colors.length]}">${esc(ch)}</span>`)
      .join('');
    els.title.setAttribute('aria-label', title);
    document.title = title;
  }

  function applyLang() {
    $$('[data-i18n]').forEach(el => {
      el.innerHTML = t(el.dataset.i18n);
    });
    $$('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
    $$('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === I18n.getLang()));
    renderTitle();
    els.answerLabel.textContent = t('gcd') + ' =';
    updateSliderUI();
    renderScores(els.menuScores, lastSavedId);
    renderScores(els.sumScores, lastSavedId);
    Demo.restart();
  }

  // ---------------------------------------------------------------- sound

  function updateSoundUI() {
    const on = Sound.isEnabled();
    $$('[data-sound-toggle]').forEach(b => {
      b.classList.toggle('muted', !on);
      b.querySelector('use').setAttribute('href', on ? '#i-sound-on' : '#i-sound-off');
    });
    els.soundSwitch.classList.toggle('on', on);
    els.soundSwitch.setAttribute('aria-checked', String(on));
  }

  function setSound(on) {
    Store.set('sound', on);
    Sound.setEnabled(on);
    updateSoundUI();
    if (on) Sound.click();
  }

  // ---------------------------------------------------------------- sliders

  function initSliders() {
    const c = clamp(Number(Store.get('count')) || 2, 2, 4);
    const mn = clamp(Number(Store.get('min')) || 4, +els.sMin.min, +els.sMin.max);
    const mx = clamp(Number(Store.get('max')) || 40, +els.sMax.min, +els.sMax.max);
    els.sCount.value = c;
    els.sMin.value = mn;
    els.sMax.value = mx;
    normalize('min');

    [[els.sCount, 'count', els.vCount], [els.sMin, 'min', els.vMin], [els.sMax, 'max', els.vMax]].forEach(
      ([inp, name, out]) => {
        let lastVal = inp.value;
        inp.addEventListener('input', () => {
          normalize(name);
          if (inp.value !== lastVal) {
            lastVal = inp.value;
            Sound.slide(pct(inp) / 100);
            restartAnim(out, 'pop');
          }
        });
        inp.addEventListener('change', persistSettings);
      });
  }

  function normalize(changed) {
    let mn = +els.sMin.value;
    let mx = +els.sMax.value;
    if (mx - mn < MIN_GAP) {
      if (changed === 'min') mx = mn + MIN_GAP;
      else mn = mx - MIN_GAP;
    }
    els.sMin.value = mn;
    els.sMax.value = mx;
    settings = { count: +els.sCount.value, min: +els.sMin.value, max: +els.sMax.value };
    updateSliderUI();
  }

  function persistSettings() {
    Store.set('count', settings.count);
    Store.set('min', settings.min);
    Store.set('max', settings.max);
  }

  function updateSliderUI() {
    [[els.sCount, els.vCount], [els.sMin, els.vMin], [els.sMax, els.vMax]].forEach(([inp, out]) => {
      inp.style.setProperty('--pct', pct(inp) + '%');
      out.textContent = inp.value;
    });
    els.rangeInfo.textContent = t('rangeInfo', { min: settings.min, max: settings.max });
    const d = GameMath.previewDifficulty(settings.count, settings.max);
    els.diffStars.innerHTML = starsHTML(GameMath.stars(d));
    els.diffMult.textContent = t('multiplier', { m: I18n.dec(d, 1) });
  }

  // ---------------------------------------------------------------- high scores

  function renderScores(listEl, highlightId) {
    const scores = Store.scores();
    listEl.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = scores[i];
      const li = document.createElement('li');
      li.className = 'score-row' + (s ? '' : ' empty') + (s && s.id === highlightId ? ' new' : '');
      li.style.setProperty('--i', i);
      const meta = s && s.count ? t('metaSettings', { c: s.count, min: s.min, max: s.max }) : '';
      li.innerHTML = `
        <span class="rank r${i + 1}">${i + 1}</span>
        <span class="nm">${s ? esc(s.name) : '- - - -'}</span>
        <span class="meta">${esc(meta)}</span>
        <span class="pts">${s ? I18n.num(s.score) : '—'}</span>`;
      listEl.appendChild(li);
    }
  }

  // ---------------------------------------------------------------- menu demo

  const Demo = (() => {
    const SCRIPT = [
      { nums: [15, 6], tries: [6, 3] },
      { nums: [18, 6], tries: [3, 6] },
      { nums: [12, 18], tries: [4, 6] },
      { nums: [8, 12, 20], tries: [2, 4] },
      { nums: [24, 36], tries: [8, 12] },
    ];
    let si = 0;
    let ti = 0;
    let timer = null;
    let running = false;

    function setLegend(tone) {
      $$('li', els.legend).forEach(li => li.classList.toggle('active', !!tone && li.classList.contains('lg-' + tone)));
    }

    function step() {
      if (!running) return;
      const ex = SCRIPT[si];
      const d = ex.tries[ti];
      const g = GameMath.gcdAll(ex.nums);
      const verdict = verdictFor(ex.nums, g, d);
      const tone = toneOf(verdict);

      if (ti === 0) {
        els.demoNums.innerHTML = ex.nums
          .map((n, i) => `<span class="chip c${i}" style="--i:${i}">${n}</span>`)
          .join('');
      }
      els.demoBadge.textContent = d;
      els.demoBadge.className = 'demo-badge';
      restartAnim(els.demoBadge, 'pop');
      els.demoCaption.className = 'demo-caption';
      els.demoCaption.innerHTML = t('demoTry', { d });
      setLegend(null);

      const v = Viz.render(els.demoBars, ex.nums, d, { label: rowLabel, sound: false });
      timer = setTimeout(() => {
        els.demoBars.dataset.tone = tone;
        els.demoBadge.classList.add('tone-' + tone);
        const key = verdict === 'correct' ? 'demoOk' : verdict === 'partial' ? 'demoMid' : 'demoBad';
        els.demoCaption.innerHTML = t(key, { d, list: I18n.list(ex.nums), n: ex.nums.find(n => n % d) });
        els.demoCaption.classList.add('tone-' + tone);
        setLegend(tone);
        timer = setTimeout(() => {
          ti++;
          if (ti >= ex.tries.length) {
            ti = 0;
            si = (si + 1) % SCRIPT.length;
          }
          step();
        }, verdict === 'correct' ? 2900 : 2100);
      }, v.duration + 150);
    }

    return {
      start() {
        if (running) return;
        running = true;
        step();
      },
      stop() {
        running = false;
        clearTimeout(timer);
      },
      restart() {
        if (!running) return;
        this.stop();
        ti = 0;
        this.start();
      },
    };
  })();

  // ---------------------------------------------------------------- game

  function startGame() {
    Sound.unlock();
    Sound.whoosh();
    persistSettings();
    game = {
      settings: { ...settings },
      questions: GameMath.makeRound(settings.count, settings.min, settings.max, ROUNDS),
      idx: 0,
      results: [],
      input: '',
      wrong: 0,
      tries: 0,
      accum: 0,
      tStart: 0,
      running: false,
      loopId: 0,
      overlay: null,
    };
    show('game');
    els.runScore.textContent = I18n.num(0);
    buildProgress();
    loadQuestion();
  }

  function current() {
    return game.questions[game.idx];
  }

  function buildProgress() {
    els.progress.innerHTML = '';
    for (let i = 0; i < ROUNDS; i++) {
      const d = document.createElement('span');
      d.className = 'pdot';
      d.textContent = i + 1;
      els.progress.appendChild(d);
    }
  }

  function updateProgress() {
    $$('.pdot', els.progress).forEach((d, i) => {
      const r = game.results[i];
      d.className = 'pdot' + (r ? (r.wrong ? ' done-mid' : ' done-ok') : i === game.idx ? ' current' : '');
      d.innerHTML = r ? '<svg><use href="#i-check"/></svg>' : String(i + 1);
    });
  }

  function loadQuestion() {
    const q = current();
    game.input = '';
    game.wrong = 0;
    game.tries = 0;
    game.accum = 0;
    game.running = false;
    renderAnswer();
    els.hint.textContent = '';
    els.hint.classList.remove('show');
    els.qLabel.textContent = t('question', { n: game.idx + 1, total: ROUNDS });
    els.qStars.innerHTML = starsHTML(q.stars);
    els.orbs.classList.remove('win');
    renderOrbs(q.nums);
    updateProgress();
    setSnail(null);
    els.timer.textContent = I18n.secs(0);
    resumeTimer();
  }

  function renderOrbs(nums) {
    els.orbs.innerHTML = '';
    els.orbs.dataset.count = nums.length;
    nums.forEach((n, i) => {
      const o = document.createElement('div');
      o.className = `orb c${i}`;
      o.dataset.digits = String(n).length;
      o.style.setProperty('--i', i);
      o.innerHTML = `<span class="orb-num">${n}</span>`;
      els.orbs.appendChild(o);
      setTimeout(() => Sound.pop(i), 140 + i * 110);
    });
  }

  // timer ---------------------------------------------------------

  const elapsed = () => game.accum + (game.running ? performance.now() - game.tStart : 0);

  function resumeTimer() {
    if (!game || game.running) return;
    game.tStart = performance.now();
    game.running = true;
    const id = ++game.loopId;
    const loop = () => {
      if (!game || !game.running || game.loopId !== id) return;
      els.timer.textContent = I18n.secs(elapsed());
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function pauseTimer() {
    if (!game || !game.running) return;
    game.accum += performance.now() - game.tStart;
    game.running = false;
    els.timer.textContent = I18n.secs(game.accum);
  }

  // input ---------------------------------------------------------

  function renderAnswer(bump) {
    els.answerText.textContent = game.input;
    els.answer.classList.toggle('empty', !game.input);
    els.answer.classList.toggle('long', game.input.length > 4);
    if (bump) restartAnim(els.answer, 'bump');
  }

  function flashKey(key) {
    const b = els.keypad.querySelector(`[data-key="${key}"]`);
    if (!b) return;
    b.classList.add('pressed');
    ripple(b);
    setTimeout(() => b.classList.remove('pressed'), 120);
  }

  function press(key) {
    if (!game || screen !== 'game' || openModalEl()) return;
    const ov = game.overlay;
    if (ov) {
      if (key === 'enter') overlayAction();
      else if (ov.revealed && ov.verdict !== 'correct' && /^\d$/.test(key)) {
        overlayAction();
        press(key);
      }
      return;
    }

    if (/^\d$/.test(key)) {
      if (game.input.length >= MAX_DIGITS) {
        restartAnim(els.answer, 'shake');
        Sound.invalid();
        return;
      }
      game.input = game.input === '0' ? key : game.input + key;
      Sound.key(+key);
      renderAnswer(true);
    } else if (key === 'back') {
      if (!game.input) return;
      game.input = game.input.slice(0, -1);
      Sound.back();
      renderAnswer();
    } else if (key === 'enter') {
      submit();
    }
  }

  function submit() {
    if (!game.input) {
      restartAnim(els.answer, 'shake');
      Sound.back();
      return;
    }
    const q = current();
    const d = Number(game.input);
    pauseTimer();
    Sound.send();
    const verdict = verdictFor(q.nums, q.gcd, d);
    game.tries++;
    if (verdict !== 'correct') game.wrong++;
    openOverlay(q, d, verdict);
  }

  // feedback overlay ----------------------------------------------

  function openOverlay(q, d, verdict) {
    const ov = { q, d, verdict, revealed: false, viz: null, timer: null };
    game.overlay = ov;
    els.viz.classList.add('open');
    els.vizCard.className = 'viz-card';
    els.vizBadge.textContent = String(d);
    els.vizBadge.classList.toggle('long', String(d).length > 3);
    els.vizVerdict.textContent = '';
    els.vizMsg.innerHTML = '';
    els.vizPoints.innerHTML = '';
    els.vizBtn.hidden = true;

    if (verdict === 'invalid') {
      const smallest = Math.min(...q.nums);
      els.vizBars.dataset.tone = 'bad';
      els.vizBars.innerHTML = `
        <div class="viz-invalid">
          <div class="inv-x">✕</div>
          ${d > 0 ? `<div class="inv-cmp"><b>${d}</b><span>&gt;</span><b>${smallest}</b></div>` : ''}
        </div>`;
      ov.timer = setTimeout(() => reveal(ov), 250);
      return;
    }

    ov.viz = Viz.render(els.vizBars, q.nums, d, { label: rowLabel });
    ov.timer = setTimeout(() => reveal(ov), ov.viz.duration);
  }

  function messageFor(ov) {
    const { q, d } = ov;
    switch (ov.verdict) {
      case 'correct':
        return t('m_correct', { d, list: I18n.list(q.nums) });
      case 'partial':
        return t('m_partial', { d });
      case 'wrong': {
        const fails = q.nums.filter(n => n % d).map(n => t('m_failItem', { n, r: n % d }));
        return t('m_wrong', { d, fails: I18n.list(fails) });
      }
      default:
        return d === 0 ? t('m_zero') : t('m_tooBig', { s: Math.min(...q.nums) });
    }
  }

  function reveal(ov) {
    if (ov.revealed || game.overlay !== ov) return;
    ov.revealed = true;
    clearTimeout(ov.timer);
    if (ov.viz) ov.viz.finish();

    const tone = toneOf(ov.verdict);
    els.vizBars.dataset.tone = tone;
    els.vizCard.classList.add('revealed', 'tone-' + tone);
    els.vizVerdict.textContent = t('v_' + ov.verdict);
    els.vizMsg.innerHTML = messageFor(ov);

    if (ov.verdict === 'correct') {
      const q = ov.q;
      const ms = game.accum;
      const points = GameMath.score(q.difficulty, ms, game.wrong);
      game.results.push({ nums: q.nums, gcd: q.gcd, stars: q.stars, ms, wrong: game.wrong, tries: game.tries, points });

      els.vizPoints.innerHTML = `
        <span class="pts-chip"><svg><use href="#i-clock"/></svg>${I18n.secs(ms)} s</span>
        <span class="pts-chip"><svg><use href="#i-star"/></svg>×${I18n.dec(q.difficulty, 2)}</span>
        <span class="pts-big">+<span id="viz-pts">0</span></span>`;
      countUp($('#viz-pts'), points, 900, { tick: true });
      const runTotal = game.results.reduce((a, r) => a + r.points, 0);
      countUp(els.runScore, runTotal, 900);

      Sound.correct();
      FX.fromElement(els.vizBadge, { count: 110, power: 620 });
      FX.ring(...centerOf(els.vizBadge), '#2ee59d');
      els.orbs.classList.add('win');
      setSnail('happy');
      updateProgress();
      els.vizBtn.innerHTML = `<span>${game.idx === ROUNDS - 1 ? t('toResults') : t('next')}</span><span class="arrow">→</span>`;
    } else {
      if (ov.verdict === 'partial') Sound.partial();
      else if (ov.verdict === 'wrong') Sound.wrong();
      else Sound.invalid();
      if (ov.verdict !== 'partial') restartAnim(els.vizCard, 'shake');
      setSnail('sad');
      els.vizBtn.innerHTML = `<svg><use href="#i-retry"/></svg><span>${t('retry')}</span>`;
    }
    els.vizBtn.className = 'btn btn-big ' + (ov.verdict === 'correct' ? 'btn-go' : 'btn-ghost');
    els.vizBtn.hidden = false;
  }

  function centerOf(el) {
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  function overlayAction() {
    const ov = game && game.overlay;
    if (!ov) return;
    if (!ov.revealed) {
      reveal(ov);
      return;
    }
    Sound.click();
    closeOverlay();
    if (ov.verdict === 'correct') {
      game.idx++;
      if (game.idx >= ROUNDS) finishGame();
      else loadQuestion();
    } else {
      game.input = '';
      renderAnswer();
      maybeHint();
      resumeTimer();
    }
  }

  function closeOverlay() {
    if (game && game.overlay) {
      clearTimeout(game.overlay.timer);
      if (game.overlay.viz) game.overlay.viz.finish();
      game.overlay = null;
    }
    els.viz.classList.remove('open');
  }

  function maybeHint() {
    if (game.wrong < HINT_AFTER) return;
    const s = Math.min(...current().nums);
    els.hint.innerHTML = t('hint', { s: `<b>${s}</b>`, divs: I18n.list(GameMath.divisors(s)) });
    els.hint.classList.add('show');
  }

  // quitting ------------------------------------------------------

  function askQuit() {
    if (!game) return;
    if (!game.overlay) pauseTimer();
    Sound.click();
    openModal(els.modalQuit);
  }

  function cancelQuit() {
    closeModal(els.modalQuit);
    if (game && !game.overlay) resumeTimer();
  }

  function confirmQuit() {
    closeModal(els.modalQuit);
    closeOverlay();
    if (game) game.running = false;
    game = null;
    Sound.whoosh();
    show('menu');
  }

  // ---------------------------------------------------------------- summary

  function finishGame() {
    const results = game.results;
    const sum = results.reduce((a, r) => a + r.points, 0);
    const perfect = results.every(r => r.wrong === 0);
    const bonus = perfect ? Math.round(sum * PERFECT_BONUS) : 0;
    const total = sum + bonus;
    const totalMs = results.reduce((a, r) => a + r.ms, 0);
    const s = game.settings;
    pendingScore = { score: total, count: s.count, min: s.min, max: s.max };
    lastSavedId = null;
    game.running = false;
    game = null;
    show('summary');
    renderSummary({ results, bonus, total, totalMs });
  }

  function renderSummary({ results, bonus, total, totalMs }) {
    els.sumList.innerHTML = results
      .map((r, i) => `
        <div class="sum-row" style="--i:${i}">
          <div class="sum-idx">${i + 1}</div>
          <div class="sum-main">
            <div class="sum-nums">
              ${r.nums.map((n, j) => `<span class="chip c${j}">${n}</span>`).join('')}
              <span class="sum-gcd">${t('gcd')} = <b>${r.gcd}</b></span>
            </div>
            <div class="sum-meta">
              <span class="stars">${starsHTML(r.stars)}</span>
              <span class="meta-chip"><svg><use href="#i-clock"/></svg>${I18n.secs(r.ms)} s</span>
              <span class="meta-chip ${r.wrong ? 'warn' : 'good'}">${r.tries === 1 ? t('tryOne') : t('tryMany', { n: r.tries })}</span>
            </div>
          </div>
          <div class="sum-pts" data-pts="${r.points}">0</div>
        </div>`)
      .join('');

    els.bonusLine.classList.remove('show');
    els.bonusLine.innerHTML = '';
    els.totalCard.classList.remove('done');
    els.totalScore.textContent = I18n.num(0);
    els.totalTime.textContent = t('totalTime', { t: I18n.secs(totalMs) });
    renderScores(els.sumScores);

    const ROW = 380;
    const cells = $$('.sum-pts', els.sumList);
    cells.forEach((el, i) =>
      later(300 + i * ROW, () => {
        Sound.pop(i);
        countUp(el, +el.dataset.pts, 650);
      }));

    let at = 300 + cells.length * ROW + 350;
    if (bonus) {
      later(at, () => {
        els.bonusLine.innerHTML = `${t('bonus')} <b>+${I18n.num(bonus)}</b>`;
        els.bonusLine.classList.add('show');
        Sound.record();
      });
      at += 800;
    }
    later(at, () => {
      Sound.whoosh();
      countUp(els.totalScore, total, 1900, {
        tick: true,
        done: () => {
          if (screen !== 'summary') return;
          Sound.fanfare();
          FX.rain();
          FX.fromElement(els.totalScore, { count: 140, power: 760 });
          els.totalCard.classList.add('done');
          if (Store.qualifies(total)) later(1000, openNameModal);
        },
      });
    });
  }

  // name entry ----------------------------------------------------

  const cleanName = v => v.toUpperCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 4);

  function openNameModal() {
    if (screen !== 'summary' || !pendingScore) return;
    els.nameRank.textContent = t('rank', { r: Store.rankFor(pendingScore.score) });
    els.nameScore.textContent = I18n.num(pendingScore.score);
    els.nameInput.value = cleanName(Store.get('lastName') || '');
    updateNameBtn();
    openModal(els.modalName);
    Sound.record();
    setTimeout(() => {
      els.nameInput.focus();
      els.nameInput.select();
    }, 300);
  }

  function updateNameBtn() {
    els.btnSaveName.disabled = !cleanName(els.nameInput.value);
  }

  function saveName() {
    const name = cleanName(els.nameInput.value);
    if (!name || !pendingScore) {
      restartAnim(els.nameInput, 'shake');
      return;
    }
    lastSavedId = Store.addScore({ ...pendingScore, name, date: Date.now() });
    Store.set('lastName', name);
    pendingScore = null;
    closeModal(els.modalName);
    els.nameInput.blur();
    renderScores(els.sumScores, lastSavedId);
    Sound.correct();
    const row = $('.score-row.new', els.sumScores);
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => FX.fromElement(row, { count: 80, power: 480 }), 350);
    }
  }

  function skipName() {
    pendingScore = null;
    closeModal(els.modalName);
    els.nameInput.blur();
  }

  // ---------------------------------------------------------------- events

  function bindEvents() {
    document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

    els.btnStart.addEventListener('click', e => {
      ripple(els.btnStart, e.clientX || undefined, e.clientY || undefined);
      startGame();
    });

    els.btnSettings.addEventListener('click', () => {
      Sound.click();
      openModal(els.modalSettings);
    });

    $$('[data-sound-toggle]').forEach(b => b.addEventListener('click', () => setSound(!Sound.isEnabled())));
    els.soundSwitch.addEventListener('click', () => setSound(!Sound.isEnabled()));

    $$('.lang-btn').forEach(b =>
      b.addEventListener('click', () => {
        I18n.setLang(b.dataset.lang);
        Store.set('lang', I18n.getLang());
        applyLang();
        Sound.click();
      }));

    let resetArmed = false;
    let resetTimer = null;
    const restoreReset = () => {
      resetArmed = false;
      els.btnReset.classList.remove('armed');
      els.btnReset.textContent = t('resetScores');
    };
    els.btnReset.addEventListener('click', () => {
      clearTimeout(resetTimer);
      if (!resetArmed) {
        resetArmed = true;
        els.btnReset.classList.add('armed');
        els.btnReset.textContent = t('resetConfirm');
        Sound.click();
        resetTimer = setTimeout(restoreReset, 3000);
        return;
      }
      Store.clearScores();
      lastSavedId = null;
      renderScores(els.menuScores);
      renderScores(els.sumScores);
      resetArmed = false;
      els.btnReset.classList.remove('armed');
      els.btnReset.textContent = t('resetDone');
      Sound.back();
      resetTimer = setTimeout(restoreReset, 1500);
    });

    $$('.modal').forEach(m =>
      m.addEventListener('click', e => {
        if (e.target === m && m !== els.modalName) {
          if (m === els.modalQuit) cancelQuit();
          else closeModal(m);
        }
      }));
    $$('[data-close]').forEach(b =>
      b.addEventListener('click', () => {
        Sound.click();
        closeModal(b.closest('.modal'));
      }));

    // keypad: pointerdown for instant touch response, click only for keyboard activation
    els.keypad.addEventListener('pointerdown', e => {
      const b = e.target.closest('.key');
      if (!b) return;
      e.preventDefault();
      ripple(b, e.clientX, e.clientY);
      press(b.dataset.key);
    });
    els.keypad.addEventListener('click', e => {
      if (e.detail !== 0) return;
      const b = e.target.closest('.key');
      if (b) press(b.dataset.key);
    });
    els.keypad.addEventListener('contextmenu', e => e.preventDefault());

    els.vizBtn.addEventListener('click', overlayAction);
    els.btnQuit.addEventListener('click', askQuit);
    $('#btn-quit-yes').addEventListener('click', confirmQuit);
    $('#btn-quit-no').addEventListener('click', cancelQuit);

    els.btnAgain.addEventListener('click', () => {
      if (openModalEl()) return;
      startGame();
    });
    els.btnMenu.addEventListener('click', () => {
      Sound.click();
      show('menu');
    });

    els.nameInput.addEventListener('input', () => {
      const v = cleanName(els.nameInput.value);
      if (v !== els.nameInput.value) els.nameInput.value = v;
      updateNameBtn();
      if (v) Sound.key(v.length * 2);
    });
    els.nameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveName();
      }
    });
    els.btnSaveName.addEventListener('click', saveName);
    els.btnSkipName.addEventListener('click', skipName);

    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const modal = openModalEl();
      if (modal) {
        if (e.key !== 'Escape') return;
        if (modal === els.modalQuit) cancelQuit();
        else if (modal === els.modalName) skipName();
        else closeModal(modal);
        return;
      }

      if (screen === 'game' && game) {
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          if (!game.overlay) flashKey(e.key);
          press(e.key);
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          if (!game.overlay) flashKey('back');
          press('back');
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (e.repeat) return;
          if (!game.overlay) flashKey('enter');
          press('enter');
        } else if (e.key === 'Escape') {
          e.preventDefault();
          askQuit();
        }
      } else if (screen === 'menu' && e.key === 'Enter' && !e.repeat) {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag !== 'BUTTON') {
          e.preventDefault();
          startGame();
        }
      }
    });
  }

  // ---------------------------------------------------------------- boot

  initSliders();
  applyLang();
  updateSoundUI();
  bindEvents();
  show('menu');
})();
