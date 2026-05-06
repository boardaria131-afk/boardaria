/**
 * auth.js v6
 * HexForge speichert keinen Token in localStorage.
 * D&D-App hat eigenen Login — Token wird als 'dnd_token' gespeichert.
 * Nach Login einmal eingeloggt bis Token abläuft (30 Tage).
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
      // Token vorhanden — kurz verifizieren
      const ok = await _verify(_token);
      if (ok) { _fire(); return; }
      // abgelaufen
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
      _setUser(data.user || data, token);
      return true;
    } catch {
      // Offline → gecachten User nehmen
      const cached = localStorage.getItem(USER_KEY);
      if (cached) { _user = JSON.parse(cached); return true; }
      return false;
    }
  }

  // ── REST ──────────────────────────────────────────────────
  async function _post(url, body) {
    const resp = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error(`Server antwortet nicht korrekt (${resp.status})`); }
    if (!resp.ok) throw new Error(data.error || data.reason || `Fehler ${resp.status}`);
    return data;
  }

  async function _login(username, password) {
    const data = await _post(API.login, { username, password });
    _setUser(
      data.user || { id: data.id, username, isGuest: false },
      data.token
    );
    localStorage.setItem(TOKEN_KEY, data.token);
  }

  async function _register(username, password) {
    const data = await _post(API.register, { username, password });
    _setUser(
      data.user || { id: data.id, username, isGuest: false },
      data.token
    );
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
    document.getElementById('user-badge')?.remove();
    showLoginScreen();
  }

  // ── Intern ────────────────────────────────────────────────
  function _setUser(user, token) {
    _user = user; _token = token;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function _fire() {
    _onReady.forEach(cb => { try { cb(_user); } catch(e) { console.error(e); } });
    _onReady = [];
    hideLoginScreen();
    _renderBadge();
  }

  // ── Login-Screen ──────────────────────────────────────────
  function showLoginScreen() {
    // Alten Screen entfernen falls vorhanden (fix duplicate IDs)
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
          <input type="text" id="dnd-auth-username"
            placeholder="Dein Name" autocomplete="username" />
        </div>
        <div class="form-group">
          <label>Passwort</label>
          <input type="password" id="dnd-auth-password"
            placeholder="••••••••" autocomplete="current-password" />
        </div>

        <button class="btn-primary" id="dnd-auth-submit"
          style="width:100%;margin-bottom:10px;">Anmelden</button>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <div style="flex:1;height:1px;background:rgba(200,165,90,0.3);"></div>
          <span style="font-size:11px;color:#8a7060;font-family:var(--font-title);">ODER</span>
          <div style="flex:1;height:1px;background:rgba(200,165,90,0.3);"></div>
        </div>

        <button class="btn-secondary" id="dnd-auth-guest"
          style="width:100%;">👤 Als Gast weitermachen</button>

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
        _showOk(`Willkommen, ${_user.username}!`);
        setTimeout(() => _fire(), 600);
      } catch (e) {
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
    if (el) { el.textContent = '✅ ' + msg; el.classList.remove('hidden'); }
    document.getElementById('dnd-auth-error')?.classList.add('hidden');
  }

  function _hideMsg() {
    document.getElementById('dnd-auth-error')?.classList.add('hidden');
    document.getElementById('dnd-auth-success')?.classList.add('hidden');
  }

  function hideLoginScreen() {
    document.getElementById('auth-overlay')?.remove();
  }

  // ── User-Badge ────────────────────────────────────────────
  function _renderBadge() {
    document.getElementById('user-badge')?.remove();
    const badge = document.createElement('div');
    badge.id = 'user-badge';
    badge.style.cssText = 'position:fixed;top:10px;right:56px;z-index:200;';
    const u = _user;
    badge.innerHTML = `
      <div style="background:rgba(26,18,8,0.92);border:1px solid var(--gold);
        border-radius:20px;padding:4px 14px;display:flex;align-items:center;
        gap:10px;box-shadow:var(--glow-gold);">
        <span style="font-family:var(--font-title);font-size:11px;
          color:var(--gold);letter-spacing:1px;">
          ${u?.isGuest ? '👤 ' + u.username : '⚔ ' + u?.username}
        </span>
        <button id="btn-logout"
          style="background:rgba(139,26,26,0.2);border:1px solid
            rgba(139,26,26,0.4);color:var(--blood-light);cursor:pointer;
            font-size:10px;padding:2px 8px;border-radius:10px;
            font-family:var(--font-title);letter-spacing:0.5px;"
        >Abmelden</button>
      </div>`;
    document.body.appendChild(badge);
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      if (confirm('Wirklich abmelden?')) logout();
    });
  }

  return { init, onReady, getUser, getToken, isGuest, logout, loginAsGuest };
})();

window.Auth = Auth;
