// Claude 대시보드 없이 페이지가 돌도록 dash API를 흉내 내는 작은 런타임.
// 데이터는 data/ 폴더의 파일을 읽고, 필터 값은 메모리에만 둡니다.
(function () {
  const SOURCES = {
    trades: 'data/trades.csv',
    rents: 'data/rents.csv',
    complexes: 'data/complexes.csv',
    poi: 'data/poi.csv',
    gu_shapes: 'data/gu_shapes.json',
    price_index: 'data/price_index.csv',
  };
  const DEFAULTS = { type: 'sale', gu: null, dong: null, apt: null, start: null, end: null };
  const store = {};
  const calcs = {};
  const calcCache = {};
  const draws = new Map();
  const onDatas = [];
  let params = { ...DEFAULTS };
  let queued = false;

  const load = (id) => {
    if (store[id]) return;
    const url = SOURCES[id];
    if (!url) { store[id] = { status: 'missing', data: [] }; return; }
    store[id] = { status: 'loading', data: [] };
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(r.status + ' ' + url))))
      .then((text) => {
        const data = url.endsWith('.json') ? JSON.parse(text) : d3.csvParse(text);
        store[id] = { status: 'ok', data, columns: data.columns || [] };
        schedule();
      })
      .catch((e) => { store[id] = { status: 'error', data: [], message: String(e) }; schedule(); });
  };

  const data = (id) => {
    if (calcs[id]) {
      const c = calcs[id];
      const ins = c.inputs.map((i) => data(i));
      if (ins.some((x) => x.status === 'error')) return { status: 'error', data: [] };
      if (!ins.every((x) => x.status === 'ok')) return { status: 'loading', data: [] };
      const key = ins.map((x) => x.data);
      const prev = calcCache[id];
      if (prev && prev.key.every((k, i) => k === key[i])) return prev.result;
      let result;
      try { result = { status: 'ok', data: c.fn(...key) }; } catch (e) { result = { status: 'error', data: [], message: String(e) }; }
      calcCache[id] = { key, result };
      return result;
    }
    load(id);
    return store[id];
  };

  const runDraw = (name, fn) => {
    document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => {
      if (el.closest('[hidden]')) return;
      try { fn(el); } catch (e) { console.error('draw', name, e); }
    });
  };

  const runAll = () => {
    queued = false;
    onDatas.forEach((fn) => { try { fn(); } catch (e) { console.error('onData', e); } });
    draws.forEach((fn, name) => runDraw(name, fn));
  };

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(runAll);
  }

  window.dash = {
    data,
    calc: (id, def) => { calcs[id] = def; },
    loader: () => {},
    draw: (name, fn) => {
      if (typeof fn === 'function') { draws.set(name, fn); schedule(); return; }
      const f = draws.get(name);
      if (f) runDraw(name, f);
    },
    onData: (fn) => { onDatas.push(fn); schedule(); },
    params: () => ({ ...params }),
    setParams: (obj) => { params = { ...params, ...obj }; schedule(); },
    resetParams: () => { params = { ...DEFAULTS }; schedule(); },
    refresh: () => {},
    setLink: (id) => { try { history.replaceState(null, '', '#' + id); } catch (e) { /* 무시 */ } },
    colors: ['#3E6FD8', '#E0913A', '#3BA88C', '#D9A21B', '#D55C8E', '#7A5BD0', '#5BA3D9', '#8A9A3B'],
  };

  let lastW = 0;
  window.addEventListener('resize', () => {
    const w = document.documentElement.clientWidth;
    if (Math.abs(w - lastW) > 20) { lastW = w; schedule(); }
  });
})();
