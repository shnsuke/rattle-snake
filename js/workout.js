/* Rattlesnake workout model.
 * A "template" is a list of blocks. Each block is either:
 *   { type: 'steady', duration, power }                 -- power in %FTP
 *   { type: 'intervals', kick: {duration,power}|null,
 *     reps, on: {duration,power}, off: {duration,power} }
 * buildSegments() flattens a template into a flat list of
 * { start, duration, power, label } segments in seconds / %FTP,
 * which every other module (chart, player, export, analyzer) consumes.
 */
(function (global) {
  const ZONE_NAMES = ['', 'Z1 Recovery', 'Z2 Endurance', 'Z3 Tempo', 'Z4 Threshold', 'Z5 VO2max', 'Z6 Anaerobic', 'Z7 Neuromuscular'];

  function zoneForIntensity(pct) {
    if (pct < 60) return 1;
    if (pct < 76) return 2;
    if (pct < 90) return 3;
    if (pct < 105) return 4;
    if (pct < 120) return 5;
    if (pct < 150) return 6;
    return 7;
  }

  function buildSegments(template) {
    const segs = [];
    let t = 0;
    function push(duration, power, label) {
      segs.push({ start: t, duration, power, label, zone: zoneForIntensity(power) });
      t += duration;
    }
    template.forEach((block, blockIdx) => {
      if (block.type === 'steady') {
        push(block.duration, block.power, block.label || 'Steady');
      } else if (block.type === 'intervals') {
        if (block.kick) push(block.kick.duration, block.kick.power, `Set ${block.setNumber} Kick`);
        for (let r = 1; r <= block.reps; r++) {
          push(block.on.duration, block.on.power, `Set ${block.setNumber} On ${r}/${block.reps}`);
          if (r < block.reps || block.offAfterLast) {
            push(block.off.duration, block.off.power, `Set ${block.setNumber} Off ${r}/${block.reps}`);
          }
        }
      }
    });
    return segs;
  }

  function analyze(segments, ftp) {
    const totalDuration = segments.reduce((s, seg) => s + seg.duration, 0);
    let sumPower = 0, sumIF2 = 0, sumP4 = 0;
    const zoneTime = {};
    let vo2Time = 0; // time at >=105% (Z5+) which drives VO2max stimulus
    segments.forEach((seg) => {
      const watts = ftp * (seg.power / 100);
      sumPower += watts * seg.duration;
      sumIF2 += seg.duration * Math.pow(seg.power / 100, 2);
      sumP4 += seg.duration * Math.pow(watts, 4);
      zoneTime[seg.zone] = (zoneTime[seg.zone] || 0) + seg.duration;
      if (seg.power >= 105) vo2Time += seg.duration;
    });
    const avgPower = sumPower / totalDuration;
    const np = Math.pow(sumP4 / totalDuration, 0.25);
    const intensityFactor = np / ftp;
    const tss = (totalDuration * np * intensityFactor) / (ftp * 3600) * 100;
    return {
      totalDuration,
      avgPower,
      normalizedPower: np,
      intensityFactor,
      tss,
      zoneTime,
      vo2Time,
      zoneNames: ZONE_NAMES,
    };
  }

  // The "original ride" template, cleaned up to a regular 3x12 30/15s
  // structure (the source ride had one dropped rep in set 1 due to
  // real-world fatigue; the template below is the intended design).
  function baseTemplate() {
    const set = (n) => ({
      type: 'intervals',
      setNumber: n,
      kick: { duration: 60, power: 130 },
      reps: 12,
      on: { duration: 30, power: 107 },
      off: { duration: 15, power: 50 },
    });
    return [
      { type: 'steady', duration: 900, power: 55, label: 'Warm-up' },
      set(1),
      { type: 'steady', duration: 300, power: 60, label: 'Recovery' },
      set(2),
      { type: 'steady', duration: 300, power: 60, label: 'Recovery' },
      set(3),
      { type: 'steady', duration: 630, power: 45, label: 'Cool-down' },
    ];
  }

  global.RSWorkout = { buildSegments, analyze, baseTemplate, zoneForIntensity, ZONE_NAMES };
})(window);
