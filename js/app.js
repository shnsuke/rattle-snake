(function () {
  const { buildSegments, analyze, baseTemplate, ZONE_NAMES } = window.RSWorkout;
  const { LEVELS, levelToTemplate } = window.RSProgression;
  const { drawChart, positionMarker, ZONE_COLORS } = window.RSChart;

  let ftp = window.RSStorage.getFTP();
  let currentLevelIndex = window.RSStorage.getLastLevel();
  let currentLevelConfig = cloneLevel(LEVELS[currentLevelIndex]);
  let currentTemplate = levelToTemplate(currentLevelConfig);
  let currentSegments = buildSegments(currentTemplate);

  let player = null;
  let playerSegments = null;
  let playerMeta = null;

  function cloneLevel(l) { return JSON.parse(JSON.stringify(l)); }

  function fmtTime(totalSeconds) {
    totalSeconds = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function statCard(label, value) {
    return `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div></div>`;
  }

  function renderStats(container, seg) {
    const a = analyze(seg, ftp);
    container.innerHTML = [
      statCard('時間', fmtTime(a.totalDuration)),
      statCard('平均パワー', Math.round(a.avgPower) + ' W'),
      statCard('NP', Math.round(a.normalizedPower) + ' W'),
      statCard('IF', a.intensityFactor.toFixed(2)),
      statCard('TSS', Math.round(a.tss)),
      statCard('VO2max滞在(≥105%)', fmtTime(a.vo2Time)),
    ].join('');
    return a;
  }

  function renderZoneBars(container, a) {
    const total = a.totalDuration;
    let html = '';
    for (let z = 1; z <= 6; z++) {
      const t = a.zoneTime[z] || 0;
      if (!t) continue;
      const pct = (t / total) * 100;
      html += `<div class="zone-row">
        <span class="swatch" style="background:${ZONE_COLORS[z]}"></span>
        <span style="width:6.5em">${ZONE_NAMES[z]}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${ZONE_COLORS[z]}"></span></span>
        <span class="pct">${pct.toFixed(0)}%</span>
      </div>`;
    }
    container.innerHTML = html;
  }

  // ---------- Overview tab ----------
  function renderOverview() {
    const seg = buildSegments(baseTemplate());
    const canvas = document.getElementById('overviewChart');
    drawChart(canvas, seg);
    const a = renderStats(document.getElementById('overviewStats'), seg);
    renderZoneBars(document.getElementById('overviewZones'), a);
    const notes = [
      `推定FTP ${Math.round(ftp)}W を基準に算出。ウォームアップ15分 → (60秒キック130% + 30/15秒インターバル×12本)を3セット、セット間5分回復 → クールダウン10:30という構成。`,
      `オン区間は105〜110%FTP(Z5)、オフ区間は50%FTP(Z1)で、各セット冒頭に130%FTPの"キック"を入れて素早くVO2maxへ到達させる、いわゆる 30/15プロトコル の典型的な設計です。`,
      `VO2max帯(≥105%)滞在時間は約${fmtTime(a.vo2Time)}で、総時間${fmtTime(a.totalDuration)}に対して効率よくVO2max刺激を稼げています。`,
      `TSS ${Math.round(a.tss)}前後、IF ${a.intensityFactor.toFixed(2)}は、高強度インターバル日として適切な負荷です。翌日は回復日にするのが推奨です。`,
      `改善点: セット1本目の後半でオフ強度が乱れる(実測データでは1回だけ61秒の緩い回復が混入)傾向があり、ペーシングか疲労管理に注意。`,
    ];
    document.getElementById('overviewNotes').innerHTML = notes.map((n) => `<li>${n}</li>`).join('');
  }

  // ---------- Levels tab ----------
  function renderLevelChips() {
    const wrap = document.getElementById('levelSelect');
    wrap.innerHTML = LEVELS.map((l, i) =>
      `<button class="level-chip ${i === currentLevelIndex ? 'active' : ''}" data-idx="${i}">${l.level}. ${l.name}</button>`
    ).join('');
    wrap.querySelectorAll('.level-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentLevelIndex = parseInt(btn.dataset.idx, 10);
        currentLevelConfig = cloneLevel(LEVELS[currentLevelIndex]);
        window.RSStorage.setLastLevel(currentLevelIndex);
        renderLevelChips();
        renderLevelDetail();
      });
    });
  }

  const CUSTOM_FIELDS = [
    ['sets', 'セット数'], ['reps', '本数/セット'],
    ['onDuration', 'オン秒数'], ['offDuration', 'オフ秒数'],
    ['onPower', 'オン強度 %FTP'], ['offPower', 'オフ強度 %FTP'],
    ['kickPower', 'キック強度 %FTP'], ['kickDuration', 'キック秒数'],
    ['interSetRecovery', 'セット間回復 秒'],
  ];

  function renderCustomGrid() {
    const grid = document.getElementById('customGrid');
    grid.innerHTML = CUSTOM_FIELDS.map(([key, label]) =>
      `<label>${label}<input type="number" data-key="${key}" value="${currentLevelConfig[key]}"></label>`
    ).join('');
    grid.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        if (Number.isFinite(v)) {
          currentLevelConfig[input.dataset.key] = v;
          recomputeLevel();
        }
      });
    });
  }

  function recomputeLevel() {
    currentTemplate = levelToTemplate(currentLevelConfig);
    currentSegments = buildSegments(currentTemplate);
    drawChart(document.getElementById('levelChart'), currentSegments);
    renderStats(document.getElementById('levelStats'), currentSegments);
  }

  function renderLevelDetail() {
    const l = currentLevelConfig;
    document.getElementById('levelDetail').innerHTML = `
      <h3>${l.level}. ${l.name} <span class="muted">(${l.week})</span></h3>
      <p>${l.note}</p>
      <p class="muted">${l.sets}セット × ${l.reps}本 / オン${l.onDuration}秒@${l.onPower}% ・ オフ${l.offDuration}秒@${l.offPower}% / キック${l.kickDuration}秒@${l.kickPower}% / セット間回復${l.interSetRecovery}秒</p>
    `;
    renderCustomGrid();
    recomputeLevel();
  }

  // ---------- Player tab ----------
  function loadIntoPlayer(segments, name) {
    playerSegments = segments;
    playerMeta = { name };
    document.getElementById('playerWorkoutName').textContent = name;
    drawChart(document.getElementById('playerChart'), segments);
    if (player) player.pause();
    player = new window.RSPlayer.Player(segments, {
      onTick: renderPlayerState,
      onSegmentChange: renderPlayerState,
      onFinish: onWorkoutFinish,
    });
    renderPlayerState(player._state());
  }

  function renderPlayerState(state) {
    document.getElementById('segLabel').textContent = state.segment.label;
    document.getElementById('segPower').textContent = `${state.segment.power}% FTP`;
    document.getElementById('segWatts').textContent = `${Math.round(ftp * state.segment.power / 100)} W`;
    document.getElementById('segRemain').textContent = fmtTime(state.remainingInSegment);
    document.getElementById('totalRemain').textContent = fmtTime(state.remainingTotal);
    positionMarker(document.getElementById('playerChart'), document.getElementById('playerMarker'), state.totalDuration, state.elapsed);
  }

  function onWorkoutFinish() {
    const a = analyze(playerSegments, ftp);
    window.RSStorage.addHistoryEntry({
      name: playerMeta.name,
      duration: a.totalDuration,
      tss: Math.round(a.tss),
      avgPower: Math.round(a.avgPower),
    });
    renderHistory();
    alert('ワークアウト完了！お疲れ様でした。');
  }

  // ---------- Import/compare tab ----------
  function renderImportResult(segments) {
    const a = analyze(segments, ftp);
    const planned = analyze(currentSegments, ftp);
    const el = document.getElementById('importResult');
    const canvas = document.createElement('canvas');
    canvas.className = 'chart';
    el.innerHTML = '';
    el.appendChild(canvas);
    drawChart(canvas, segments);
    el.innerHTML += `
      <div class="compare-row"><strong>実走</strong>: 時間 ${fmtTime(a.totalDuration)} / 平均${Math.round(a.avgPower)}W / NP${Math.round(a.normalizedPower)}W / TSS ${Math.round(a.tss)} / VO2max滞在 ${fmtTime(a.vo2Time)}</div>
      <div class="compare-row"><strong>計画(${currentLevelConfig.name})</strong>: 時間 ${fmtTime(planned.totalDuration)} / 平均${Math.round(planned.avgPower)}W / NP${Math.round(planned.normalizedPower)}W / TSS ${Math.round(planned.tss)} / VO2max滞在 ${fmtTime(planned.vo2Time)}</div>
    `;
  }

  // ---------- History tab ----------
  function renderHistory() {
    const list = window.RSStorage.getHistory();
    const el = document.getElementById('historyList');
    if (!list.length) { el.innerHTML = '<p class="muted">まだ記録がありません。</p>'; return; }
    el.innerHTML = list.map((h) => `
      <div class="history-item">
        <strong>${h.name}</strong> — ${new Date(h.date).toLocaleString('ja-JP')}<br>
        ${fmtTime(h.duration)} / 平均${h.avgPower}W / TSS ${h.tss}
      </div>
    `).join('');
  }

  // ---------- Tabs ----------
  function initTabs() {
    document.querySelectorAll('.tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tabpanel').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  // ---------- wiring ----------
  function init() {
    initTabs();
    renderOverview();
    renderLevelChips();
    renderLevelDetail();
    renderHistory();

    document.getElementById('ftpInput').value = ftp;
    document.getElementById('ftpInput').addEventListener('change', (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isFinite(v) && v > 0) {
        ftp = v;
        window.RSStorage.setFTP(ftp);
        renderOverview();
        recomputeLevel();
      }
    });

    document.getElementById('btnUseInPlayer').addEventListener('click', () => {
      loadIntoPlayer(currentSegments, `${currentLevelConfig.level}. ${currentLevelConfig.name}`);
      document.querySelector('.tab[data-tab="player"]').click();
    });

    document.getElementById('btnExportZwo').addEventListener('click', () => {
      window.RSExport.downloadZWO(currentTemplate, {
        name: `Rattlesnake Lv${currentLevelConfig.level} ${currentLevelConfig.name}`,
        description: currentLevelConfig.note,
      });
    });

    document.getElementById('btnStart').addEventListener('click', () => {
      if (!player) loadIntoPlayer(currentSegments, `${currentLevelConfig.level}. ${currentLevelConfig.name}`);
      player.start();
    });
    document.getElementById('btnPause').addEventListener('click', () => player && player.pause());
    document.getElementById('btnReset').addEventListener('click', () => player && player.reset());
    document.getElementById('btnBack10').addEventListener('click', () => player && player.skip(-10));
    document.getElementById('btnFwd10').addEventListener('click', () => player && player.skip(10));

    document.getElementById('csvFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const segments = window.RSCsvImport.parseCSV(reader.result);
          renderImportResult(segments);
        } catch (err) {
          document.getElementById('importResult').innerHTML = `<p class="muted">読み込みエラー: ${err.message}</p>`;
        }
      };
      reader.readAsText(file, 'utf-8');
    });

    document.getElementById('btnClearHistory').addEventListener('click', () => {
      if (confirm('履歴を全て削除しますか？')) {
        window.RSStorage.clearHistory();
        renderHistory();
      }
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
      });
    }

    window.addEventListener('resize', () => {
      drawChart(document.getElementById('overviewChart'), buildSegments(baseTemplate()));
      drawChart(document.getElementById('levelChart'), currentSegments);
      if (playerSegments) drawChart(document.getElementById('playerChart'), playerSegments);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
