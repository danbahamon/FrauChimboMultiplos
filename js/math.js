const GameMath = (() => {
  const BASE_POINTS = 100000;
  const STAR_THRESHOLDS = [1.3, 1.9, 2.8, 3.9];

  const gcd = (a, b) => {
    while (b) [a, b] = [b, a % b];
    return a;
  };
  const gcdAll = nums => nums.reduce((a, b) => gcd(a, b));

  const divisors = n => {
    const out = [];
    for (let i = 1; i <= n; i++) if (n % i === 0) out.push(i);
    return out;
  };

  const primeFactorCount = n => {
    let c = 0;
    for (let p = 2; p * p <= n; p++) {
      while (n % p === 0) {
        n /= p;
        c++;
      }
    }
    return n > 1 ? c + 1 : c;
  };

  const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function randomDistinct(count, min, max) {
    const pool = [];
    for (let n = min; n <= max; n++) pool.push(n);
    return shuffle(pool).slice(0, count);
  }

  // More numbers, bigger numbers and a "richer" GCD all make a question harder.
  function difficulty(nums, g) {
    const countF = 1 + (nums.length - 2) * 0.45;
    const sizeF = 0.55 + Math.sqrt(Math.max(...nums)) / 7;
    const gcdF = 1 + Math.min(primeFactorCount(g), 5) * 0.07;
    return countF * sizeF * gcdF;
  }

  function stars(diff) {
    return 1 + STAR_THRESHOLDS.filter(t => diff >= t).length;
  }

  function previewDifficulty(count, max) {
    const typicalLargest = Math.max(2, Math.round(max * 0.85));
    const countF = 1 + (count - 2) * 0.45;
    const sizeF = 0.55 + Math.sqrt(typicalLargest) / 7;
    return countF * sizeF * 1.14;
  }

  // Harder questions get more time before points decay, and a bigger multiplier.
  function score(diff, ms, wrong) {
    const tau = 6000 + 6000 * diff;
    const timeF = tau / (tau + ms);
    const tryF = 1 / (1 + 0.5 * wrong);
    return Math.round(BASE_POINTS * diff * timeF * tryF);
  }

  function build(nums) {
    const g = gcdAll(nums);
    const diff = difficulty(nums, g);
    return { nums, gcd: g, difficulty: diff, stars: stars(diff) };
  }

  function makeQuestion(count, min, max, seen) {
    const candidates = [];
    for (let g = 2; g <= max; g++) {
      const lo = Math.ceil(min / g);
      const hi = Math.floor(max / g);
      if (hi - lo + 1 >= count) candidates.push(g);
    }

    // Numbers are always drawn as multiples of some g >= 2, so the answer is never 1.
    if (!candidates.length) return build(randomDistinct(count, min, max));

    let fallback = null;
    for (let attempt = 0; attempt < 400; attempt++) {
      const g = candidates[randInt(0, candidates.length - 1)];
      const mults = [];
      for (let m = Math.ceil(min / g); m <= Math.floor(max / g); m++) mults.push(m * g);
      const nums = shuffle(mults).slice(0, count);
      fallback = fallback || nums;

      const key = nums.slice().sort((a, b) => a - b).join('-');
      if (seen.has(key)) continue;
      // "The GCD is just the smallest number" is fine sometimes, but shouldn't dominate.
      if (gcdAll(nums) === Math.min(...nums) && attempt < 300 && Math.random() < 0.88) continue;

      seen.add(key);
      return build(nums);
    }
    return build(fallback);
  }

  function makeRound(count, min, max, rounds) {
    const seen = new Set();
    const qs = [];
    for (let i = 0; i < rounds; i++) qs.push(makeQuestion(count, min, max, seen));
    return qs;
  }

  return { gcd, gcdAll, divisors, makeRound, score, stars, previewDifficulty };
})();
