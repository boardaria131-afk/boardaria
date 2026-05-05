/**
 * auth.js v3 — D&D eigenständiger Auth-Server (Port 3001)
 *
 * Nutzt DndAuth aus dnd-auth.js (client/public/dnd/public/dnd-auth.js)
 * Endpunkte: POST /api/auth/login, /api/auth/register, GET /api/auth/verify
 *
 * Fallback: Gast-Modus (localStorage only, kein Server nötig)
 */

const Auth = (() => {
  const TOKEN_KEY = 'dnd_token';   // eigener Key, kein Konflikt mit hf_token
  const USER_KEY  = 'dnd_user';

  // D&D-Server läuft auf Port 3001, Anfragen über relativen Pfad würden
  // zum HexForge-Server gehen — deshalb explizit Port 3001
  const API_BASE  = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api/auth'
    : `${window.location.protocol}//${window.location.hostname}:3001/api/auth`;

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
    // Gecachten User laden
    try {
      const cached = localStorage.getItem(USER_KEY);
      if (cached) _user = JSON.parse(cached);
    } catch {}

    _token = localStorage.getItem(TOKEN_KEY);

    if (_token) {
      const ok = await verifyToken(_token);
      if (ok) { _fire(); return; }
      // Token abgelaufen
      _clearLocal();
    }

    showLoginScreen();
  }

  // ── REST-Calls ────────────────────────────────────────────────────────────
  async function apiCall(path, options = {}) {
    const resp = await fetch(API_BASE + path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`Server-Fehler: ${resp.status}`); }
    if (!resp.ok) throw new Error(data.error || data.message || `Fehler ${resp.status}`);
    return data;
  }

  async function verifyToken(token) {
    try {
      const data = await apiCall('/verify', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      _setUser(data.user || data, token);
      return true;
    } catch (e) {
      // Offline → gecachten User nutzen
      if (_user && !navigator.onLine) {
        console.warn('[Auth] Offline – nutze gecachten User');
        return true;
      }
      return false;
    }
  }

  async function loginREST(username, password) {
    const data = await apiCall('/login', {
      method: 'POST',
      body:   JSON.stringify({ username, password }),
    });
    const user = data.user || { id: data.userId, username, isGuest: false };
    _setUser(user, data.token);
    localStorage.setItem(TOKEN_KEY, data.token);
    return user;
  }

  async function registerREST(username, password) {
    const data = await apiCall('/register', {
      method: 'POST',
      body:   JSON.stringify({ username, password }),
    });
    const user = data.user || { id: data.userId, username, isGuest: false };
    _setUser(user, data.token);
    localStorage.setItem(TOKEN_KEY, data.token);
    return user;
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
    _clearLocal();
    showLoginScreen();
  }

  // ── Intern ────────────────────────────────────────────────────────────────
  function _setUser(user, token) {
    _user = user; _token = token;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function _clearLocal() {
    _user = null; _token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
        <h1 class="auth-title">D&amp;D <span>Charakterbogen</span></h1>
        <p class="auth-sub">Melde dich an oder erstelle ein Konto</p>

        <div id="auth-error" class="auth-error hidden"></div>

        <div class="auth-tabs">
          <button class="auth-tab active" data-mode="login">Anmelden</button>
          <button class="auth-tab" data-mode="register">Registrieren</button>
        </div>

        <div class="form-group">
          <label>Benutzername</label>
          <input type="text" id="auth-username" placeholder="Dein Name"
            autocomplete="username" />
        </div>
        <div class="form-group">
          <label>Passwort</label>
          <input type="password" id="auth-password" placeholder="••••••••"
            autocomplete="current-password" />
        </div>

        <button class="btn-primary" id="auth-submit"
          style="width:100%;margin-bottom:10px;">Anmelden</button>
        <button class="btn-secondary" id="auth-guest"
          style="width:100%;">👤 Ohne Konto weitermachen (Gast)</button>

        <p class="auth-note">Gäste speichern nur lokal im Browser</p>
      </div>
    `;
    document.body.appendChild(overlay);

    let _mode = 'login';

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

    const doSubmit = async () => {
      const username = document.getElementById('auth-username').value.trim();
      const password = document.getElementById('auth-password').value;
      if (!username || !password) { _showErr('Bitte Name und Passwort eingeben'); return; }

      const btn = document.getElementById('auth-submit');
      btn.textContent = '⏳ …'; btn.disabled = true;
      _hideErr();

      try {
        if (_mode === 'login') await loginREST(username, password);
        else                   await registerREST(username, password);
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
    document.getElementById('auth-guest').addEventListener('click', () =>
      loginAsGuest(document.getElementById('auth-username').value));
  }

  function _showErr(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = '❌ ' + msg; el.classList.remove('hidden'); }
  }
  function _hideErr() {
    document.getElementById('auth-error')?.classList.add('hidden');
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
      <div style="background:rgba(26,18,8,0.92);border:1px solid var(--gold);
        border-radius:20px;padding:4px 12px;display:flex;align-items:center;gap:8px;">
        <span style="font-family:var(--font-title);font-size:11px;
          color:var(--gold);letter-spacing:1px;">
          ${u?.isGuest ? '👤 ' + u.username : '⚔ ' + u?.username}
        </span>
        <button id="btn-logout"
          style="background:none;border:none;color:#8a7060;cursor:pointer;
            font-size:12px;padding:0;" title="Abmelden">✕</button>
      </div>`;
    document.getElementById('btn-logout')?.addEventListener('click', logout);
  }

  return { init, onReady, getUser, getToken, isGuest, logout, loginAsGuest };
})();

window.Auth = Auth;
