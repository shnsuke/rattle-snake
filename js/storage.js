/* Thin localStorage wrapper. localStorage (not IndexedDB) is enough here:
 * the data is small (FTP + a log of completed sessions) and it works
 * synchronously offline with no setup.
 */
(function (global) {
  const KEY_FTP = 'rs_ftp';
  const KEY_HISTORY = 'rs_history';
  const KEY_LAST_LEVEL = 'rs_last_level';
  const DEFAULT_FTP = 312;

  function getFTP() {
    const v = parseInt(localStorage.getItem(KEY_FTP), 10);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_FTP;
  }
  function setFTP(watts) {
    localStorage.setItem(KEY_FTP, String(Math.round(watts)));
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(KEY_HISTORY)) || [];
    } catch (e) {
      return [];
    }
  }
  function addHistoryEntry(entry) {
    const h = getHistory();
    h.unshift(Object.assign({ date: new Date().toISOString() }, entry));
    localStorage.setItem(KEY_HISTORY, JSON.stringify(h.slice(0, 200)));
  }
  function clearHistory() {
    localStorage.removeItem(KEY_HISTORY);
  }

  function getLastLevel() {
    const v = parseInt(localStorage.getItem(KEY_LAST_LEVEL), 10);
    return Number.isFinite(v) ? v : 3;
  }
  function setLastLevel(level) {
    localStorage.setItem(KEY_LAST_LEVEL, String(level));
  }

  global.RSStorage = {
    getFTP, setFTP, getHistory, addHistoryEntry, clearHistory,
    getLastLevel, setLastLevel, DEFAULT_FTP,
  };
})(window);
