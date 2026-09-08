/* Rattlesnake workout model.
 * A "template" is a list of blocks. Each block is one of:
 *   { type: 'steady', duration, power }
 *   { type: 'intervals', kick: {duration,power}|null,
 *     reps, on: {duration,power}, off: {duration,power} }
 *   { type: 'ladder', kick: {duration,power}|null, setNumber,
 *     onPowers: [pct, pct, ...], onDuration, off: {duration,power} }
 *     -- like 'intervals' but each rep's on-power comes from onPowers[i]
 *        instead of being constant, matching how the reference Zwift
 *        "Rattlesnake" workout steps power down within each set.
 * All power values are %FTP. buildSegments() flattens a template into
 * a flat list of { start, duration, power, label, zone } segments,
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

  // Evenly-stepped sequence from startPct down (or up) to endPct over
  // `count` steps.
  function linearLadder(startPct, endPct, count) {
    if (count <= 1) return [startPct];
    const seq = [];
    for (let i = 0; i < count; i++) {
      seq.push(startPct + (endPct - startPct) * (i / (count - 1)));
    }
    return seq;
  }

  // Power steps down once per block of `blockSize` reps (not every
  // single rep) -- e.g. buildBlockLadder(120, 110, 13, 4) holds reps
  // 1-4 at 120%, 5-8 at ~116.7%, 9-12 at ~113.3%, and 13 at 110%,
  // matching the reference Rattlesnake's within-set structure.
  function buildBlockLadder(startPct, endPct, totalReps, blockSize) {
    const numBlocks = Math.max(1, Math.ceil(totalReps / blockSize));
    const blockValues = linearLadder(startPct, endPct, numBlocks);
    const seq = [];
    for (let i = 0; i < totalReps; i++) {
      seq.push(blockValues[Math.floor(i / blockSize)]);
    }
    return seq;
  }

  function buildSegments(template) {
    const segs = [];
    let t = 0;
    function push(duration, power, label) {
      segs.push({ start: t, duration, power: Math.round(power * 10) / 10, label, zone: zoneForIntensity(power) });
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
      } else if (block.type === 'ladder') {
        if (block.kick) push(block.kick.duration, block.kick.power, `Set ${block.setNumber} Kick`);
        const reps = block.onPowers.length;
        for (let r = 1; r <= reps; r++) {
          push(block.onDuration, block.onPowers[r - 1], `Set ${block.setNumber} On ${r}/${reps}`);
          if (r < reps || block.offAfterLast) {
            push(block.off.duration, block.off.power, `Set ${block.setNumber} Off ${r}/${reps}`);
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

  global.RSWorkout = { buildSegments, analyze, linearLadder, buildBlockLadder, zoneForIntensity, ZONE_NAMES };
})(window);
