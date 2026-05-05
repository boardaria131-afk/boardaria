/**
 * auth.js — HexForge-Auth-Integration für die D&D-App
 * Strategie:
 *   1. Token aus localStorage ('hf_token') lesen
 *   2. Per /api/auth/verify validieren (REST)
 *   3. Fallback: Socket.IO auth_token Event
 *   4. Fallback: Lokaler Offline-Modus (Gast)
 */

const Auth = (() => {
  const TOKEN_KEY   = 'hf_token';
  const USER_KEY    = 'dnd_user';
  const VERIFY_URL  = '/api/auth/verify';

  let _user    = null;  // { id, username, isGuest }
  let _token   = null;
  let _socket  = null;
  let _onReady = [];    // Callbacks nach erfolgreichem Login

  // ── Öffentlich ───────────────────────────────────────────────────────────
  function onReady(cb) {
    if (_user) cb(_user);
    else _onReady.push(cb);
  }

  function getUser()  { return _user; }
  function getToken() { return _token; }
  function isGuest()  { return !_user || _user.isGuest; }

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    // 1. Gecachten User laden (Offline-Schnellstart)
    const cached = localStorage.getItem(USER_KEY);
    if (cached) {
      try { _user = JSON.parse(cached); } catch {}
    }

    // 2. Token aus HexForge-localStorage
    _token = localStorage.getItem(TOKEN_KEY);

    if (_token) {
      try {
        const ok = await verifyWithREST(_token);
        if (ok) { _fire(); return; }
      } catch (e) {
        console.warn('[Auth] REST verify fehlgeschlagen, versuche Socket.IO…');
      }

      // 3. Socket.IO Fallback (falls Socket verfügbar)
      if (window.io) {
        await verifyWithSocket(_token);
        return;
      }
    }

    // 4. Kein Token → Login-Screen zeigen
    if (!_user) showLoginScreen();
  }

  // ── REST-Verifikation ────────────────────────────────────────────────────
  async function verifyWithREST(token) {
    const resp = await fetch(VERIFY_URL, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!resp.ok) return false;
    const user = await resp.json();
    _setUser(user, token);
    return true;
  }

  // ── Socket.IO-Verifikation ───────────────────────────────────────────────
  function verifyWithSocket(token) {
    return new Promise(resolve => {
      _socket = window.io ? window.io() : null;
      if (!_socket) { resolve(false); return; }

      const timeout = setTimeout(() => { resolve(false); showLoginScreen(); }, 5000);

      _socket.emit('auth_token', { token });
      _socket.on('auth_ok', ({ user, token: newToken }) => {
        clearTimeout(timeout);
        _setUser(user, newToken || token);
        _fire();
        resolve(true);
      });
      _socket.on('auth_err', () => {
        clearTimeout(timeout);
        resolve(false);
        showLoginScreen();
      });
    });
  }

  // ── Login per Socket.IO ──────────────────────────────────────────────────
  function loginWithSocket(username, password) {
    return new Promise((resolve, reject) => {
      if (!window.io) { reject(new Error('Socket.IO nicht verfügbar')); return; }
      _socket = _socket || window.io();
      _socket.emit('auth_login', { username, password });
      _socket.once('auth_ok', ({ user, token }) => {
        _setUser(user, token);
        localStorage.setItem(TOKEN_KEY, token);
        _fire(); resolve(user);
      });
      _socket.once('auth_err', err => reject(new Error(err?.message || 'Login fehlgeschlagen')));
    });
  }

  // ── Registrierung per Socket.IO ──────────────────────────────────────────
  function registerWithSocket(username, password) {
    return new Promise((resolve, reject) => {
      if (!window.io) { reject(new Error('Socket.IO nicht verfügbar')); return; }
      _socket = _socket || window.io();
      _socket.emit('auth_register', { username, password });
      _socket.once('auth_ok', ({ user, token }) => {
        _setUser(user, token);
        localStorage.setItem(TOKEN_KEY, token);
        _fire(); resolve(user);
      });
      _socket.once('auth_err', err => reject(new Error(err?.message || 'Registrierung fehlgeschlagen')));
    });
  }

  // ── Gast-Login (Offline) ─────────────────────────────────────────────────
  function loginAsGuest(name) {
    const guestName = (name || 'Gast').trim() || 'Gast';
    _setUser({ id: 'guest_' + Date.now(), username: guestName, isGuest: true }, null);
    _fire();
  }

  // ── Logout ───────────────────────────────────────────────────────────────
  function logout() {
    _user = null; _token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    showLoginScreen();
  }

  // ── Intern ───────────────────────────────────────────────────────────────
  function _setUser(user, token) {
    _user  = user;
    _token = token;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function _fire() {
    _onReady.forEach(cb => cb(_user));
    _onReady = [];
    hideLoginScreen();
    updateUserBadge();
  }

  // ── Login-Screen ─────────────────────────────────────────────────────────
  function showLoginScreen() {
    let overlay = document.getElementById('auth-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'auth-overlay';
      overlay.innerHTML = `
        <div class="auth-box">
          <div class="auth-emblem">⚔</div>
          <h1 class="auth-title">D&D <span>Charakterbogen</span></h1>
          <p class="auth-sub">Melde dich mit deinem HexForge-Konto an</p>

          <div id="auth-error" class="auth-error hidden"></div>

          <div class="auth-tabs">
            <button class="auth-tab active" data-mode="login">Anmelden</button>
            <button class="auth-tab" data-mode="register">Registrieren</button>
          </div>

          <div class="form-group">
            <label>Benutzername</label>
            <input type="text" id="auth-username" placeholder="Dein HexForge-Name" autocomplete="username" />
          </div>
          <div class="form-group">
            <label>Passwort</label>
            <input type="password" id="auth-password" placeholder="••••••••" autocomplete="current-password" />
          </div>

          <button class="btn-primary" id="auth-submit" style="width:100%;margin-bottom:10px;">Anmelden</button>
          <button class="btn-secondary" id="auth-guest" style="width:100%;">Ohne Konto weitermachen (Gast)</button>

          <p class="auth-note">Gäste können Charaktere nur lokal speichern</p>
        </div>
      `;
      document.body.appendChild(overlay);

      // Tab-Umschalter
      let _mode = 'login';
      overlay.querySelectorAll('.auth-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          _mode = btn.dataset.mode;
          overlay.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.mode === _mode));
          document.getElementById('auth-submit').textContent = _mode === 'login' ? 'Anmelden' : 'Registrieren';
        });
      });

      // Submit
      const submit = async () => {
        const username = document.getElementById('auth-username').value.trim();
        const password = document.getElementById('auth-password').value;
        const errEl    = document.getElementById('auth-error');
        errEl.classList.add('hidden');

        if (!username || !password) {
          errEl.textContent = 'Bitte Name und Passwort eingeben';
          errEl.classList.remove('hidden'); return;
        }

        document.getElementById('auth-submit').textContent = '⏳ …';
        try {
          if (_mode === 'login')    await loginWithSocket(username, password);
          else                      await registerWithSocket(username, password);
        } catch(e) {
          errEl.textContent = e.message;
          errEl.classList.remove('hidden');
          document.getElementById('auth-submit').textContent = _mode === 'login' ? 'Anmelden' : 'Registrieren';
        }
      };

      document.getElementById('auth-submit').addEventListener('click', submit);
      document.getElementById('auth-password').addEventListener('keydown', e => { if(e.key==='Enter') submit(); });
      document.getElementById('auth-guest').addEventListener('click', () => {
        const name = document.getElementById('auth-username').value.trim();
        loginAsGuest(name || 'Gast');
      });
    }
    overlay.style.display = 'flex';
  }

  function hideLoginScreen() {
    const overlay = document.getElementById('auth-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function updateUserBadge() {
    let badge = document.getElementById('user-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'user-badge';
      badge.style.cssText = 'position:fixed;top:10px;right:56px;z-index:200;display:flex;align-items:center;gap:6px;';
      document.body.appendChild(badge);
    }
    const u = _user;
    badge.innerHTML = `
      <div style="background:rgba(26,18,8,0.9);border:1px solid var(--gold);border-radius:20px;padding:4px 12px;display:flex;align-items:center;gap:8px;">
        <span style="font-family:var(--font-title);font-size:11px;color:var(--gold);letter-spacing:1px;">
          ${u?.isGuest ? '👤 Gast' : '⚔ ' + u?.username}
        </span>
        <button id="btn-logout" style="background:none;border:none;color:#8a7060;cursor:pointer;font-size:12px;padding:0;" title="Abmelden">✕</button>
      </div>
    `;
    document.getElementById('btn-logout')?.addEventListener('click', logout);
  }

  return { init, onReady, getUser, getToken, isGuest, logout, loginAsGuest };
})();

window.Auth = Auth;
