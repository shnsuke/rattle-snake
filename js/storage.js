/* Thin localStorage wrapper. localStorage (not IndexedDB) is enough here:
 * the data is small (FTP + a log of completed sessions) and it works
 * synchronously offline with no setup.
 */
(function (global) {
  const KEY_FTP = 'rs_ftp';
  const KEY_LAST_LEVEL = 'rs_last_level';
  const KEY_RIDES = 'rs_rides';
  const DEFAULT_FTP = 312;

  function getFTP() {
    const v = parseInt(localStorage.getItem(KEY_FTP), 10);
    return Number.isFinite(v) && v > 0 ? v : DEFAULT_FTP;
  }
  function setFTP(watts) {
    localStorage.setItem(KEY_FTP, String(Math.round(watts)));
  }

  // Ride logs: each uploaded/imported CSV workout, kept as %FTP segments
  // (not watts) so re-analysis stays correct if the user's FTP changes later.
  function getRideLogs() {
    try {
      return JSON.parse(localStorage.getItem(KEY_RIDES)) || [];
    } catch (e) {
      return [];
    }
  }
  function addRideLog(entry) {
    const rides = getRideLogs();
    const id = entry.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    rides.push(Object.assign({ id, date: new Date().toISOString() }, entry, { id }));
    rides.sort((a, b) => new Date(a.date) - new Date(b.date));
    localStorage.setItem(KEY_RIDES, JSON.stringify(rides));
    return id;
  }
  function clearRideLogs() {
    localStorage.removeItem(KEY_RIDES);
  }

  function getLastLevel() {
    const v = parseInt(localStorage.getItem(KEY_LAST_LEVEL), 10);
    return Number.isFinite(v) ? v : 3;
  }
  function setLastLevel(level) {
    localStorage.setItem(KEY_LAST_LEVEL, String(level));
  }

  global.RSStorage = {
    getFTP, setFTP,
    getLastLevel, setLastLevel, DEFAULT_FTP,
    getRideLogs, addRideLog, clearRideLogs,
  };
})(window);
