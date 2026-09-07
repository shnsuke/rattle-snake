/* Canvas-based interval power chart. No external chart library so the
 * app has zero runtime dependencies (keeps offline install trivial).
 */
(function (global) {
  const ZONE_COLORS = {
    1: '#8aa4b1', 2: '#4f9dd6', 3: '#4fb87a', 4: '#e0b13c',
    5: '#e0752f', 6: '#d1443f', 7: '#8b2fb0',
  };

  function drawChart(canvas, segments, opts) {
    opts = opts || {};
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || canvas.parentElement.clientWidth || 600;
    const cssH = opts.height || 180;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0) || 1;
    const maxPower = Math.max(140, ...segments.map((s) => s.power)) * 1.1;
    const padL = 34, padB = 4, padT = 6, padR = 4;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;

    function x(t) { return padL + (t / totalDuration) * plotW; }
    function y(p) { return padT + plotH - (p / maxPower) * plotH; }

    // FTP reference line (100%)
    ctx.strokeStyle = 'rgba(120,120,120,0.6)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, y(100));
    ctx.lineTo(cssW - padR, y(100));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'var(--text-dim, #888)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('FTP', 2, y(100) + 3);

    segments.forEach((seg) => {
      const x0 = x(seg.start);
      const x1 = x(seg.start + seg.duration);
      const yTop = y(seg.power);
      const yBase = y(0);
      ctx.fillStyle = ZONE_COLORS[seg.zone] || '#999';
      ctx.fillRect(x0, yTop, Math.max(1, x1 - x0), yBase - yTop);
    });

    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.strokeRect(padL, padT, plotW, plotH);
  }

  const PAD_L = 34, PAD_R = 4;

  // Positions a plain DOM marker over the (already drawn, static) chart
  // canvas instead of redrawing the whole chart every player tick --
  // redrawing a canvas at 60fps causes needless layout churn.
  function positionMarker(canvas, markerEl, totalDuration, elapsedSeconds) {
    const cssW = canvas.clientWidth || 0;
    const plotW = cssW - PAD_L - PAD_R;
    const frac = totalDuration > 0 ? elapsedSeconds / totalDuration : 0;
    markerEl.style.left = `${PAD_L + frac * plotW}px`;
  }

  global.RSChart = { drawChart, positionMarker, ZONE_COLORS, PAD_L, PAD_R };
})(window);
