/**
 * auth.js v7 — robust, mit Debug-Info und prominentem User-Status
 */

const Auth = (() => {
  const TOKEN_KEY = 'dnd_token';
  const USER_KEY  = 'dnd_user';

  const API = {
    verify:   '/api/dnd/verify',
    login:    '/api/dnd/login',
    register: '/api/dnd/register',
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

  // ── Init ──────────────────────────────────────────────────
  async function init() {
    _token = localStorage.getItem(TOKEN_KEY);

    if (_token) {
      const ok = await _verify(_token);
      if (ok) { _fire(); return; }
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      _user = null; _token = null;
    }

    showLoginScreen();
  }

  // ── Verify ────────────────────────────────────────────────
  async function _verify(token) {
    try {
      const resp = await fetch(API.verify, {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      // Flexibel: { user: {...} } oder direkt { id, username }
      const user = data.user || data;
      if (!user.id && !user.username) return false;
      _setUser(user, token);
      return true;
    } catch {
      // Offline — gecachten User nehmen
      try {
        const cached = localStorage.getItem(USER_KEY);
        if (cached) { _user = JSON.parse(cached); return true; }
      } catch {}
      return false;
    }
  }

  // ── REST mit vollem Error-Logging ─────────────────────────
  async function _post(url, body) {
    let resp;
    try {
      resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
    } catch (e) {
      throw new Error('Server nicht erreichbar. Bitte Seite neu laden.');
    }

    const text = await resp.text();
    console.log(`[Auth] ${url} → ${resp.status}:`, text.slice(0, 200));

    let data;
    try { data = JSON.parse(text); }
    catch {
      // Server gibt HTML zurück (404-Seite etc.)
      throw new Error(`Endpunkt nicht gefunden (${resp.status}). Server-Konfiguration prüfen.`);
    }

    if (!resp.ok) {
      throw new Error(data.error || data.reason || data.message || `Fehler ${resp.status}`);
    }
    return data;
  }

  async function _login(username, password) {
    const data = await _post(API.login, { username, password });
    if (!data.token) throw new Error('Kein Token vom Server erhalten.');
    const user = data.user || { id: data.id || data.userId, username, isGuest: false };
    _setUser(user, data.token);
    localStorage.setItem(TOKEN_KEY, data.token);
  }

  async function _register(username, password) {
    const data = await _post(API.register, { username, password });
    if (!data.token) throw new Error('Kein Token vom Server erhalten.');
    const user = data.user || { id: data.id || data.userId, username, isGuest: false };
    _setUser(user, data.token);
    localStorage.setItem(TOKEN_KEY, data.token);
  }

  // ── Gast ──────────────────────────────────────────────────
  function loginAsGuest(name) {
    _setUser({
      id:       'guest_' + Date.now(),
      username: (name || 'Gast').trim() || 'Gast',
      isGuest:  true,
    }, null);
    _fire();
  }

  // ── Logout ────────────────────────────────────────────────
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    _user = null; _token = null;
    _onReady = [];
    // Character-Cache zurücksetzen
    if (window.Character && Character.setUserContext) {
      Character.setUserContext({ id: null, username: 'logout', isGuest: true });
    }
    // Sauberster Weg: Seite neu laden zeigt Login-Screen
    // (verhindert doppelte Initialisierung und veraltete Daten)
    window.location.href = '/dnd/';
  }

  // ── Intern ────────────────────────────────────────────────
  function _setUser(user, token) {
    _user = user; _token = token;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function _fire() {
    _onReady.forEach(cb => { try { cb(_user); } catch(e) { console.error('[Auth]', e); } });
    _onReady = [];
    hideLoginScreen();
    updateHeaderBadge();
  }

  // ── Header-Badge (prominent in der App-Leiste) ────────────
  function updateHeaderBadge() {
    // Im App-Header einbauen
    const headerActions = document.querySelector('.header-actions');
    let badge = document.getElementById('user-badge');

    if (!_user) {
      badge?.remove();
      return;
    }

    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'user-badge';
      badge.style.cssText = 'display:flex;align-items:center;gap:6px;';
      // Vor den anderen Header-Buttons einfügen
      if (headerActions) headerActions.prepend(badge);
    }

    const u = _user;
    badge.innerHTML = `
      <div style="
        background:rgba(201,150,42,0.15);
        border:1px solid var(--gold);
        border-radius:20px;
        padding:4px 12px;
        display:flex;
        align-items:center;
        gap:8px;
      ">
        <span style="
          font-family:var(--font-title);
          font-size:11px;
          color:var(--gold);
          letter-spacing:1px;
          white-space:nowrap;
        ">
          ${u.isGuest ? '👤 ' + u.username : '⚔ ' + u.username}
        </span>
        <button id="btn-logout" style="
          background:none;
          border:none;
          color:rgba(201,150,42,0.6);
          cursor:pointer;
          font-size:13px;
          padding:0;
          line-height:1;
          transition:color 0.2s;
        " title="Abmelden">✕</button>
      </div>
    `;

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      if (confirm('Wirklich abmelden?')) logout();
    });
  }

  // ── Login-Screen ──────────────────────────────────────────
  function showLoginScreen() {
    document.getElementById('auth-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.innerHTML = `
      <div class="auth-box">
        <span class="auth-emblem">⚔</span>
        <h1 class="auth-title">D&amp;D <span>Charakterbogen</span></h1>
        <p class="auth-sub">Melde dich an oder erstelle ein Konto</p>

        <div id="dnd-auth-error"   class="auth-error   hidden"></div>
        <div id="dnd-auth-success" class="auth-success hidden"></div>

        <div class="auth-tabs">
          <button class="auth-tab active" data-mode="login">Anmelden</button>
          <button class="auth-tab"        data-mode="register">Registrieren</button>
        </div>

        <div class="form-group">
          <label>Benutzername</label>
          <input type="text"
            id="dnd-auth-username"
            placeholder="Dein Name"
            autocomplete="username" />
        </div>
        <div class="form-group">
          <label>Passwort</label>
          <input type="password"
            id="dnd-auth-password"
            placeholder="••••••••"
            autocomplete="current-password" />
        </div>

        <button class="btn-primary" id="dnd-auth-submit"
          style="width:100%;margin-bottom:10px;">
          Anmelden
        </button>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="flex:1;height:1px;background:rgba(200,165,90,0.3);"></div>
          <span style="font-size:11px;color:#8a7060;font-family:var(--font-title);">ODER</span>
          <div style="flex:1;height:1px;background:rgba(200,165,90,0.3);"></div>
        </div>

        <button class="btn-secondary" id="dnd-auth-guest" style="width:100%;">
          👤 Als Gast weitermachen
        </button>

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
        document.getElementById('dnd-auth-submit').textContent =
          _mode === 'login' ? 'Anmelden' : 'Registrieren';
        _hideMsg();
      });
    });

    const doSubmit = async () => {
      const username = document.getElementById('dnd-auth-username').value.trim();
      const password = document.getElementById('dnd-auth-password').value;

      if (!username || !password) {
        _showErr('Bitte Name und Passwort eingeben');
        return;
      }

      const btn = document.getElementById('dnd-auth-submit');
      btn.textContent = '⏳ …';
      btn.disabled = true;
      _hideMsg();

      try {
        if (_mode === 'login') await _login(username, password);
        else                   await _register(username, password);

        _showOk(`Willkommen, ${_user.username}! ✅`);
        setTimeout(() => _fire(), 800);

      } catch (e) {
        console.error('[Auth] Fehler:', e);
        _showErr(e.message);
        btn.textContent = _mode === 'login' ? 'Anmelden' : 'Registrieren';
        btn.disabled = false;
      }
    };

    document.getElementById('dnd-auth-submit')
      .addEventListener('click', doSubmit);
    document.getElementById('dnd-auth-password')
      .addEventListener('keydown', e => { if (e.key === 'Enter') doSubmit(); });
    document.getElementById('dnd-auth-guest')
      .addEventListener('click', () =>
        loginAsGuest(document.getElementById('dnd-auth-username').value));

    setTimeout(() => document.getElementById('dnd-auth-username')?.focus(), 100);
  }

  function _showErr(msg) {
    const el = document.getElementById('dnd-auth-error');
    if (el) { el.textContent = '❌ ' + msg; el.classList.remove('hidden'); }
    document.getElementById('dnd-auth-success')?.classList.add('hidden');
  }

  function _showOk(msg) {
    const el = document.getElementById('dnd-auth-success');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    document.getElementById('dnd-auth-error')?.classList.add('hidden');
  }

  function _hideMsg() {
    document.getElementById('dnd-auth-error')?.classList.add('hidden');
    document.getElementById('dnd-auth-success')?.classList.add('hidden');
  }

  function hideLoginScreen() {
    document.getElementById('auth-overlay')?.remove();
  }

  return { init, onReady, getUser, getToken, isGuest, logout, loginAsGuest, updateHeaderBadge };
})();

window.Auth = Auth;
