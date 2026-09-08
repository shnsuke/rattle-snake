/* Parses a ride-interval CSV export (same column layout as the sample
 * Rattlesnake ride: Label,経過時間,平均パワー,平均ケイデンス,平均トルク,
 * 平均HR,最大HR,平均勾配,強度,ゾーン) into RSWorkout-compatible segments,
 * so an actual completed ride can be run through the same analyzer and
 * compared against a planned level.
 */
(function (global) {
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const lines = text.split(/\r\n|\r|\n/).filter((l) => l.length > 0);
    if (lines.length < 2) throw new Error('CSVにデータ行がありません');
    const headers = lines[0].split(',').map((h) => h.trim());
    const idx = (name) => headers.indexOf(name);
    const iTime = idx('経過時間');
    const iPower = idx('平均パワー');
    const iIntensity = idx('強度');
    const iLabel = idx('Label');
    if (iTime === -1 || iIntensity === -1) {
      throw new Error('必要な列(経過時間, 強度)が見つかりません');
    }
    let t = 0;
    const segments = [];
    for (let li = 1; li < lines.length; li++) {
      const cols = lines[li].split(',');
      const duration = parseFloat(cols[iTime]);
      if (!Number.isFinite(duration) || duration <= 0) continue;
      const intensityRaw = (cols[iIntensity] || '').replace('%', '').trim();
      const power = parseFloat(intensityRaw);
      const label = iLabel !== -1 ? (cols[iLabel] || '').trim() : '';
      const watts = iPower !== -1 ? parseFloat(cols[iPower]) : null;
      segments.push({
        start: t,
        duration,
        power: Number.isFinite(power) ? power : 0,
        watts: Number.isFinite(watts) ? watts : null,
        zone: global.RSWorkout.zoneForIntensity(Number.isFinite(power) ? power : 0),
        label: label || `Segment ${li}`,
      });
      t += duration;
    }
    return segments;
  }

  function looksLikeValidHeader(text) {
    return text.indexOf('経過時間') !== -1 && text.indexOf('強度') !== -1;
  }

  function decodeArrayBuffer(buf, encoding) {
    try {
      return new TextDecoder(encoding, { fatal: false }).decode(buf);
    } catch (e) {
      return null;
    }
  }

  // Reads a File as text, auto-detecting UTF-8 vs Shift-JIS: many Japanese
  // cycling-computer/PC tools export CSV in Shift-JIS, which garbles the
  // Japanese column headers (経過時間, 強度) if decoded as UTF-8, causing
  // parseCSV to fail to find them.
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.onload = () => {
        const buf = reader.result;
        const utf8 = decodeArrayBuffer(buf, 'utf-8');
        if (utf8 && looksLikeValidHeader(utf8)) { resolve(utf8); return; }
        const sjis = decodeArrayBuffer(buf, 'shift-jis');
        if (sjis && looksLikeValidHeader(sjis)) { resolve(sjis); return; }
        resolve(utf8 || sjis || '');
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function parseCSVFile(file) {
    return readFileAsText(file).then((text) => parseCSV(text));
  }

  function estimateFTP(segments) {
    const est = segments
      .filter((s) => s.watts && s.power > 0)
      .map((s) => s.watts / (s.power / 100));
    if (!est.length) return null;
    est.sort((a, b) => a - b);
    return est[Math.floor(est.length / 2)];
  }

  global.RSCsvImport = { parseCSV, parseCSVFile, estimateFTP };
})(window);
