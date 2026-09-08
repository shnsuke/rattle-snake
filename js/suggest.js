/* Turns an uploaded ride's segments into a single next-intensity
 * proposal. The session's shape (reps/sets/durations) is fixed --
 * see progression.js -- so the only question is: what center %FTP
 * should the within-set ladder be built around next time?
 *
 * 1) classify each segment as kick/on/off/other by its duration+power
 *    shape (works at any intensity, since the shape never changes),
 * 2) take the average on-segment power as the intensity actually
 *    ridden ("center"),
 * 3) compare each actual on-segment to what THIS ride's own ladder
 *    shape would predict at that position -- not a plain first-half-
 *    vs-second-half power drop, since the ladder itself steps power
 *    down by design (and now in blocks of 4), so a raw drop would
 *    look like "fatigue" even on a perfectly-executed ride. Falling
 *    further behind that shape in the second half is the real
 *    fatigue signal.
 * 4) propose center+STEP / same / center-STEP for next time.
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

  function matchIntensity(segments) {
    const { kicks, on, off } = classifySegments(segments);
    const sets = Math.max(1, kicks.length || 3);
    const reps = Math.max(1, Math.round(on.length / sets));
    const center = mean(on, 'power');
    return { center, sets, reps, on, off, kicks };
  }

  function assessFatigue(onSegments, center, sets, repsPerSet) {
    if (onSegments.length < 4 || !center) {
      return { dropPct: 0, verdict: 'データ不足', detail: 'オン区間の本数が少なく、判定はできませんでした。' };
    }
    const BASE = global.RSProgression.BASE;
    const ladderStart = center + BASE.ladderSpread / 2;
    const ladderEnd = center - BASE.ladderSpread / 2;
    const oneSet = global.RSWorkout.buildBlockLadder(ladderStart, ladderEnd, repsPerSet, BASE.blockSize);
    let expected = [];
    for (let s = 0; s < sets; s++) expected = expected.concat(oneSet);

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
      detail = `前半平均${avgFirst.toFixed(0)}% → 後半平均${avgSecond.toFixed(0)}%(自分自身のペース比)まで落ち込んでおり、想定以上にペースが落ちています。強度が高すぎた可能性があります。`;
    } else if (dropPct > 3) {
      verdict = '軽度の後半失速';
      detail = `前半平均${avgFirst.toFixed(0)}% → 後半平均${avgSecond.toFixed(0)}%(自分自身のペース比)と、やや低下しています。`;
    } else {
      verdict = '安定したペース';
      detail = `前半平均${avgFirst.toFixed(0)}% → 後半平均${avgSecond.toFixed(0)}%(自分自身のペース比)とほぼ一定で、余力を残せている可能性があります。`;
    }
    return { dropPct, verdict, detail, avgFirst, avgSecond };
  }

  function suggestNextIntensity(segments) {
    const match = matchIntensity(segments);
    const fatigue = assessFatigue(match.on, match.center, match.sets, match.reps);
    const STEP = global.RSProgression.INTENSITY_STEP;
    let nextCenter = match.center;
    let rationale;
    if (fatigue.dropPct > 7) {
      nextCenter = match.center - STEP;
      rationale = `後半の失速が大きいため、次回は${STEP}%ほど強度を下げて安定して追い込めるようにすることを提案します。`;
    } else if (fatigue.dropPct > 3) {
      nextCenter = match.center;
      rationale = '軽度の失速が見られるため、次回は同じ強度をもう一度行い、ペース配分の安定を優先することを提案します。';
    } else {
      nextCenter = match.center + STEP;
      rationale = `最後まで安定したペースを維持できているため、次回は${STEP}%ほど強度を上げることを提案します。`;
    }
    nextCenter = Math.round(nextCenter * 10) / 10;
    return {
      currentCenter: Math.round(match.center * 10) / 10,
      fatigue,
      nextCenter,
      rationale,
      match,
    };
  }

  global.RSSuggest = { classifySegments, matchIntensity, assessFatigue, suggestNextIntensity };
})(window);
