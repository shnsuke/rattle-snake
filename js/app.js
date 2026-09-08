(function () {
  const { buildSegments, analyze, ZONE_NAMES } = window.RSWorkout;
  const { LEVELS, levelToTemplate } = window.RSProgression;
  const { drawChart, positionMarker, ZONE_COLORS } = window.RSChart;
  const { suggestNextLevel } = window.RSSuggest;

  let ftp = window.RSStorage.getFTP();

  // Suggest tab state: which level is currently shown/selected there.
  let currentLevelIndex = 3;
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
  function fmtDate(iso) {
    return new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
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

  function latestRide() {
    const rides = window.RSStorage.getRideLogs();
    return rides.length ? rides[rides.length - 1] : null;
  }

  // ---------- ① Home ----------
  function renderHome() {
    const ride = latestRide();
    const latestEl = document.getElementById('homeLatest');
    const sugEl = document.getElementById('homeSuggestion');

    if (!ride) {
      latestEl.innerHTML = '<p class="muted">まだワークアウトがアップロードされていません。「②アップロード」タブからCSVを追加してください。</p>';
      sugEl.innerHTML = '<p class="muted">アップロード後にここへ提案が表示されます。</p>';
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'chart';
    canvas.id = 'homeChart';
    const statsDiv = document.createElement('div');
    statsDiv.className = 'stat-grid';
    const zonesDiv = document.createElement('div');
    zonesDiv.className = 'zone-bars';
    latestEl.innerHTML = `<p class="muted">${escapeHtml(ride.label || 'アップロードされたワークアウト')} — ${fmtDate(ride.date)}</p>`;
    latestEl.appendChild(canvas);
    latestEl.appendChild(statsDiv);
    latestEl.appendChild(zonesDiv);
    drawChart(canvas, ride.segments);
    const a = renderStats(statsDiv, ride.segments);
    renderZoneBars(zonesDiv, a);

    const suggestion = suggestNextLevel(ride.segments);
    sugEl.innerHTML = `
      <p><strong>今回のレベル判定:</strong> ${suggestion.matchedLevel.level}. ${escapeHtml(suggestion.matchedLevel.name)}</p>
      <p><strong>ペース評価:</strong> ${suggestion.fatigue.verdict}(後半${suggestion.fatigue.dropPct >= 0 ? '-' : '+'}${Math.abs(suggestion.fatigue.dropPct).toFixed(1)}%) — ${suggestion.fatigue.detail}</p>
      <p><strong>次回の提案:</strong> ${suggestion.recommendedLevel.level}. ${escapeHtml(suggestion.recommendedLevel.name)}</p>
      <p class="muted">${suggestion.rationale}</p>
    `;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- ② Upload ----------
  function handleCsvUpload(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const resultEl = document.getElementById('uploadResult');
      try {
        const segments = window.RSCsvImport.parseCSV(reader.result);
        window.RSStorage.addRideLog({ label: file.name, segments });

        const canvas = document.createElement('canvas');
        canvas.className = 'chart';
        const statsDiv = document.createElement('div');
        statsDiv.className = 'stat-grid';
        resultEl.innerHTML = '<p class="muted">保存しました。「①ホーム」「③提案」「④総合評価」に反映されています。</p>';
        resultEl.appendChild(canvas);
        resultEl.appendChild(statsDiv);
        drawChart(canvas, segments);
        renderStats(statsDiv, segments);

        renderHome();
        initSuggestFromLatestRide();
        renderSuggestTab();
        renderOverall();
      } catch (err) {
        resultEl.innerHTML = `<p class="muted">読み込みエラー: ${escapeHtml(err.message)}</p>`;
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  // ---------- ③ Suggest ----------
  function initSuggestFromLatestRide() {
    const ride = latestRide();
    if (!ride) return;
    const suggestion = suggestNextLevel(ride.segments);
    currentLevelIndex = suggestion.recommendedIndex;
    currentLevelConfig = cloneLevel(LEVELS[currentLevelIndex]);
  }

  function renderSuggestBasis() {
    const ride = latestRide();
    const el = document.getElementById('suggestBasis');
    if (!ride) {
      el.innerHTML = '<p class="muted">アップロード履歴がないため、基準レベル(Original Rattlesnake)を表示しています。</p>';
      return;
    }
    const suggestion = suggestNextLevel(ride.segments);
    el.innerHTML = `
      <h3>判定の根拠</h3>
      <p class="muted">${escapeHtml(ride.label || '')} (${fmtDate(ride.date)}) を解析: レベル${suggestion.matchedLevel.level}相当・${suggestion.fatigue.verdict}</p>
      <p>${suggestion.rationale}</p>
    `;
  }

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
      <h3>${l.level}. ${escapeHtml(l.name)} <span class="muted">(${escapeHtml(l.week)})</span></h3>
      <p>${escapeHtml(l.note)}</p>
      <p class="muted">${l.sets}セット × ${l.reps}本 / オン${l.onDuration}秒@${l.onPower}% ・ オフ${l.offDuration}秒@${l.offPower}% / キック${l.kickDuration}秒@${l.kickPower}% / セット間回復${l.interSetRecovery}秒</p>
    `;
    renderCustomGrid();
    recomputeLevel();
  }

  function renderSuggestTab() {
    renderSuggestBasis();
    renderLevelChips();
    renderLevelDetail();
  }

  // ---------- ④ Overall ----------
  function drawTrendChart(canvas, points) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    const cssH = 180;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (!points.length) return;

    const padL = 34, padR = 10, padT = 12, padB = 20;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;
    const maxTss = Math.max(20, ...points.map((p) => p.tss)) * 1.15;
    const barW = Math.min(36, plotW / points.length - 6);

    points.forEach((p, i) => {
      const cx = padL + (plotW / points.length) * (i + 0.5);
      const barH = (p.tss / maxTss) * plotH;
      ctx.fillStyle = ZONE_COLORS[Math.min(6, Math.max(1, p.levelIndex >= 5 ? 6 : p.levelIndex >= 3 ? 5 : 2))];
      ctx.fillRect(cx - barW / 2, padT + plotH - barH, barW, barH);
      ctx.fillStyle = 'rgba(120,120,120,0.9)';
      ctx.font = '9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Lv${p.levelIndex}`, cx, cssH - 6);
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(120,120,120,0.9)';
    ctx.fillText('TSS', 2, padT + 8);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.strokeRect(padL, padT, plotW, plotH);
  }

  function renderOverall() {
    const rides = window.RSStorage.getRideLogs();
    const summaryEl = document.getElementById('overallSummary');
    const statsEl = document.getElementById('overallStats');
    const listEl = document.getElementById('overallList');
    const trendCanvas = document.getElementById('overallTrendChart');

    if (!rides.length) {
      summaryEl.innerHTML = '<p class="muted">まだアップロードされたワークアウトがありません。</p>';
      statsEl.innerHTML = '';
      listEl.innerHTML = '';
      drawTrendChart(trendCanvas, []);
      return;
    }

    const points = rides.map((r) => {
      const a = analyze(r.segments, ftp);
      const s = suggestNextLevel(r.segments);
      return { ride: r, tss: a.tss, avgPower: a.avgPower, duration: a.totalDuration, levelIndex: s.matchedLevelIndex, fatigue: s.fatigue };
    });

    const totalDuration = points.reduce((s, p) => s + p.duration, 0);
    const avgTss = points.reduce((s, p) => s + p.tss, 0) / points.length;
    statsEl.innerHTML = [
      statCard('アップロード数', points.length),
      statCard('合計時間', fmtTime(totalDuration)),
      statCard('平均TSS', Math.round(avgTss)),
      statCard('直近レベル', 'Lv' + points[points.length - 1].levelIndex),
    ].join('');

    let trendText;
    if (points.length < 2) {
      trendText = 'データが1件のみのため、傾向はまだ判定できません。アップロードを重ねると、レベルやTSSの推移が分かるようになります。';
    } else {
      const half = Math.floor(points.length / 2);
      const firstAvgLevel = points.slice(0, half).reduce((s, p) => s + p.levelIndex, 0) / half;
      const secondAvgLevel = points.slice(points.length - half).reduce((s, p) => s + p.levelIndex, 0) / half;
      const firstAvgTss = points.slice(0, half).reduce((s, p) => s + p.tss, 0) / half;
      const secondAvgTss = points.slice(points.length - half).reduce((s, p) => s + p.tss, 0) / half;
      if (secondAvgLevel - firstAvgLevel > 0.4) {
        trendText = `レベルが平均Lv${firstAvgLevel.toFixed(1)}→Lv${secondAvgLevel.toFixed(1)}へ上昇しており、順調に強度を上げられています(TSSも${Math.round(firstAvgTss)}→${Math.round(secondAvgTss)})。`;
      } else if (firstAvgLevel - secondAvgLevel > 0.4) {
        trendText = `レベルが平均Lv${firstAvgLevel.toFixed(1)}→Lv${secondAvgLevel.toFixed(1)}へ低下しています。疲労が蓄積している可能性があるため、回復を優先することを検討してください。`;
      } else {
        trendText = `直近はLv${secondAvgLevel.toFixed(1)}前後で安定しています(TSS平均${Math.round(secondAvgTss)})。同じ強度を数回繰り返して定着させるか、後半失速が少なければ次のレベルへ進む提案が③タブに出ます。`;
      }
    }
    summaryEl.innerHTML = `<h3>傾向</h3><p>${trendText}</p>`;

    drawTrendChart(trendCanvas, points);

    listEl.innerHTML = points.slice().reverse().map((p) => `
      <div class="history-item">
        <strong>${escapeHtml(p.ride.label || 'ワークアウト')}</strong> — ${fmtDate(p.ride.date)}<br>
        ${fmtTime(p.duration)} / 平均${Math.round(p.avgPower)}W / TSS ${Math.round(p.tss)} / 判定レベル Lv${p.levelIndex} (${escapeHtml(LEVELS[p.levelIndex].name)}) / ${p.fatigue.verdict}
      </div>
    `).join('');
  }

  // ---------- Player ----------
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
    alert('ワークアウト完了！お疲れ様でした。実際のライドデータをお持ちの場合は「②アップロード」からCSVを追加すると評価が更新されます。');
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
  function switchTab(name) {
    document.querySelector(`.tab[data-tab="${name}"]`).click();
  }

  // ---------- Seed & init ----------
  function seedSampleRideIfEmpty() {
    if (window.RSStorage.getRideLogs().length > 0) return Promise.resolve();
    return fetch('data/rattlesnake_original_ride.csv')
      .then((r) => r.text())
      .then((text) => {
        const segments = window.RSCsvImport.parseCSV(text);
        window.RSStorage.addRideLog({ label: 'サンプル: 元のRattlesnakeライド', segments });
      })
      .catch(() => {});
  }

  function init() {
    initTabs();

    seedSampleRideIfEmpty().then(() => {
      renderHome();
      initSuggestFromLatestRide();
      renderSuggestTab();
      renderOverall();
    });

    document.getElementById('ftpInput').value = ftp;
    document.getElementById('ftpInput').addEventListener('change', (e) => {
      const v = parseFloat(e.target.value);
      if (Number.isFinite(v) && v > 0) {
        ftp = v;
        window.RSStorage.setFTP(ftp);
        renderHome();
        recomputeLevel();
        renderOverall();
      }
    });

    document.getElementById('csvFile').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) handleCsvUpload(file);
    });

    document.getElementById('homeGoSuggest').addEventListener('click', () => {
      switchTab('suggest');
    });

    document.getElementById('btnUseInPlayer').addEventListener('click', () => {
      loadIntoPlayer(currentSegments, `${currentLevelConfig.level}. ${currentLevelConfig.name}`);
      switchTab('player');
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

    document.getElementById('btnClearRides').addEventListener('click', () => {
      if (confirm('アップロード履歴を全て削除しますか？')) {
        window.RSStorage.clearRideLogs();
        renderHome();
        renderSuggestTab();
        renderOverall();
      }
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(() => {});
      });
    }

    window.addEventListener('resize', () => {
      const ride = latestRide();
      if (ride) drawChart(document.querySelector('#homeLatest canvas'), ride.segments);
      drawChart(document.getElementById('levelChart'), currentSegments);
      if (playerSegments) drawChart(document.getElementById('playerChart'), playerSegments);
      renderOverall();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
