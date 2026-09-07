/* Intensity progression for the Rattlesnake VO2max session.
 * Each level keeps the workout's identity (kick + 30/15-style on/off
 * blocks across 3-4 sets) but overloads it along four independent
 * axes: on-power, off-power (recovery depth), reps/sets (volume),
 * and inter-set recovery (density). Levels are meant to map to
 * successive weeks of a mesocycle, with level 0 as a deload.
 */
(function (global) {
  const LEVELS = [
    {
      level: 0, name: 'Deload / Easy', week: '回復週',
      sets: 2, reps: 8, onDuration: 25, offDuration: 15,
      onPower: 100, offPower: 55, kickPower: 120, kickDuration: 45,
      interSetRecovery: 360,
      note: '疲労が溜まっている週向け。本数・強度を落として神経系だけ刺激する。',
    },
    {
      level: 1, name: 'Base 1', week: '第1週',
      sets: 3, reps: 10, onDuration: 30, offDuration: 15,
      onPower: 103, offPower: 52, kickPower: 125, kickDuration: 50,
      interSetRecovery: 330,
      note: '導入週。オリジナルよりやや軽め。フォーム確認とペーシング習得。',
    },
    {
      level: 2, name: 'Base 2', week: '第2週',
      sets: 3, reps: 11, onDuration: 30, offDuration: 15,
      onPower: 105, offPower: 51, kickPower: 128, kickDuration: 55,
      interSetRecovery: 315,
      note: 'オン強度を+2%、本数を+1。',
    },
    {
      level: 3, name: 'Original Rattlesnake', week: '第3週 (基準)',
      sets: 3, reps: 12, onDuration: 30, offDuration: 15,
      onPower: 107, offPower: 50, kickPower: 130, kickDuration: 60,
      interSetRecovery: 300,
      note: 'アップロードされた実走に最も近い基準ワークアウト。',
    },
    {
      level: 4, name: 'Build 1', week: '第4週',
      sets: 3, reps: 13, onDuration: 30, offDuration: 15,
      onPower: 109, offPower: 50, kickPower: 132, kickDuration: 60,
      interSetRecovery: 285,
      note: '本数+1、オン強度+2%。オフ強度は据え置きで回復の質を保つ。',
    },
    {
      level: 5, name: 'Build 2', week: '第5週',
      sets: 3, reps: 14, onDuration: 30, offDuration: 15,
      onPower: 111, offPower: 48, kickPower: 134, kickDuration: 60,
      interSetRecovery: 270,
      note: 'セット間回復を短縮し密度を上げる。オフパワーを少し下げて回復の質は確保。',
    },
    {
      level: 6, name: 'Peak 1', week: '第6週',
      sets: 3, reps: 12, onDuration: 40, offDuration: 20,
      onPower: 112, offPower: 48, kickPower: 136, kickDuration: 60,
      interSetRecovery: 255,
      note: 'オン/オフを40/20秒化し1本あたりのVO2max滞在時間を延長（セット数・本数は据え置きで総時間の急増を抑える）。',
    },
    {
      level: 7, name: 'Peak 2 / Test', week: '第7週',
      sets: 3, reps: 13, onDuration: 40, offDuration: 20,
      onPower: 115, offPower: 46, kickPower: 140, kickDuration: 60,
      interSetRecovery: 240,
      note: 'ピーク週。次のメゾサイクル前にFTP/VO2maxを実質的にテストする強度。',
    },
  ];

  function levelToTemplate(levelDef, opts) {
    opts = opts || {};
    const warmup = opts.warmupDuration != null ? opts.warmupDuration : 900;
    const cooldown = opts.cooldownDuration != null ? opts.cooldownDuration : 630;
    const warmupPower = opts.warmupPower != null ? opts.warmupPower : 55;
    const cooldownPower = opts.cooldownPower != null ? opts.cooldownPower : 45;
    const recoveryPower = opts.recoveryPower != null ? opts.recoveryPower : 60;

    const blocks = [{ type: 'steady', duration: warmup, power: warmupPower, label: 'Warm-up' }];
    for (let s = 1; s <= levelDef.sets; s++) {
      blocks.push({
        type: 'intervals',
        setNumber: s,
        kick: { duration: levelDef.kickDuration, power: levelDef.kickPower },
        reps: levelDef.reps,
        on: { duration: levelDef.onDuration, power: levelDef.onPower },
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
