/**
 * Shared admin UI auth — token stays in localStorage only (never committed).
 * Paste Vercel INGEST_TOKEN (or ADMIN_UI_TOKEN / legacy admin token) once per browser.
 */
(function (global) {
  var STORAGE_KEY = 'alan_admin_ui_token';

  function getToken() {
    try {
      return (global.localStorage.getItem(STORAGE_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  function setToken(token) {
    var t = String(token || '').trim();
    try {
      if (t) global.localStorage.setItem(STORAGE_KEY, t);
      else global.localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
    return t;
  }

  function ensureToken(message) {
    var t = getToken();
    if (t) return t;
    t = global.prompt(
      message || 'Paste admin token (Vercel INGEST_TOKEN or ADMIN_UI_TOKEN):',
      ''
    );
    if (t) setToken(t);
    return (t || '').trim();
  }

  function bearer() {
    var t = ensureToken();
    return t ? 'Bearer ' + t : '';
  }

  function authHeaders(extra) {
    var headers = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
    var b = bearer();
    if (b) headers.Authorization = b;
    return headers;
  }

  function clearToken() {
    setToken('');
  }

  global.AdminAuth = {
    STORAGE_KEY: STORAGE_KEY,
    getToken: getToken,
    setToken: setToken,
    ensureToken: ensureToken,
    bearer: bearer,
    authHeaders: authHeaders,
    clearToken: clearToken
  };
})(typeof window !== 'undefined' ? window : globalThis);
