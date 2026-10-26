const GameMath = (() => {
  const BASE_POINTS = 100000;
  const ROUNDS = 5;
  const PERFECT_BONUS = 0.1;
  // When a level allows it, roughly this share of questions has the smallest number as the answer.
  const MIN_ANSWER_SHARE = 0.25;
  // About the fastest a strong player solves an Extreme question; the top rocket needs 90 % of that perfect round.
  const HUMAN_BEST_MS = 4000;
  const TIER_SHARES = [0, 0.06, 0.13, 0.25, 0.5, 0.9];

  const LEVELS = [
    { id: 1, count: 2, low: 2, max: 20, allowMin: true },
    { id: 2, count: 2, low: 2, max: 50, allowMin: true },
    { id: 3, count: 2, low: 4, max: 80, allowMin: true },
    { id: 4, count: 3, low: 7, max: 100, allowMin: false },
    { id: 5, count: 4, low: 13, max: 190, allowMin: false },
  ];

  const gcd = (a, b) => {
    while (b) [a, b] = [b, a % b];
    return a;
  };
  const gcdAll = nums => nums.reduce((a, b) => gcd(a, b));
  const round2 = x => Math.round(x * 100) / 100;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function combos(arr, k, start = 0, acc = [], out = []) {
    if (acc.length === k) {
      out.push(acc.slice());
      return out;
    }
    for (let i = start; i <= arr.length - (k - acc.length); i++) {
      acc.push(arr[i]);
      combos(arr, k, i + 1, acc, out);
      acc.pop();
    }
    return out;
  }

  // ---------------------------------------------------------------- scoring

  // Every level setting contributes its own bonus factor; the multiplier is their product.
  function factors(level) {
    return {
      count: round2(1 + 0.5 * (level.count - 2)),
      max: round2(Math.sqrt(level.max / 20)),
      low: round2(1 + 0.03 * (level.low - 2)),
      allowMin: level.allowMin ? 1 : 1.15,
    };
  }

  function multiplier(level) {
    const f = factors(level);
    return round2(f.count * f.max * f.low * f.allowMin);
  }

  // Harder levels get more time before points decay, and a bigger multiplier.
  function score(level, ms, credit) {
    const mult = multiplier(level);
    const tau = 2000 + 1500 * mult;
    return Math.round(BASE_POINTS * mult * (tau / (tau + ms)) * credit);
  }

  // Full credit for the GCD. A smaller common divisor d earns d / gcd, which is
  // at most 1/2 because d must itself divide the GCD.
  function credit(verdict, d, g) {
    if (verdict === 'correct') return 1;
    if (verdict === 'partial') return d / g;
    return 0;
  }

  const HUMAN_MAX = Math.round(ROUNDS * score(LEVELS[LEVELS.length - 1], HUMAN_BEST_MS, 1) * (1 + PERFECT_BONUS));

  function tier(total) {
    if (!(total > 0)) return 0;
    return TIER_SHARES.filter(s => total >= s * HUMAN_MAX).length;
  }

  // ---------------------------------------------------------------- questions

  const pools = new Map();
  const recent = new Map();

  // Every distinct set of numbers the level can ask about, with its GCD.
  function pool(level) {
    if (pools.has(level.id)) return pools.get(level.id);
    const sets = new Map();
    for (let g = level.low; g * level.count <= level.max; g++) {
      const mults = [];
      for (let m = g; m <= level.max; m += g) mults.push(m);
      for (const nums of combos(mults, level.count)) {
        const key = nums.join('-');
        if (sets.has(key)) continue;
        const g2 = gcdAll(nums);
        const minIsAnswer = g2 === nums[0];
        sets.set(key, minIsAnswer && !level.allowMin ? null : { key, nums, gcd: g2, minIsAnswer });
      }
    }
    const list = [...sets.values()].filter(Boolean);
    pools.set(level.id, list);
    return list;
  }

  // Sets with a rare GCD are picked more often than uniform sampling would, so answers vary.
  function weightedPick(list) {
    const perGcd = new Map();
    list.forEach(s => perGcd.set(s.gcd, (perGcd.get(s.gcd) || 0) + 1));
    const weights = list.map(s => 1 / Math.sqrt(perGcd.get(s.gcd)));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  function makeRound(level) {
    const all = pool(level);
    const history = new Set(recent.get(level.id) || []);
    const used = new Set();
    const qs = [];
    let prevGcd = null;

    for (let i = 0; i < ROUNDS; i++) {
      const wantMin = level.allowMin && Math.random() < MIN_ANSWER_SHARE;
      const fresh = s => !used.has(s.key);
      const filters = [
        s => fresh(s) && s.minIsAnswer === wantMin && s.gcd !== prevGcd && !history.has(s.key),
        s => fresh(s) && s.minIsAnswer === wantMin && s.gcd !== prevGcd,
        fresh,
        () => true,
      ];
      let candidates = [];
      for (const f of filters) {
        candidates = all.filter(f);
        if (candidates.length) break;
      }
      const s = weightedPick(candidates);
      used.add(s.key);
      prevGcd = s.gcd;
      qs.push({ nums: shuffle(s.nums.slice()), gcd: s.gcd });
    }

    const keep = Math.min(40, Math.floor(all.length / 2));
    recent.set(level.id, [...history, ...used].slice(-keep));
    return qs;
  }

  return {
    LEVELS,
    ROUNDS,
    PERFECT_BONUS,
    gcd,
    gcdAll,
    pool,
    makeRound,
    factors,
    multiplier,
    score,
    credit,
    tier,
    HUMAN_MAX,
  };
})();
