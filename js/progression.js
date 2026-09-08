/* Intensity progression for the Rattlesnake VO2max session.
 *
 * Level 3 ("Original Rattlesnake") is calibrated to the reference
 * design: 3 sets of 30s-on/15s-off, 13 reps per set (39 reps total,
 * matching Bent Rønnestad's 30:15 protocol), each set opening with a
 * 60s@140% "kick" and then stepping power down from ~120% to ~110%
 * across the 13 reps (a descending ladder, not a flat interval) --
 * warmup is a 3-stage ramp (45%/65%/80%, 3min each) and both the
 * inter-set recovery and cooldown are 3 minutes, all per that design.
 *
 * Every other level keeps the same shape (kick + descending ladder x
 * N sets) and overloads it along the same independent axes as before:
 * ladder power range, reps/sets, on/off duration, and recovery length.
 */
(function (global) {
  const LEVELS = [
    {
      level: 0, name: 'Deload / Easy', week: '回復週',
      sets: 2, reps: 9, onDuration: 25, offDuration: 15,
      ladderStart: 110, ladderEnd: 102, offPower: 55, kickPower: 125, kickDuration: 45,
      interSetRecovery: 210,
      note: '疲労が溜まっている週向け。本数・強度を落として神経系だけ刺激する。',
    },
    {
      level: 1, name: 'Base 1', week: '第1週',
      sets: 3, reps: 11, onDuration: 30, offDuration: 15,
      ladderStart: 115, ladderEnd: 106, offPower: 52, kickPower: 130, kickDuration: 50,
      interSetRecovery: 195,
      note: '導入週。オリジナルよりやや軽め。フォーム確認とペーシング習得。',
    },
    {
      level: 2, name: 'Base 2', week: '第2週',
      sets: 3, reps: 12, onDuration: 30, offDuration: 15,
      ladderStart: 118, ladderEnd: 108, offPower: 51, kickPower: 135, kickDuration: 55,
      interSetRecovery: 188,
      note: 'ラダーの上限・下限を+3%、本数を+1。',
    },
    {
      level: 3, name: 'Original Rattlesnake', week: '第3週 (基準)',
      sets: 3, reps: 13, onDuration: 30, offDuration: 15,
      ladderStart: 120, ladderEnd: 110, offPower: 50, kickPower: 140, kickDuration: 60,
      interSetRecovery: 180,
      note: '参考にしたZwiftワークアウトの構成そのもの: 60秒140%キック→30秒オン/15秒オフを13本、120%から110%へ徐々に強度を落とすラダー構成。',
    },
    {
      level: 4, name: 'Build 1', week: '第4週',
      sets: 3, reps: 14, onDuration: 30, offDuration: 15,
      ladderStart: 122, ladderEnd: 112, offPower: 50, kickPower: 142, kickDuration: 60,
      interSetRecovery: 172,
      note: '本数+1、ラダーの上限・下限を+2%。',
    },
    {
      level: 5, name: 'Build 2', week: '第5週',
      sets: 3, reps: 15, onDuration: 30, offDuration: 15,
      ladderStart: 124, ladderEnd: 114, offPower: 48, kickPower: 144, kickDuration: 60,
      interSetRecovery: 165,
      note: 'セット間回復を短縮し密度を上げる。オフ強度を少し下げて回復の質は確保。',
    },
    {
      level: 6, name: 'Peak 1', week: '第6週',
      sets: 3, reps: 13, onDuration: 40, offDuration: 20,
      ladderStart: 124, ladderEnd: 114, offPower: 48, kickPower: 146, kickDuration: 60,
      interSetRecovery: 158,
      note: 'オン/オフを40/20秒化し1本あたりのVO2max滞在時間を延長。',
    },
    {
      level: 7, name: 'Peak 2 / Test', week: '第7週',
      sets: 3, reps: 14, onDuration: 40, offDuration: 20,
      ladderStart: 126, ladderEnd: 116, offPower: 46, kickPower: 148, kickDuration: 60,
      interSetRecovery: 150,
      note: 'ピーク週。次のメゾサイクル前にFTP/VO2maxを実質的にテストする強度。',
    },
  ];

  function levelToTemplate(levelDef, opts) {
    opts = opts || {};
    const rampStages = opts.rampStages || [
      { duration: 180, power: 45 },
      { duration: 180, power: 65 },
      { duration: 180, power: 80 },
    ];
    const cooldown = opts.cooldownDuration != null ? opts.cooldownDuration : 180;
    const cooldownPower = opts.cooldownPower != null ? opts.cooldownPower : 50;
    const recoveryPower = opts.recoveryPower != null ? opts.recoveryPower : 50;

    const blocks = rampStages.map((stage, i) => ({
      type: 'steady', duration: stage.duration, power: stage.power,
      label: i === 0 ? 'Warm-up' : 'Warm-up',
    }));
    for (let s = 1; s <= levelDef.sets; s++) {
      blocks.push({
        type: 'ladder',
        setNumber: s,
        kick: { duration: levelDef.kickDuration, power: levelDef.kickPower },
        onPowers: global.RSWorkout.linearLadder(levelDef.ladderStart, levelDef.ladderEnd, levelDef.reps),
        onDuration: levelDef.onDuration,
        off: { duration: levelDef.offDuration, power: levelDef.offPower },
      });
      if (s < levelDef.sets) {
        blocks.push({ type: 'steady', duration: levelDef.interSetRecovery, power: recoveryPower, label: 'Recovery' });
      }
    }
    blocks.push({ type: 'steady', duration: cooldown, power: cooldownPower, label: 'Cool-down' });
    return blocks;
  }

  function customTemplate(cfg, opts) {
    return levelToTemplate(cfg, opts);
  }

  global.RSProgression = { LEVELS, levelToTemplate, customTemplate };
})(window);
