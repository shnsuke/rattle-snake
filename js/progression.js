/* The Rattlesnake session's shape (reps, sets, on/off/kick durations,
 * block size, warmup/cooldown/recovery) is fixed to the reference
 * design and never changes. The only thing that adapts between
 * sessions is a single intensity number -- the "center" %FTP the
 * within-set ladder is built around -- which js/suggest.js proposes
 * based on the previous ride.
 *
 * Reference (center = 115%): each set opens with a 60s kick at
 * center+25 (140% at the reference), then 13 reps of 30s-on/15s-off
 * stepping down once every 4 reps from center+5 to center-5 (120% to
 * 110% at the reference) -- i.e. Bent Rønnestad's 30:15 protocol
 * (13 reps x 3 sets = 39 reps) as built in the reference Zwift
 * workout.
 */
(function (global) {
  const BASE = {
    sets: 3,
    reps: 13,
    blockSize: 4,
    onDuration: 30,
    offDuration: 15,
    offPower: 50,
    kickDuration: 60,
    kickOffset: 25,   // kick power = center + kickOffset
    ladderSpread: 10, // ladder runs from center+spread/2 down to center-spread/2
    interSetRecovery: 180,
    cooldownDuration: 180,
    cooldownPower: 50,
    rampStages: [
      { duration: 180, power: 45 },
      { duration: 180, power: 65 },
      { duration: 180, power: 80 },
    ],
  };
  const DEFAULT_CENTER = 115;
  const INTENSITY_STEP = 2;

  function buildTemplateForIntensity(center) {
    const ladderStart = center + BASE.ladderSpread / 2;
    const ladderEnd = center - BASE.ladderSpread / 2;
    const kickPower = center + BASE.kickOffset;
    const blocks = BASE.rampStages.map((stage) => ({
      type: 'steady', duration: stage.duration, power: stage.power, label: 'Warm-up',
    }));
    for (let s = 1; s <= BASE.sets; s++) {
      blocks.push({
        type: 'ladder',
        setNumber: s,
        kick: { duration: BASE.kickDuration, power: kickPower },
        onPowers: global.RSWorkout.buildBlockLadder(ladderStart, ladderEnd, BASE.reps, BASE.blockSize),
        onDuration: BASE.onDuration,
        off: { duration: BASE.offDuration, power: BASE.offPower },
      });
      if (s < BASE.sets) {
        blocks.push({ type: 'steady', duration: BASE.interSetRecovery, power: BASE.offPower, label: 'Recovery' });
      }
    }
    blocks.push({ type: 'steady', duration: BASE.cooldownDuration, power: BASE.cooldownPower, label: 'Cool-down' });
    return blocks;
  }

  global.RSProgression = { BASE, DEFAULT_CENTER, INTENSITY_STEP, buildTemplateForIntensity };
})(window);
