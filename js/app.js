(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const t = I18n.t;

  const ROUNDS = GameMath.ROUNDS;
  const LEVELS = GameMath.LEVELS;
  const MAX_DIGITS = 7;
  const TIERS = 6;
  const LEVEL_COLORS = ['#34d399', '#22d3ee', '#a78bfa', '#ff8c42', '#ff4d6d'];

  I18n.setLang(Store.get('lang'));
  Sound.setEnabled(Store.get('sound'));

  const els = {
    title: $('#title'),
    demoNums: $('#demo-nums'),
    demoBadge: $('#demo-badge'),
    demoBars: $('#demo-bars'),
    demoCaption: $('#demo-caption'),
    legend: $('#legend'),
    lvCard: $('#level-card'),
    lvMult: $('#lv-mult'),
    lvPrev: $('#lv-prev'),
    lvNext: $('#lv-next'),
    lvShow: $('#lv-show'),
    lvEmblem: $('#lv-emblem'),
    lvNum: $('#lv-num'),
    lvName: $('#lv-name'),
    lvPips: $('#lv-pips'),
    lvJump: $('#lv-jump'),
    lvVars: $('#lv-vars'),
    btnStart: $('#btn-start'),
    btnSettings: $('#btn-settings'),
    menuScores: $('#menu-scores'),
    menuLadder: $('#menu-ladder'),

    btnQuit: $('#btn-quit'),
    progress: $('#progress'),
    timer: $('#timer'),
    qLabel: $('#q-label'),
    qLevel: $('#q-level'),
    runScore: $('#run-score'),
    orbs: $('#orbs'),
    answer: $('#answer'),
    answerText: $('#answer-text'),
    answerLabel: $('#answer-label'),
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

    sumLevel: $('#sum-level'),
    sumList: $('#sum-list'),
    totalCard: $('#total-card'),
    tierBig: $('#tier-big'),
    tierLadder: $('#tier-ladder'),
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
  let level = LEVELS[0];
  let summaryTimers = [];
  let pendingScore = null;
  let lastSavedId = null;

  // ---------------------------------------------------------------- helpers

  const esc = s =>
    String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const toneOf = v => (v === 'correct' ? 'ok' : v === 'partial' ? 'mid' : 'bad');
  const levelName = lv => t('lv' + lv.id);
  const levelColor = lv => LEVEL_COLORS[lv.id - 1];

  function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function setLevelChip(el, lv) {
    el.style.setProperty('--lv', levelColor(lv));
    el.innerHTML = `<svg><use href="#lv-${lv.id}"/></svg><span>${esc(levelName(lv))}</span>`;
  }

  function tierIcon(n) {
    if (!n) return '';
    return `<svg class="tier-icon t${n}" role="img" aria-label="${esc(t('tierAria', { n }))}"><use href="#tier-${n}"/></svg>`;
  }

  function ladderHTML(n) {
    return Array.from({ length: TIERS }, (_, i) => {
      const cls = i < n ? (i === n - 1 ? ' got cur' : ' got') : '';
      return `<span class="rung${cls}">${tierIcon(i + 1)}</span>`;
    }).join('');
  }

  function renderCollection() {
    const top = Store.scores()[0];
    const best = Math.max(Number(Store.get('bestTier')) || 0, top ? GameMath.tier(top.score) : 0);
    els.menuLadder.innerHTML = ladderHTML(best);
  }

  function rowLabel(row, d) {
    return row.r ? t('eqRem', { n: row.n, d, q: row.q, r: row.r }) : t('eqFit', { n: row.n, d, q: row.q });
  }

  function verdictFor(nums, g, d) {
    if (d < 1 || d > Math.min(...nums)) return 'invalid';
    if (nums.some(n => n % d)) return 'wrong';
    return d === g ? 'correct' : 'partial';
  }

  function countUp(el, to, dur, { tick = false, done, onValue } = {}) {
    const start = performance.now();
    let lastTick = 0;
    const frame = now => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(to * eased);
      el.textContent = I18n.num(v);
      if (onValue) onValue(v);
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
      renderCollection();
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
    renderLevel();
    renderScores(els.menuScores, lastSavedId);
    renderCollection();
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

  // ---------------------------------------------------------------- difficulty levels

  function initLevels() {
    const saved = clamp(Math.round(Number(Store.get('level'))) || 1, 1, LEVELS.length);
    level = LEVELS[saved - 1];
    els.lvJump.innerHTML = LEVELS.map(lv => `
      <button class="lv-dot" data-level="${lv.id}" style="--lv:${levelColor(lv)}">
        <svg><use href="#lv-${lv.id}"/></svg><span>${lv.id}</span>
      </button>`).join('');
    els.lvPrev.addEventListener('click', () => setLevel(level.id - 1));
    els.lvNext.addEventListener('click', () => setLevel(level.id + 1));
    els.lvJump.addEventListener('click', e => {
      const b = e.target.closest('.lv-dot');
      if (b) setLevel(+b.dataset.level);
    });
  }

  function setLevel(id) {
    if (id < 1 || id > LEVELS.length || id === level.id) return;
    const dir = id > level.id ? 1 : -1;
    level = LEVELS[id - 1];
    Store.set('level', id);
    Sound.tick(id * 2);
    renderLevel(dir);
    FX.fromElement(els.lvEmblem, { count: 10 + id * 8, power: 220 + id * 50 });
  }

  function levelVars(lv) {
    const f = GameMath.factors(lv);
    const largest = Math.max(...LEVELS.map(l => l.max));
    const orbs = Array.from({ length: lv.count }, (_, i) => `<i class="c${i}"></i>`).join('');
    return [
      { vis: `<span class="vis-orbs">${orbs}</span>`, val: t('v_count', { c: lv.count }), exp: t('x_count'), f: f.count },
      {
        vis: `<span class="vis-gauge"><i style="--p:${Math.round((lv.max / largest) * 100)}%"></i></span>`,
        val: t('v_max', { m: lv.max }),
        exp: t('x_max'),
        f: f.max,
      },
      { vis: `<span class="vis-block">${lv.low}</span>`, val: t('v_low', { l: lv.low }), exp: t('x_low'), f: f.low },
      {
        vis: `<span class="vis-yn ${lv.allowMin ? 'yes' : 'no'}"><svg><use href="#i-${lv.allowMin ? 'check' : 'close'}"/></svg></span>`,
        val: t(lv.allowMin ? 'v_minYes' : 'v_minNo'),
        exp: t('x_min'),
        f: f.allowMin,
      },
    ];
  }

  function renderLevel(dir = 0) {
    const lv = level;
    els.lvCard.style.setProperty('--lv', levelColor(lv));
    els.lvCard.dataset.level = lv.id;
    els.lvEmblem.querySelector('use').setAttribute('href', '#lv-' + lv.id);
    els.lvNum.textContent = t('levelNum', { n: lv.id });
    els.lvName.textContent = levelName(lv);
    els.lvPips.innerHTML = LEVELS.map(l => `<i class="${l.id <= lv.id ? 'on' : ''}"></i>`).join('');
    els.lvMult.textContent = t('multiplier', { m: I18n.dec(GameMath.multiplier(lv), 2) });
    els.lvPrev.disabled = lv.id === 1;
    els.lvNext.disabled = lv.id === LEVELS.length;

    $$('.lv-dot', els.lvJump).forEach(b => {
      const id = +b.dataset.level;
      b.classList.toggle('active', id === lv.id);
      b.setAttribute('aria-pressed', String(id === lv.id));
      b.setAttribute('aria-label', `${t('levelNum', { n: id })} – ${t('lv' + id)}`);
    });

    els.lvVars.innerHTML = levelVars(lv)
      .map((v, i) => `
        <div class="lv-var" style="--i:${i}">
          <div class="lv-vis">${v.vis}</div>
          <div class="lv-info"><b class="lv-val">${v.val}</b><span class="lv-exp">${v.exp}</span></div>
          <span class="lv-fac${v.f > 1 ? ' up' : ''}">×${I18n.dec(v.f, 2)}</span>
        </div>`)
      .join('');

    if (dir) {
      restartAnim(els.lvShow, dir > 0 ? 'in-right' : 'in-left');
      restartAnim(els.lvMult, 'pop');
    }
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
      const lv = s && LEVELS[s.level - 1];
      let meta = '';
      if (lv) meta = `<svg style="color:${levelColor(lv)}"><use href="#lv-${lv.id}"/></svg>${esc(levelName(lv))}`;
      else if (s && s.count) meta = esc(t('metaSettings', { c: s.count, min: s.min, max: s.max }));
      li.innerHTML = `
        <span class="rank r${i + 1}">${i + 1}</span>
        <span class="tier-slot">${s ? tierIcon(GameMath.tier(s.score)) : ''}</span>
        <span class="nm">${s ? esc(s.name) : '- - - -'}</span>
        <span class="meta">${meta}</span>
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
    game = {
      level,
      questions: GameMath.makeRound(level),
      idx: 0,
      results: [],
      input: '',
      accum: 0,
      tStart: 0,
      running: false,
      loopId: 0,
      overlay: null,
    };
    show('game');
    setLevelChip(els.qLevel, level);
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
      const tone = r && toneOf(r.verdict);
      d.className = 'pdot' + (r ? ' done-' + tone : i === game.idx ? ' current' : '');
      d.innerHTML = r ? `<svg><use href="${tone === 'bad' ? '#i-close' : '#i-check'}"/></svg>` : String(i + 1);
    });
  }

  function loadQuestion() {
    const q = current();
    game.input = '';
    game.accum = 0;
    game.running = false;
    renderAnswer();
    els.qLabel.textContent = t('question', { n: game.idx + 1, total: ROUNDS });
    els.orbs.classList.remove('win');
    renderOrbs(q.nums);
    updateProgress();
    setSnail(null);
    renderTimer(0);
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
      renderTimer(elapsed());
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  function pauseTimer() {
    if (!game || !game.running) return;
    game.accum += performance.now() - game.tStart;
    game.running = false;
    renderTimer(game.accum);
  }

  function renderTimer(ms) {
    els.timer.innerHTML = `${I18n.secs(ms)}<small> s</small>`;
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
    openOverlay(q, d, verdictFor(q.nums, q.gcd, d));
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
    const answer = ' ' + t('m_answer', { g: q.gcd });
    switch (ov.verdict) {
      case 'correct':
        return t('m_correct', { d, list: I18n.list(q.nums) });
      case 'partial':
        return t('m_partial', { d }) + answer;
      case 'wrong': {
        const fails = q.nums.filter(n => n % d).map(n => t('m_failItem', { n, r: n % d }));
        return t('m_wrong', { d, fails: I18n.list(fails) }) + answer;
      }
      default:
        return (d === 0 ? t('m_zero') : t('m_tooBig', { s: Math.min(...q.nums) })) + answer;
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

    const q = ov.q;
    const ms = game.accum;
    const credit = GameMath.credit(ov.verdict, ov.d, q.gcd);
    const points = GameMath.score(game.level, ms, credit);
    game.results.push({ nums: q.nums, gcd: q.gcd, ms, answer: ov.d, verdict: ov.verdict, credit, points });

    const creditChip = ov.verdict === 'partial'
      ? `<span class="pts-chip mid">${t('credit', { p: Math.round(credit * 100) })}</span>`
      : '';
    els.vizPoints.innerHTML = `
      <span class="pts-chip"><svg><use href="#i-clock"/></svg>${I18n.secs(ms)} s</span>
      <span class="pts-chip"><svg><use href="#lv-${game.level.id}"/></svg>×${I18n.dec(GameMath.multiplier(game.level), 2)}</span>
      ${creditChip}
      <span class="pts-big${points ? '' : ' zero'}">+<span id="viz-pts">0</span></span>`;
    if (points) {
      countUp($('#viz-pts'), points, 900, { tick: true });
      countUp(els.runScore, game.results.reduce((a, r) => a + r.points, 0), 900);
    }

    if (ov.verdict === 'correct') {
      Sound.correct();
      FX.fromElement(els.vizBadge, { count: 110, power: 620 });
      FX.ring(...centerOf(els.vizBadge), '#2ee59d');
      els.orbs.classList.add('win');
      setSnail('happy');
    } else {
      if (ov.verdict === 'partial') Sound.partial();
      else if (ov.verdict === 'wrong') Sound.wrong();
      else Sound.invalid();
      if (ov.verdict !== 'partial') restartAnim(els.vizCard, 'shake');
      setSnail('sad');
    }
    updateProgress();
    els.vizBtn.innerHTML = `<span>${game.idx === ROUNDS - 1 ? t('toResults') : t('next')}</span><span class="arrow">→</span>`;
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
    game.idx++;
    if (game.idx >= ROUNDS) finishGame();
    else loadQuestion();
  }

  function closeOverlay() {
    if (game && game.overlay) {
      clearTimeout(game.overlay.timer);
      if (game.overlay.viz) game.overlay.viz.finish();
      game.overlay = null;
    }
    els.viz.classList.remove('open');
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
    const perfect = results.every(r => r.verdict === 'correct');
    const bonus = perfect ? Math.round(sum * GameMath.PERFECT_BONUS) : 0;
    const total = sum + bonus;
    const totalMs = results.reduce((a, r) => a + r.ms, 0);
    const lv = game.level;
    pendingScore = { score: total, level: lv.id };
    Store.set('bestTier', Math.max(Number(Store.get('bestTier')) || 0, GameMath.tier(total)));
    lastSavedId = null;
    game.running = false;
    game = null;
    show('summary');
    renderSummary({ results, bonus, total, totalMs, lv });
  }

  function showTier(n) {
    els.tierBig.innerHTML = tierIcon(n);
    els.tierBig.className = 'tier-big' + (n ? ' t' + n : '');
    if (n) restartAnim(els.tierBig, 'tier-pop');
    els.tierLadder.innerHTML = ladderHTML(n);
  }

  function renderSummary({ results, bonus, total, totalMs, lv }) {
    setLevelChip(els.sumLevel, lv);
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
              <span class="meta-chip"><svg><use href="#i-clock"/></svg>${I18n.secs(r.ms)} s</span>
              <span class="answer-chip tone-${toneOf(r.verdict)}">${t('r_' + r.verdict, { d: r.answer })}</span>
              ${r.verdict === 'partial' ? `<span class="meta-chip warn">${t('credit', { p: Math.round(r.credit * 100) })}</span>` : ''}
            </div>
          </div>
          <div class="sum-pts${r.points ? '' : ' zero'}" data-pts="${r.points}">0</div>
        </div>`)
      .join('');

    els.bonusLine.classList.remove('show');
    els.bonusLine.innerHTML = '';
    els.totalCard.classList.remove('done');
    els.totalScore.textContent = I18n.num(0);
    els.totalTime.textContent = t('totalTime', { t: I18n.secs(totalMs) });
    showTier(0);
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
      let shownTier = 0;
      countUp(els.totalScore, total, 1900, {
        tick: true,
        onValue: v => {
          const n = GameMath.tier(v);
          if (n === shownTier || screen !== 'summary') return;
          shownTier = n;
          showTier(n);
          Sound.tick(n * 2);
        },
        done: () => {
          if (screen !== 'summary') return;
          Sound.fanfare();
          FX.rain();
          FX.fromElement(els.totalScore, { count: 140, power: 760 });
          if (shownTier) FX.fromElement(els.tierBig, { count: 20 + shownTier * 15, power: 300 + shownTier * 60 });
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
    els.nameScore.innerHTML = `${tierIcon(GameMath.tier(pendingScore.score))}<span>${I18n.num(pendingScore.score)}</span>`;
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
      renderCollection();
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
      } else if (screen === 'menu') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          setLevel(level.id + (e.key === 'ArrowRight' ? 1 : -1));
        } else if (e.key === 'Enter' && !e.repeat) {
          const tag = document.activeElement && document.activeElement.tagName;
          if (tag !== 'BUTTON') {
            e.preventDefault();
            startGame();
          }
        }
      }
    });
  }

  // ---------------------------------------------------------------- boot

  initLevels();
  applyLang();
  updateSoundUI();
  bindEvents();
  show('menu');
})();
