/**
 * auth.js v2 — HexForge-Auth für D&D-App
 *
 * Primär:  REST  POST /api/auth/login   { username, password }
 *                POST /api/auth/register { username, password }
 *                GET  /api/auth/verify   (Bearer token)
 * Fallback: Socket.IO (falls window.io verfügbar)
 * Offline:  Gast-Modus (localStorage only)
 */

const Auth = (() => {
  const TOKEN_KEY  = 'hf_token';
  const USER_KEY   = 'dnd_user';

  const ENDPOINTS = {
    verify:   '/api/auth/verify',
    login:    '/api/auth/login',
    register: '/api/auth/register',
  };

  let _user    = null;
  let _token   = null;
  let _onReady = [];

  function onReady(cb) {
    if (_user) cb(_user); else _onReady.push(cb);
  }
  function getUser()  { return _user; }
  function getToken() { return _token; }
  function isGuest()  { return !_user || _user.isGuest; }

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    // Gecachten User laden (Schnellstart / Offline)
    try {
      const cached = localStorage.getItem(USER_KEY);
      if (cached) _user = JSON.parse(cached);
    } catch {}

    _token = localStorage.getItem(TOKEN_KEY);

    if (_token) {
      // Token validieren
      const ok = await verifyToken(_token);
      if (ok) { _fire(); return; }
      // Token ungültig → löschen
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      _user = null; _token = null;
    }

    // Kein gültiger Token → Login
    showLoginScreen();
  }

  // ── REST-Verifikation ─────────────────────────────────────────────────────
  async function verifyToken(token) {
    try {
      const resp = await fetch(ENDPOINTS.verify, {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!resp.ok) return false;
      const user = await resp.json();
      _setUser(user, token);
      return true;
    } catch {
      // Server nicht erreichbar (offline) → gecachten User nehmen
      if (_user) { console.warn('[Auth] Offline – nutze gecachten User'); return true; }
      return false;
    }
  }

  // ── REST-Login ────────────────────────────────────────────────────────────
  async function loginREST(username, password) {
    const resp = await fetch(ENDPOINTS.login, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Login fehlgeschlagen');
    _setUser(data.user || { id: data.userId, username, isGuest: false }, data.token);
    localStorage.setItem(TOKEN_KEY, data.token);
    return _user;
  }

  // ── REST-Registrierung ────────────────────────────────────────────────────
  async function registerREST(username, password) {
    const resp = await fetch(ENDPOINTS.register, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || data.message || 'Registrierung fehlgeschlagen');
    _setUser(data.user || { id: data.userId, username, isGuest: false }, data.token);
    localStorage.setItem(TOKEN_KEY, data.token);
    return _user;
  }

  // ── Socket.IO Login (Fallback wenn REST-Endpunkte fehlen) ─────────────────
  function loginSocket(username, password, mode) {
    return new Promise((resolve, reject) => {
      if (!window.io) {
        reject(new Error('Server nicht erreichbar. Bitte Seite neu laden oder als Gast fortfahren.'));
        return;
      }
      const socket = window.io();
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Timeout – Server antwortet nicht'));
      }, 6000);

      socket.emit(mode === 'register' ? 'auth_register' : 'auth_login', { username, password });
      socket.once('auth_ok', ({ user, token }) => {
        clearTimeout(timeout);
        socket.disconnect();
        _setUser(user, token);
        localStorage.setItem(TOKEN_KEY, token);
        resolve(user);
      });
      socket.once('auth_err', err => {
        clearTimeout(timeout);
        socket.disconnect();
        reject(new Error(err?.message || (mode === 'register' ? 'Registrierung fehlgeschlagen' : 'Login fehlgeschlagen')));
      });
    });
  }

  // ── Universeller Login (REST first, Socket.IO fallback) ───────────────────
  async function login(username, password, mode = 'login') {
    // 1. REST versuchen
    try {
      if (mode === 'register') return await registerREST(username, password);
      return await loginREST(username, password);
    } catch (e) {
      // Wenn REST-Endpunkt nicht existiert (404/405) → Socket.IO probieren
      if (e.message.includes('fetch') || e.message.includes('404') || e.message.includes('405')) {
        console.warn('[Auth] REST nicht verfügbar, versuche Socket.IO…');
        return await loginSocket(username, password, mode);
      }
      throw e; // Echter Fehler (falsches Passwort etc.)
    }
  }

  // ── Gast ──────────────────────────────────────────────────────────────────
  function loginAsGuest(name) {
    _setUser({
      id:       'guest_' + Date.now(),
      username: (name || 'Gast').trim() || 'Gast',
      isGuest:  true,
    }, null);
    _fire();
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  function logout() {
    _user = null; _token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    showLoginScreen();
  }

  // ── Intern ────────────────────────────────────────────────────────────────
  function _setUser(user, token) {
    _user = user; _token = token;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function _fire() {
    _onReady.forEach(cb => { try { cb(_user); } catch {} });
    _onReady = [];
    hideLoginScreen();
    updateUserBadge();
  }

  // ── Login-Screen ──────────────────────────────────────────────────────────
  function showLoginScreen() {
    let overlay = document.getElementById('auth-overlay');
    if (overlay) { overlay.style.display = 'flex'; _resetForm(); return; }

    overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-box">
        <span class="auth-emblem">⚔</span>
        <h1 class="auth-title">D&D <span>Charakterbogen</span></h1>
        <p class="auth-sub">Melde dich mit deinem HexForge-Konto an</p>

        <div id="auth-error" class="auth-error hidden"></div>

        <div class="auth-tabs">
          <button class="auth-tab active" data-mode="login">Anmelden</button>
          <button class="auth-tab" data-mode="register">Registrieren</button>
        </div>

        <div class="form-group">
          <label>Benutzername</label>
          <input type="text" id="auth-username" placeholder="HexForge-Name"
            autocomplete="username" />
        </div>
        <div class="form-group">
          <label>Passwort</label>
          <input type="password" id="auth-password" placeholder="••••••••"
            autocomplete="current-password" />
        </div>

        <button class="btn-primary" id="auth-submit" style="width:100%;margin-bottom:10px;">
          Anmelden
        </button>
        <button class="btn-secondary" id="auth-guest" style="width:100%;">
          👤 Ohne Konto weitermachen (Gast)
        </button>
        <p class="auth-note">Gäste speichern nur lokal · Kein Konto? Erst auf HexForge registrieren</p>
      </div>
    `;
    document.body.appendChild(overlay);

    let _mode = 'login';

    // Tab-Umschalter
    overlay.querySelectorAll('.auth-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        _mode = btn.dataset.mode;
        overlay.querySelectorAll('.auth-tab').forEach(b =>
          b.classList.toggle('active', b.dataset.mode === _mode));
        document.getElementById('auth-submit').textContent =
          _mode === 'login' ? 'Anmelden' : 'Registrieren';
        _hideErr();
      });
    });

    // Submit
    const doSubmit = async () => {
      const username = document.getElementById('auth-username').value.trim();
      const password = document.getElementById('auth-password').value;
      if (!username || !password) { _showErr('Bitte Name und Passwort eingeben'); return; }

      const btn = document.getElementById('auth-submit');
      btn.textContent = '⏳ …'; btn.disabled = true;
      _hideErr();

      try {
        await login(username, password, _mode);
        _fire();
      } catch (e) {
        _showErr(e.message);
        btn.textContent = _mode === 'login' ? 'Anmelden' : 'Registrieren';
        btn.disabled = false;
      }
    };

    document.getElementById('auth-submit').addEventListener('click', doSubmit);
    document.getElementById('auth-password').addEventListener('keydown',
      e => { if (e.key === 'Enter') doSubmit(); });
    document.getElementById('auth-guest').addEventListener('click', () => {
      const name = document.getElementById('auth-username').value.trim();
      loginAsGuest(name);
    });
  }

  function _showErr(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  }
  function _hideErr() {
    const el = document.getElementById('auth-error');
    if (el) el.classList.add('hidden');
  }
  function _resetForm() {
    _hideErr();
    const btn = document.getElementById('auth-submit');
    if (btn) { btn.textContent = 'Anmelden'; btn.disabled = false; }
  }

  function hideLoginScreen() {
    const el = document.getElementById('auth-overlay');
    if (el) el.style.display = 'none';
  }

  function updateUserBadge() {
    let badge = document.getElementById('user-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'user-badge';
      badge.style.cssText = 'position:fixed;top:10px;right:56px;z-index:200;';
      document.body.appendChild(badge);
    }
    const u = _user;
    badge.innerHTML = `
      <div style="background:rgba(26,18,8,0.92);border:1px solid var(--gold);border-radius:20px;padding:4px 12px;display:flex;align-items:center;gap:8px;">
        <span style="font-family:var(--font-title);font-size:11px;color:var(--gold);letter-spacing:1px;">
          ${u?.isGuest ? '👤 ' + u.username : '⚔ ' + u?.username}
        </span>
        <button id="btn-logout" style="background:none;border:none;color:#8a7060;cursor:pointer;font-size:12px;padding:0;" title="Abmelden">✕</button>
      </div>`;
    document.getElementById('btn-logout')?.addEventListener('click', logout);
  }

  return { init, onReady, getUser, getToken, isGuest, logout, loginAsGuest };
})();

window.Auth = Auth;
