const Sound = (() => {
  let ctx = null;
  let master = null;
  let enabled = true;
  let noiseBuf = null;

  function ac() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const midi = m => 440 * Math.pow(2, (m - 69) / 12);

  function tone(freq, { type = 'sine', dur = 0.18, vol = 0.22, at = 0, attack = 0.008, to = null } = {}) {
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime + at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.25, vol = 0.12, at = 0, freq = 800, to = null, q = 0.9, type = 'bandpass' } = {}) {
    const c = ac();
    if (!c) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  const PENTA = [0, 2, 4, 7, 9];

  return {
    unlock() {
      ac();
    },
    setEnabled(v) {
      enabled = !!v;
      if (!enabled && ctx && ctx.state === 'running') ctx.suspend();
    },
    isEnabled: () => enabled,

    click() {
      tone(760, { type: 'sine', dur: 0.06, vol: 0.12 });
    },
    slide(p) {
      tone(420 + p * 520, { type: 'triangle', dur: 0.05, vol: 0.07 });
    },
    key(d) {
      const f = midi(72 + PENTA[d % 5] + 12 * Math.floor(d / 5));
      tone(f, { type: 'triangle', dur: 0.1, vol: 0.2 });
      tone(f * 2, { type: 'sine', dur: 0.07, vol: 0.05 });
    },
    back() {
      tone(330, { type: 'triangle', dur: 0.12, vol: 0.18, to: 210 });
    },
    send() {
      noise({ dur: 0.28, vol: 0.09, freq: 500, to: 3500, q: 1.2 });
      tone(440, { type: 'sine', dur: 0.2, vol: 0.12, to: 880 });
    },
    pop(i = 0) {
      tone(midi(76 + PENTA[i % 5]), { type: 'sine', dur: 0.12, vol: 0.14, to: midi(83 + PENTA[i % 5]) });
    },
    tick(i) {
      const m = Math.min(100, 64 + PENTA[i % 5] + 12 * Math.floor(i / 5));
      tone(midi(m), { type: 'sine', dur: 0.11, vol: 0.13 });
      tone(midi(m) * 2, { type: 'triangle', dur: 0.05, vol: 0.03 });
    },
    remainder() {
      tone(180, { type: 'square', dur: 0.14, vol: 0.06, to: 140 });
    },
    correct() {
      [72, 76, 79, 84].forEach((m, i) => tone(midi(m), { type: 'triangle', dur: 0.32, vol: 0.2, at: i * 0.08 }));
      [88, 91, 96].forEach((m, i) => tone(midi(m), { type: 'sine', dur: 0.25, vol: 0.06, at: 0.32 + i * 0.06 }));
      [72, 76, 79].forEach(m => tone(midi(m), { type: 'sine', dur: 0.7, vol: 0.08, at: 0.34 }));
    },
    partial() {
      tone(midi(74), { type: 'triangle', dur: 0.18, vol: 0.18 });
      tone(midi(77), { type: 'triangle', dur: 0.26, vol: 0.18, at: 0.14 });
      tone(320, { type: 'sine', dur: 0.3, vol: 0.08, at: 0.05, to: 520 });
    },
    wrong() {
      tone(240, { type: 'sawtooth', dur: 0.3, vol: 0.1, to: 130 });
      tone(254, { type: 'square', dur: 0.3, vol: 0.04, to: 140 });
    },
    invalid() {
      tone(150, { type: 'square', dur: 0.12, vol: 0.09 });
      tone(150, { type: 'square', dur: 0.16, vol: 0.09, at: 0.17 });
    },
    count() {
      tone(1300 + Math.random() * 400, { type: 'sine', dur: 0.035, vol: 0.05 });
    },
    whoosh() {
      noise({ dur: 0.4, vol: 0.08, freq: 300, to: 2400, q: 0.7 });
    },
    fanfare() {
      const seq = [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36], [76, 0.52], [79, 0.62], [84, 0.78]];
      seq.forEach(([m, at]) => tone(midi(m), { type: 'triangle', dur: 0.3, vol: 0.18, at }));
      [72, 76, 79, 84].forEach(m => tone(midi(m), { type: 'sine', dur: 1.2, vol: 0.07, at: 0.78 }));
      noise({ dur: 0.9, vol: 0.05, at: 0.78, freq: 6000, type: 'highpass', q: 0.5 });
    },
    record() {
      [79, 83, 86, 91, 95].forEach((m, i) => tone(midi(m), { type: 'sine', dur: 0.25, vol: 0.12, at: i * 0.07 }));
    },
  };
})();
