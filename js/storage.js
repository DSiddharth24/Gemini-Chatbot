/**
 * storage.js — In-memory only session state
 *
 * Privacy policy: nothing is written to localStorage, cookies,
 * or any persistent store. All data lives in JS memory and is
 * gone the moment the tab is closed or refreshed.
 *
 * This matters because users upload sensitive legal documents —
 * contracts, property deeds, employment agreements — that must
 * never be cached or persisted without explicit consent.
 */

const Storage = (() => {
  // Everything lives here — cleared on page unload automatically
  const mem = {
    apiKey: '',
    theme:  'light',
    mode:   'general',
    lang:   'en',
  };

  // ── API Key (memory only) ────────────────────
  function getApiKey()       { return mem.apiKey; }
  function saveApiKey(key)   { mem.apiKey = key.trim(); }
  function clearApiKey()     { mem.apiKey = ''; }

  // ── Theme (memory only) ──────────────────────
  function getTheme()        { return mem.theme; }
  function saveTheme(theme)  { mem.theme = theme; }

  // ── Preferences (memory only) ────────────────
  function getLastMode()     { return mem.mode; }
  function saveLastMode(m)   { mem.mode = m; }
  function getLastLang()     { return mem.lang; }
  function saveLastLang(l)   { mem.lang = l; }

  // ── Session factory (in-memory struct only) ──
  function createNewSession() {
    return {
      id:        'sess_' + Date.now(),
      createdAt: new Date().toISOString(),
      messages:  [],   // Gemini history [{role, parts}]
      mode:      mem.mode,
      lang:      mem.lang,
    };
  }

  return {
    getApiKey, saveApiKey, clearApiKey,
    getTheme, saveTheme,
    getLastMode, saveLastMode,
    getLastLang, saveLastLang,
    createNewSession,
  };
})();
