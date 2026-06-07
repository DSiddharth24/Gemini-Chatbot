/**
 * storage.js — In-memory only session state
 *
 * Privacy: nothing is written to localStorage, cookies,
 * or any persistent store. All data lives in JS memory and
 * is gone the moment the tab is closed or refreshed.
 *
 * The API key is set at deploy time in api.js — users
 * never see or enter it.
 */

const Storage = (() => {
  const mem = {
    theme: 'light',
    mode:  'general',
    lang:  'en',
  };

  function getTheme()        { return mem.theme; }
  function saveTheme(theme)  { mem.theme = theme; }
  function getLastMode()     { return mem.mode; }
  function saveLastMode(m)   { mem.mode = m; }
  function getLastLang()     { return mem.lang; }
  function saveLastLang(l)   { mem.lang = l; }

  function createNewSession() {
    return {
      id:        'sess_' + Date.now(),
      createdAt: new Date().toISOString(),
      messages:  [],
      mode:      mem.mode,
      lang:      mem.lang,
    };
  }

  return {
    getTheme, saveTheme,
    getLastMode, saveLastMode,
    getLastLang, saveLastLang,
    createNewSession,
  };
})();
