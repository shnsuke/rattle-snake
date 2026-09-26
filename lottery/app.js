(() => {
  'use strict';

  const COLORS = ['#ffcc4d', '#7bdff2', '#b2f7a3', '#f7a8c4', '#c7b3ff', '#ffb37b', '#9fe6d0', '#f2e87b', '#a3c9ff', '#ffd1dc'];
  const MAX_PEOPLE = 200;
  const MAX_OPTIONS = 30;
  const STORAGE_KEY = 'lottery-settings-v1';

  const $ = (id) => document.getElementById(id);
  const peopleInput = $('people');
  const optionsInput = $('options');
  const manualCount = $('manual-count');
  const optionList = $('option-list');
  const countStatus = $('count-status');
  const countHint = $('count-hint');
  const namesInput = $('names');
  const startBtn = $('start');

  // 選択肢ごとの名前と本数（本数は手動指定時のみ使用）
  let options = [
    { name: '当たり', count: 1 },
    { name: 'はずれ', count: 3 },
  ];
  let lastDraw = null; // { participants: [...], results: [...] }

  // ---------- 乱数（crypto があれば使う） ----------
  function randomInt(max) {
    if (window.crypto && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      const limit = Math.floor(0x100000000 / max) * max; // 偏り除去
      do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- 保存・復元 ----------
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        people: getPeople(), options, manual: manualCount.checked, names: namesInput.value,
      }));
    } catch (e) { /* 保存できなくても動作には影響なし */ }
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!s) return;
      peopleInput.value = clamp(s.people, 1, MAX_PEOPLE);
      if (Array.isArray(s.options) && s.options.length) options = s.options.slice(0, MAX_OPTIONS);
      manualCount.checked = !!s.manual;
      namesInput.value = s.names || '';
    } catch (e) { /* 壊れたデータは無視 */ }
  }

  // ---------- 設定画面 ----------
  function clamp(v, min, max) {
    v = parseInt(v, 10);
    if (Number.isNaN(v)) v = min;
    return Math.min(max, Math.max(min, v));
  }
  const getPeople = () => clamp(peopleInput.value, 1, MAX_PEOPLE);

  function defaultName(i) {
    if (i < 26) return String.fromCharCode(65 + i); // A, B, C...
    return `選択肢${i + 1}`;
  }

  function setOptionCount(n) {
    n = clamp(n, 1, MAX_OPTIONS);
    while (options.length < n) options.push({ name: defaultName(options.length), count: 0 });
    options.length = n;
    optionsInput.value = n;
  }

  // 均等割り: 各選択肢 floor(N/M) 本、余りは表示上は先頭から（実際の抽選では余りの行き先もランダム）
  function evenCounts(people, m) {
    const base = Math.floor(people / m);
    const rem = people % m;
    return Array.from({ length: m }, (_, i) => base + (i < rem ? 1 : 0));
  }

  function renderOptions() {
    const people = getPeople();
    const manual = manualCount.checked;
    const even = evenCounts(people, options.length);
    const rem = people % options.length;
    optionList.innerHTML = '';
    options.forEach((opt, i) => {
      const li = document.createElement('li');
      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = COLORS[i % COLORS.length];
      const name = document.createElement('input');
      name.className = 'opt-name';
      name.type = 'text';
      name.value = opt.name;
      name.placeholder = defaultName(i);
      name.addEventListener('input', () => { opt.name = name.value; save(); });
      li.append(sw, name);
      if (manual) {
        const cnt = document.createElement('input');
        cnt.className = 'opt-count';
        cnt.type = 'number';
        cnt.inputMode = 'numeric';
        cnt.min = 0;
        cnt.value = opt.count;
        cnt.setAttribute('aria-label', `${opt.name || defaultName(i)}の本数`);
        cnt.addEventListener('input', () => {
          opt.count = Math.max(0, parseInt(cnt.value, 10) || 0);
          updateCountStatus();
          save();
        });
        li.append(cnt, document.createTextNode('本'));
      } else {
        const auto = document.createElement('span');
        auto.className = 'opt-count-auto';
        const b = Math.floor(people / options.length);
        auto.textContent = rem ? `${b}〜${b + 1}本` : `${even[i]}本`;
        li.append(auto);
      }
      optionList.append(li);
    });
    countHint.textContent = manual
      ? '各選択肢の本数を指定します（合計＝人数）。人数を変えると最後の選択肢で調整します。'
      : '人数を選択肢に均等に割り振ります（余りの行き先もランダム）。';
    updateCountStatus();
  }

  function updateCountStatus() {
    if (!manualCount.checked) {
      countStatus.hidden = true;
      startBtn.disabled = false;
      return;
    }
    const people = getPeople();
    const total = options.reduce((s, o) => s + (o.count || 0), 0);
    countStatus.hidden = false;
    const ok = total === people;
    countStatus.classList.toggle('error', !ok);
    countStatus.textContent = ok
      ? `合計 ${total}本 / ${people}人 ✓`
      : `合計 ${total}本 / ${people}人（${total < people ? `あと${people - total}本足りません` : `${total - people}本多いです`}）`;
    startBtn.disabled = !ok;
  }

  // 手動指定時、人数や選択肢数が変わったら最後の選択肢で過不足を吸収する
  function absorbIntoLast() {
    if (!manualCount.checked) return;
    const others = options.slice(0, -1).reduce((s, o) => s + (o.count || 0), 0);
    options[options.length - 1].count = Math.max(0, getPeople() - others);
  }

  function onPeopleChanged() {
    peopleInput.value = getPeople();
    absorbIntoLast();
    renderOptions();
    save();
  }

  document.querySelectorAll('[data-step]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const delta = parseInt(btn.dataset.delta, 10);
      if (btn.dataset.step === 'people') {
        peopleInput.value = getPeople() + delta;
        onPeopleChanged();
      } else {
        setOptionCount(options.length + delta);
        absorbIntoLast();
        renderOptions();
        save();
      }
    });
  });
  peopleInput.addEventListener('change', onPeopleChanged);
  optionsInput.addEventListener('change', () => { setOptionCount(optionsInput.value); absorbIntoLast(); renderOptions(); save(); });
  manualCount.addEventListener('change', () => {
    if (manualCount.checked) {
      // 手動に切り替えたとき、初期値として均等割りの本数を入れておく
      const even = evenCounts(getPeople(), options.length);
      options.forEach((o, i) => { o.count = even[i]; });
    }
    renderOptions();
    save();
  });
  namesInput.addEventListener('input', save);

  // ---------- 抽選 ----------
  function participantNames(people) {
    const lines = namesInput.value.split('\n').map((s) => s.trim()).filter(Boolean);
    return Array.from({ length: people }, (_, i) => lines[i] || `${i + 1}番`);
  }

  function makeDraw() {
    const people = getPeople();
    let counts;
    if (manualCount.checked) {
      counts = options.map((o) => o.count || 0);
    } else {
      // 余りをどの選択肢に回すかもランダムにする
      const m = options.length;
      const base = Math.floor(people / m);
      const extra = new Set(shuffle([...Array(m).keys()]).slice(0, people % m));
      counts = options.map((_, i) => base + (extra.has(i) ? 1 : 0));
    }
    const pool = [];
    counts.forEach((c, i) => { for (let k = 0; k < c; k++) pool.push(i); });
    shuffle(pool);
    lastDraw = { participants: participantNames(people), results: pool };
  }

  function optionLabel(i) {
    return (options[i].name || '').trim() || defaultName(i);
  }

  function renderTickets() {
    const box = $('tickets');
    box.innerHTML = '';
    lastDraw.participants.forEach((who, idx) => {
      const r = lastDraw.results[idx];
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'ticket';
      t.setAttribute('aria-label', `${who}のくじ`);
      t.innerHTML = '<div class="inner"><div class="face front"><span class="who"></span><span class="q">?</span></div>'
        + '<div class="face back"><span class="who"></span><span class="result"></span></div></div>';
      t.querySelectorAll('.who').forEach((el) => { el.textContent = who; });
      const back = t.querySelector('.back');
      back.style.background = COLORS[r % COLORS.length];
      t.querySelector('.result').textContent = optionLabel(r);
      t.addEventListener('click', () => {
        if (t.classList.contains('open')) return;
        t.classList.add('open');
        t.setAttribute('aria-label', `${who}: ${optionLabel(r)}`);
        if (navigator.vibrate) navigator.vibrate(30);
      });
      box.append(t);
    });
  }

  function renderSummary() {
    const body = $('summary-body');
    body.innerHTML = '';
    options.forEach((_, i) => {
      const members = lastDraw.participants.filter((_, idx) => lastDraw.results[idx] === i);
      const g = document.createElement('div');
      g.className = 'group';
      g.style.borderLeftColor = COLORS[i % COLORS.length];
      const h = document.createElement('h3');
      h.textContent = optionLabel(i) + ' ';
      const n = document.createElement('span');
      n.textContent = `${members.length}人`;
      h.append(n);
      g.append(h);
      if (members.length) {
        const ul = document.createElement('ul');
        members.forEach((m) => { const li = document.createElement('li'); li.textContent = m; ul.append(li); });
        g.append(ul);
      }
      body.append(g);
    });
  }

  function show(id) {
    ['setup', 'draw', 'summary'].forEach((s) => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  startBtn.addEventListener('click', () => { makeDraw(); renderTickets(); show('draw'); });
  $('redraw').addEventListener('click', () => {
    if (!confirm('今のくじを破棄して引き直しますか？')) return;
    makeDraw(); renderTickets(); window.scrollTo(0, 0);
  });
  $('back').addEventListener('click', () => show('setup'));
  $('reveal-all').addEventListener('click', () => {
    if (!confirm('全員のくじを開きますか？')) return;
    document.querySelectorAll('.ticket').forEach((t) => t.click());
  });
  $('show-summary').addEventListener('click', () => {
    if (!confirm('結果一覧を表示しますか？（全員の結果が見えます）')) return;
    renderSummary(); show('summary');
  });
  $('summary-back').addEventListener('click', () => show('draw'));

  // ---------- オフライン対応 ----------
  const badge = $('offline-badge');
  const updateOnline = () => { badge.hidden = navigator.onLine; };
  window.addEventListener('online', updateOnline);
  window.addEventListener('offline', updateOnline);
  updateOnline();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  // ---------- 初期化 ----------
  load();
  setOptionCount(options.length);
  renderOptions();
})();
