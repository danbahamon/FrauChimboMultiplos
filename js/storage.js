const Store = (() => {
  const KEY = 'ggt-quest:v1';
  const MAX_SCORES = 5;
  const defaults = { lang: 'de', sound: true, count: 2, min: 4, max: 40, lastName: '', scores: [] };

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    } catch (e) {
      return { ...defaults };
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      /* storage full or disabled – the game still works for this session */
    }
  }

  function scores() {
    const list = Array.isArray(data.scores) ? data.scores.filter(s => s && typeof s.score === 'number') : [];
    return list.sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);
  }

  return {
    get: key => data[key],
    set(key, value) {
      data[key] = value;
      save();
    },
    scores,
    qualifies(score) {
      const list = scores();
      return score > 0 && (list.length < MAX_SCORES || score > list[list.length - 1].score);
    },
    rankFor(score) {
      return scores().filter(s => s.score >= score).length + 1;
    },
    addScore(entry) {
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const list = scores();
      list.push({ ...entry, id });
      list.sort((a, b) => b.score - a.score);
      data.scores = list.slice(0, MAX_SCORES);
      save();
      return id;
    },
    clearScores() {
      data.scores = [];
      save();
    },
  };
})();
