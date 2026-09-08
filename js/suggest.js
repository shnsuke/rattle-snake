/* Turns an uploaded ride's segments into a coaching suggestion:
 * 1) classify each segment as kick/on/off/other by its duration+power
 *    shape (works for any of the 8 progression levels, since they all
 *    share the kick+ladder pattern, just with different numbers), then
 * 2) find the closest LEVELS entry by average on-power/reps/duration,
 * 3) compare each actual on-segment to what THAT LEVEL's ladder expects
 *    at that position -- not a plain first-half-vs-second-half power
 *    drop, since the ladder itself steps power down by design, so a
 *    raw drop would look like "fatigue" even on a perfectly-executed
 *    ride. Falling further behind the plan in the second half of the
 *    ride is the real fatigue signal.
 */
(function (global) {
  function classifySegments(segments) {
    const kicks = [], on = [], off = [], other = [];
    segments.forEach((seg) => {
      if (seg.duration >= 45 && seg.duration <= 90 && seg.power >= 115) {
        kicks.push(seg);
      } else if (seg.duration >= 18 && seg.duration <= 45 && seg.power >= 90) {
        on.push(seg);
      } else if (seg.duration >= 8 && seg.duration <= 25 && seg.power < 75) {
        off.push(seg);
      } else {
        other.push(seg);
      }
    });
    return { kicks, on, off, other };
  }

  function mean(arr, key) {
    if (!arr.length) return 0;
    return arr.reduce((s, x) => s + (key ? x[key] : x), 0) / arr.length;
  }

  function matchLevel(segments) {
    const { kicks, on, off } = classifySegments(segments);
    const sets = Math.max(1, kicks.length || 3);
    const reps = Math.max(1, Math.round(on.length / sets));
    const avgOnPower = mean(on, 'power');
    const avgOffPower = mean(off, 'power');
    const avgOnDuration = mean(on, 'duration');

    const LEVELS = global.RSProgression.LEVELS;
    let bestIdx = 3, bestDist = Infinity;
    LEVELS.forEach((l, idx) => {
      const levelAvgOnPower = (l.ladderStart + l.ladderEnd) / 2;
      const dist =
        Math.abs((avgOnPower || levelAvgOnPower) - levelAvgOnPower) * 3 +
        Math.abs((avgOffPower || l.offPower) - l.offPower) +
        Math.abs((reps * sets) - (l.reps * l.sets)) * 1.5 +
        Math.abs((avgOnDuration || l.onDuration) - l.onDuration) * 0.5;
      if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
    });
    return { levelIndex: bestIdx, sets, reps, avgOnPower, avgOffPower, on, off, kicks };
  }

  // Builds the expected per-rep %FTP sequence for a level, shaped to
  // match the actual ride's set/rep counts so it can be compared 1:1.
  function expectedSequence(levelDef, sets, repsPerSet) {
    const oneSet = global.RSWorkout.linearLadder(levelDef.ladderStart, levelDef.ladderEnd, repsPerSet);
    let seq = [];
    for (let s = 0; s < sets; s++) seq = seq.concat(oneSet);
    return seq;
  }

  function assessFatigue(onSegments, levelDef, sets, repsPerSet) {
    if (onSegments.length < 4) {
      return { dropPct: 0, verdict: 'データ不足', detail: 'オン区間の本数が少なく、判定はできませんでした。' };
    }
    const expected = expectedSequence(levelDef, sets, repsPerSet);
    const n = Math.min(expected.length, onSegments.length);
    const adherence = [];
    for (let i = 0; i < n; i++) {
      if (expected[i] > 0) adherence.push(onSegments[i].power / expected[i]);
    }
    if (adherence.length < 4) {
      return { dropPct: 0, verdict: 'データ不足', detail: '計画との対応が取れず判定できませんでした。' };
    }
    const half = Math.floor(adherence.length / 2);
    const avgFirst = mean(adherence.slice(0, half)) * 100;
    const avgSecond = mean(adherence.slice(adherence.length - half)) * 100;
    const dropPct = avgFirst > 0 ? avgFirst - avgSecond : 0;
    let verdict, detail;
    if (dropPct > 7) {
      verdict = '顕著な後半失速';
      detail = `計画比で前半平均${avgFirst.toFixed(0)}% → 後半平均${avgSecond.toFixed(0)}%まで落ち込んでおり、ラダーの想定以上にペースが落ちています。強度が高すぎた可能性があります。`;
    } else if (dropPct > 3) {
      verdict = '軽度の後半失速';
      detail = `計画比で前半平均${avgFirst.toFixed(0)}% → 後半平均${avgSecond.toFixed(0)}%と、やや計画を下回る程度の低下です。`;
    } else {
      verdict = '安定したペース';
      detail = `計画比で前半平均${avgFirst.toFixed(0)}% → 後半平均${avgSecond.toFixed(0)}%とほぼ計画通りに走れており、余力を残せている可能性があります。`;
    }
    return { dropPct, verdict, detail, avgFirst, avgSecond };
  }

  function suggestNextLevel(segments) {
    const match = matchLevel(segments);
    const LEVELS = global.RSProgression.LEVELS;
    const levelDef = LEVELS[match.levelIndex];
    const fatigue = assessFatigue(match.on, levelDef, match.sets, match.reps);
    let recommendedIndex = match.levelIndex;
    let rationale;
    if (fatigue.dropPct > 7) {
      recommendedIndex = Math.max(0, match.levelIndex - 1);
      rationale = '後半の失速が大きいため、次回は一段階易しいレベルで安定して追い込めるようにすることを提案します。';
    } else if (fatigue.dropPct > 3) {
      recommendedIndex = match.levelIndex;
      rationale = '軽度の失速が見られるため、次回は同じレベルをもう一度行い、ペース配分の安定を優先することを提案します。';
    } else {
      recommendedIndex = Math.min(LEVELS.length - 1, match.levelIndex + 1);
      rationale = '最後まで計画通りのペースを維持できているため、次回は一段階強度を上げることを提案します。';
    }
    return {
      matchedLevelIndex: match.levelIndex,
      matchedLevel: levelDef,
      fatigue,
      recommendedIndex,
      recommendedLevel: LEVELS[recommendedIndex],
      rationale,
      match,
    };
  }

  global.RSSuggest = { classifySegments, matchLevel, assessFatigue, suggestNextLevel };
})(window);
