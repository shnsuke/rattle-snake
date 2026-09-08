/* Turns an uploaded ride's segments into a coaching suggestion:
 * 1) classify each segment as kick/on/off/other by its duration+power
 *    shape (works for any of the 8 progression levels, since they all
 *    share the kick+on/off pattern, just with different numbers), then
 * 2) find the closest LEVELS entry by on-power/reps/duration, and
 * 3) look at how much the on-segment power dropped from the first half
 *    of the ride to the second half -- a plain, explainable proxy for
 *    "did fatigue force the pace down" -- to decide whether to hold,
 *    repeat, or advance a level next time.
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
    return arr.reduce((s, x) => s + x[key], 0) / arr.length;
  }

  function matchLevel(segments) {
    const { kicks, on, off } = classifySegments(segments);
    const sets = Math.max(1, kicks.length || Math.round(on.length / 12) || 1);
    const reps = Math.max(1, Math.round(on.length / sets));
    const avgOnPower = mean(on, 'power');
    const avgOffPower = mean(off, 'power');
    const avgOnDuration = mean(on, 'duration');

    const LEVELS = global.RSProgression.LEVELS;
    let bestIdx = 3, bestDist = Infinity;
    LEVELS.forEach((l, idx) => {
      const dist =
        Math.abs((avgOnPower || l.onPower) - l.onPower) * 3 +
        Math.abs((avgOffPower || l.offPower) - l.offPower) +
        Math.abs((reps * sets) - (l.reps * l.sets)) * 1.5 +
        Math.abs((avgOnDuration || l.onDuration) - l.onDuration) * 0.5;
      if (dist < bestDist) { bestDist = dist; bestIdx = idx; }
    });
    return { levelIndex: bestIdx, sets, reps, avgOnPower, avgOffPower, on, off, kicks };
  }

  function assessFatigue(onSegments) {
    if (onSegments.length < 4) {
      return { dropPct: 0, verdict: 'データ不足', detail: 'オン区間の本数が少なく、後半失速の判定はできませんでした。' };
    }
    const half = Math.floor(onSegments.length / 2);
    const first = onSegments.slice(0, half);
    const second = onSegments.slice(onSegments.length - half);
    const avgFirst = mean(first, 'power');
    const avgSecond = mean(second, 'power');
    const dropPct = avgFirst > 0 ? ((avgFirst - avgSecond) / avgFirst) * 100 : 0;
    let verdict, detail;
    if (dropPct > 7) {
      verdict = '顕著な後半失速';
      detail = `前半平均${avgFirst.toFixed(0)}%FTP → 後半平均${avgSecond.toFixed(0)}%FTPと、${dropPct.toFixed(1)}%低下しています。強度またはペース配分が高すぎた可能性があります。`;
    } else if (dropPct > 3) {
      verdict = '軽度の後半失速';
      detail = `前半平均${avgFirst.toFixed(0)}%FTP → 後半平均${avgSecond.toFixed(0)}%FTPで、${dropPct.toFixed(1)}%の緩やかな低下です。`;
    } else {
      verdict = '安定したペース';
      detail = `前半平均${avgFirst.toFixed(0)}%FTP → 後半平均${avgSecond.toFixed(0)}%FTPとほぼ一定で、余力を残せている可能性があります。`;
    }
    return { dropPct, verdict, detail, avgFirst, avgSecond };
  }

  function suggestNextLevel(segments) {
    const match = matchLevel(segments);
    const fatigue = assessFatigue(match.on);
    const LEVELS = global.RSProgression.LEVELS;
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
      rationale = '最後まで安定したペースを維持できているため、次回は一段階強度を上げることを提案します。';
    }
    return {
      matchedLevelIndex: match.levelIndex,
      matchedLevel: LEVELS[match.levelIndex],
      fatigue,
      recommendedIndex,
      recommendedLevel: LEVELS[recommendedIndex],
      rationale,
      match,
    };
  }

  global.RSSuggest = { classifySegments, matchLevel, assessFatigue, suggestNextLevel };
})(window);
