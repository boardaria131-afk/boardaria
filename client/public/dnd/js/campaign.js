/**
 * campaign.js — Kampagnen-System mit Join-Code
 * Spieler können Kampagnen erstellen, joinen und Charaktere teilen.
 */

const CampaignUI = (() => {
  let _refreshInterval = null;
  const CAMP_KEY = 'dnd_campaign'; // localStorage: aktive Kampagne

  // ── Kampagnen-Daten ───────────────────────────────────────────────────────
  function getCampaign() {
    try { return JSON.parse(localStorage.getItem(CAMP_KEY) || 'null'); }
    catch { return null; }
  }

  function saveCampaign(data) {
    localStorage.setItem(CAMP_KEY, JSON.stringify(data));
  }

  function leaveCampaign() {
    localStorage.removeItem(CAMP_KEY);
  }

  // ── Server API ────────────────────────────────────────────────────────────
  async function apiCall(method, path, body) {
    const token = window.Auth ? window.Auth.getToken() : null;
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
    };
    if (body) opts.body = JSON.stringify(body);
    const resp = await fetch(path, opts);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data.error || 'Fehler ' + resp.status);
    return data;
  }

  async function createCampaign(name) {
    const data = await apiCall('POST', '/api/dnd/campaigns', { name });
    saveCampaign({ id: data.id, name: data.name, code: data.code, isOwner: true });
    return data;
  }

  async function joinCampaign(code) {
    const data = await apiCall('POST', '/api/dnd/campaigns/join', { code });
    saveCampaign({ id: data.id, name: data.name, code: data.code, isOwner: false });
    return data;
  }

  async function getSharedChars() {
    const camp = getCampaign();
    if (!camp) return Character.getSharedChars(); // Fallback localStorage
    try {
      const data = await apiCall('GET', '/api/dnd/shared');
      return data.characters || [];
    } catch { return Character.getSharedChars(); }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    renderCampaign();
    if (_refreshInterval) clearInterval(_refreshInterval);
    _refreshInterval = setInterval(() => {
      const tab = document.getElementById('tab-campaign');
      if (tab?.classList.contains('active')) renderCampaign();
    }, 30000);
  }

  // ── Haupt-Render ──────────────────────────────────────────────────────────
  async function renderCampaign() {
    const container = document.getElementById('tab-campaign');
    if (!container) return;

    const camp = getCampaign();
    const currentUser = window.Auth ? window.Auth.getUser() : null;

    container.innerHTML = '<div style="padding:40px;text-align:center;color:#8a7060;font-style:italic;">⏳ Lade Kampagne…</div>';

    const shared = await getSharedChars();

    container.innerHTML = `
      <div class="section-header">
        <h2>⚔ Kampagne</h2>
        <button class="btn-secondary" id="btn-refresh-campaign" style="font-size:11px;">🔄 Aktualisieren</button>
      </div>

      <!-- Initiative Tracker -->
      <div class="card" style="grid-column:1/-1;margin-bottom:0;">
        <div id="initiative-tracker"></div>
      </div>

      <!-- Battlemap -->
      <div class="card" style="grid-column:1/-1;">
        <div id="battlemap-container" data-dm="false"></div>
      </div>

      <!-- Kampagnen-Panel -->
      <div class="campaign-layout">

        <!-- Linke Spalte: Kampagnen-Info + Mein Char -->
        <div style="display:flex;flex-direction:column;gap:16px;">

          <!-- Kampagne: beitreten / erstellen -->
          <div class="card" id="campaign-panel">
            ${camp ? renderCampaignActive(camp) : renderCampaignJoin()}
          </div>

          <!-- Mein Charakter -->
          <div class="card">
            <h3>Mein Charakter</h3>
            ${renderMyCharCard(currentUser)}
          </div>
        </div>

        <!-- Rechte Spalte: Gruppe -->
        <div class="card campaign-party-card">
          <h3>Gruppe <span class="badge">${shared.length}</span></h3>
          ${shared.length === 0
            ? '<div class="empty-state" style="padding:20px 0;"><div class="empty-icon">🛡️</div><p>Noch keine geteilten Charaktere.<br>Teile deinen Charakter über 📂 → 🌐</p></div>'
            : '<div class="party-grid">' + shared.map(c => renderPartyCard(c, currentUser)).join('') + '</div>'}
        </div>

      </div>
    `;

    // Events
    // Initiative Tracker rendern
    if (typeof InitiativeUI !== 'undefined') InitiativeUI.render();

    // Battlemap initialisieren/aktualisieren
    const campData = JSON.parse(localStorage.getItem('dnd_campaign') || 'null');
    if (campData && typeof BattleMap !== 'undefined') {
      if (!document.getElementById('battlemap-canvas')) {
        BattleMap.init(false); // false = Spieler-Modus
      }
    }

    document.getElementById('btn-refresh-campaign')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-refresh-campaign');
      if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
      await renderCampaign();
      if (btn) { btn.textContent = '🔄 Aktualisieren'; btn.disabled = false; }
      showToast('🔄 Kampagne aktualisiert');
    });

    bindCampaignEvents(camp);

    // Klick auf Party-Card → Detail
    container.querySelectorAll('[data-view-char]').forEach(btn => {
      btn.addEventListener('click', () => {
        const char = shared.find(c => c.id === btn.dataset.viewChar);
        if (char) showCharDetail(char);
      });
    });
  }

  // ── Kampagne: kein aktiver Kampagne ──────────────────────────────────────
  function renderCampaignJoin() {
    return `
      <h3>Kampagne</h3>
      <p style="font-size:13px;color:#8a7060;margin-bottom:12px;">
        Erstelle eine neue Kampagne oder tritt einer bestehenden mit einem Code bei.
      </p>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;">
        <button class="btn-primary" id="btn-create-campaign" style="width:100%;">
          ⚔ Neue Kampagne erstellen
        </button>
      </div>

      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="flex:1;height:1px;background:rgba(200,165,90,0.3);"></div>
        <span style="font-size:11px;color:#8a7060;font-family:var(--font-title);">ODER</span>
        <div style="flex:1;height:1px;background:rgba(200,165,90,0.3);"></div>
      </div>

      <div class="form-group" style="margin-bottom:8px;">
        <label>Kampagnen-Code eingeben</label>
        <input type="text" id="camp-join-code" placeholder="z.B. DRACH-7821"
          style="text-transform:uppercase;letter-spacing:2px;font-family:var(--font-title);font-size:14px;" />
      </div>
      <button class="btn-secondary" id="btn-join-campaign" style="width:100%;">
        🔑 Kampagne beitreten
      </button>
      <div id="camp-error" style="color:var(--blood);font-size:12px;margin-top:6px;"></div>
    `;
  }

  // ── Kampagne: aktive Kampagne ─────────────────────────────────────────────
  function renderCampaignActive(camp) {
    return `
      <h3>${camp.name}</h3>
      <div style="margin:10px 0;">
        <div style="font-family:var(--font-title);font-size:10px;color:#8a7060;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Einladungs-Code</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div id="camp-code-display" style="
            font-family:var(--font-title);font-size:22px;font-weight:800;
            color:var(--gold);letter-spacing:4px;
            background:rgba(201,150,42,0.1);border:1px solid rgba(201,150,42,0.3);
            border-radius:6px;padding:8px 16px;flex:1;text-align:center;">
            ${camp.code || '–'}
          </div>
          <button id="btn-copy-code" class="btn-secondary" style="padding:8px 12px;" title="Code kopieren">📋</button>
        </div>
        <p style="font-size:11px;color:#8a7060;margin-top:4px;text-align:center;">
          Teile diesen Code mit deinen Mitspielern
        </p>
        <button id="btn-show-qr" class="btn-secondary" style="width:100%;margin-top:6px;font-size:11px;">
          📱 QR-Code anzeigen
        </button>
        <div id="qr-container" style="display:none;text-align:center;margin-top:8px;"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn-secondary" id="btn-leave-campaign" style="flex:1;font-size:11px;">
          🚪 Kampagne verlassen
        </button>
        ${camp.isOwner ? `<button class="btn-secondary" id="btn-rename-campaign" style="flex:1;font-size:11px;">✏️ Umbenennen</button>` : ''}
      </div>
    `;
  }

  // ── Events ────────────────────────────────────────────────────────────────
  function bindCampaignEvents(camp) {
    const errEl = document.getElementById('camp-error');

    if (!camp) {
      // Erstellen
      document.getElementById('btn-create-campaign')?.addEventListener('click', async () => {
        const name = prompt('Name der Kampagne:', 'Meine Kampagne');
        if (!name) return;
        try {
          const data = await createCampaign(name.trim());
          showToast('⚔ Kampagne "' + data.name + '" erstellt! Code: ' + data.code);
          renderCampaign();
        } catch(e) {
          // Server-Endpunkt noch nicht vorhanden → lokalen Modus nutzen
          const code = generateCode();
          saveCampaign({ id: 'local_' + Date.now(), name: name.trim(), code, isOwner: true });
          showToast('⚔ Kampagne erstellt (lokal)! Code: ' + code);
          renderCampaign();
        }
      });

      // Beitreten
      document.getElementById('btn-join-campaign')?.addEventListener('click', async () => {
        const code = (document.getElementById('camp-join-code')?.value || '').trim().toUpperCase();
        if (!code) { if(errEl) errEl.textContent = '❌ Bitte Code eingeben'; return; }
        try {
          await joinCampaign(code);
          showToast('✅ Kampagne beigetreten!');
          renderCampaign();
        } catch(e) {
          // Lokaler Fallback
          saveCampaign({ id: 'joined_' + code, name: 'Kampagne ' + code, code, isOwner: false });
          showToast('✅ Code gespeichert (lokal)');
          renderCampaign();
        }
      });

      document.getElementById('camp-join-code')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('btn-join-campaign')?.click();
      });
    } else {
      // Code kopieren
      document.getElementById('btn-copy-code')?.addEventListener('click', () => {
        navigator.clipboard?.writeText(camp.code);
        showToast('📋 Code "' + camp.code + '" kopiert!');
      });

      // Verlassen
      document.getElementById('btn-leave-campaign')?.addEventListener('click', () => {
        if (confirm('Kampagne wirklich verlassen?')) {
          leaveCampaign();
          showToast('🚪 Kampagne verlassen');
          renderCampaign();
        }
      });

      // Umbenennen
      document.getElementById('btn-rename-campaign')?.addEventListener('click', () => {
        const newName = prompt('Neuer Name:', camp.name);
        if (newName) {
          camp.name = newName.trim();
          saveCampaign(camp);
          renderCampaign();
        }
      });
    }

    // Share-Toggle
    document.getElementById('btn-toggle-share')?.addEventListener('click', async () => {
      if (Character.isShared()) {
        Character.unshare();
        await Character.unshareFromServer(Character.data.id).catch(() => {});
        showToast('🔒 Charakter ist jetzt privat');
      } else {
        Character.share();
        await Character.shareToServer(Character.data).catch(() => {});
        showToast('🌐 Charakter geteilt!');
      }
      renderCampaign();
    });
  }

  // ── Code-Generator ────────────────────────────────────────────────────────
  function generateCode() {
    const words = ['DRACH','MAGUS','ROGUE','BARDE','PALAD','KLERP','MONCH','JAGER','BARBAR','ZAUBR'];
    const word  = words[Math.floor(Math.random() * words.length)];
    const num   = Math.floor(Math.random() * 9000) + 1000;
    return word + '-' + num;
  }

  // ── Karten-Render ─────────────────────────────────────────────────────────
  function renderMyCharCard(user) {
    const char     = Character.data;
    const isShared = Character.isShared();
    if (!char.name) return '<p style="color:#8a7060;font-style:italic;font-size:13px;">Kein Charakter geladen.</p>';

    const cls = DnDData.getClassById(char.classId);
    return `
      <div class="party-card my-card">
        <div class="party-card-header">
          <span class="party-card-icon">${cls?.icon || '⚔'}</span>
          <div class="party-card-info">
            <div class="party-card-name">${char.name || 'Unbenannt'}</div>
            <div class="party-card-meta">${cls?.name || '–'} · Level ${char.level} · ${char.race || '–'}</div>
            <div style="font-size:11px;color:#8a7060;">${user?.username || ''}</div>
          </div>
          <span style="font-family:var(--font-title);font-size:10px;padding:3px 8px;border-radius:10px;
            background:${isShared?'rgba(34,197,94,0.15)':'rgba(139,26,26,0.1)'};
            border:1px solid ${isShared?'#22c55e':'rgba(139,26,26,0.3)'};
            color:${isShared?'#15803d':'#8a7060'};">
            ${isShared?'🌐 Geteilt':'🔒 Privat'}
          </span>
        </div>
        <div class="party-card-stats">
          <div class="party-stat"><span class="party-stat-label">HP</span><span class="party-stat-val">${char.hp_current}/${char.hp_max}</span></div>
          <div class="party-stat"><span class="party-stat-label">AC</span><span class="party-stat-val">${char.ac}</span></div>
          <div class="party-stat"><span class="party-stat-label">Speed</span><span class="party-stat-val">${char.speed||30} ft</span></div>
        </div>
        <button class="btn-primary" id="btn-toggle-share" style="width:100%;margin-top:10px;font-size:11px;">
          ${isShared?'🔒 Teilen aufheben':'🌐 Mit Gruppe teilen'}
        </button>
      </div>
    `;
  }

  function renderPartyCard(char, currentUser) {
    const cls   = DnDData.getClassById(char.classId);
    const isOwn = currentUser && char._ownerId === currentUser.id;
    const ab    = char.abilities || {};
    const fmtM  = n => (n>=0?'+':'')+n;

    return `
      <div class="party-card ${isOwn?'my-card':''}" data-view-char="${char.id}" style="cursor:pointer;">
        <div class="party-card-header">
          <span class="party-card-icon">${cls?.icon||'⚔'}</span>
          <div class="party-card-info">
            <div class="party-card-name">${char.name||'Unbenannt'}</div>
            <div class="party-card-meta">${cls?.name||'–'} · Level ${char.level} · ${char.race||''}</div>
            <div style="font-size:11px;color:#8a7060;">Spieler: ${char._ownerName||'?'}${isOwn?' (du)':''}</div>
          </div>
        </div>
        <div class="party-attr-row">
          ${['str','dex','con','int','wis','cha'].map(a=>`
            <div class="party-attr">
              <div class="party-attr-label">${a.toUpperCase()}</div>
              <div class="party-attr-val">${ab[a]||10}</div>
              <div class="party-attr-mod">${fmtM(Math.floor(((ab[a]||10)-10)/2))}</div>
            </div>`).join('')}
        </div>
        <div class="party-card-stats">
          <div class="party-stat"><span class="party-stat-label">HP</span><span class="party-stat-val">${char.hp_current}/${char.hp_max}</span></div>
          <div class="party-stat"><span class="party-stat-label">AC</span><span class="party-stat-val">${char.ac}</span></div>
          <div class="party-stat"><span class="party-stat-label">Prof</span><span class="party-stat-val">${fmtM(Math.ceil((char.level||1)/4)+1)}</span></div>
          <div class="party-stat"><span class="party-stat-label">Speed</span><span class="party-stat-val">${char.speed||30}ft</span></div>
        </div>
        ${char.class_features?.length?`
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:3px;">
            ${char.class_features.slice(0,4).map(f=>`<span class="detail-tag" style="font-size:10px;padding:1px 6px;">${f}</span>`).join('')}
            ${char.class_features.length>4?`<span style="font-size:10px;color:#8a7060;align-self:center;">+${char.class_features.length-4}</span>`:''}
          </div>`:''}
        <div style="margin-top:6px;font-size:10px;color:#a09080;text-align:right;">
          Geteilt: ${char._sharedAt?new Date(char._sharedAt).toLocaleDateString('de-DE'):'–'}
        </div>
      </div>
    `;
  }

  function showCharDetail(char) {
    const cls = DnDData.getClassById(char.classId);
    const ab  = char.abilities || {};
    const fmtM = n => (n>=0?'+':'')+n;

    showModal(`${cls?.icon||'⚔'} ${char.name}`, `
      <div style="font-size:14px;">
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
          <span class="detail-tag">${cls?.name||'–'}</span>
          <span class="detail-tag">Level ${char.level}</span>
          <span class="detail-tag">${char.race||'–'}</span>
          <span class="detail-tag">HP: ${char.hp_current}/${char.hp_max}</span>
          <span class="detail-tag">AC: ${char.ac}</span>
          <span class="detail-tag">${char.rulesetId||'5e'}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:12px;">
          ${['str','dex','con','int','wis','cha'].map(a=>`
            <div style="text-align:center;background:rgba(139,26,26,0.08);border:1px solid rgba(139,26,26,0.2);border-radius:4px;padding:6px 4px;">
              <div style="font-family:var(--font-title);font-size:9px;color:var(--blood);letter-spacing:1px;">${a.toUpperCase()}</div>
              <div style="font-family:var(--font-title);font-size:18px;font-weight:800;color:var(--ink);">${ab[a]||10}</div>
              <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);">${fmtM(Math.floor(((ab[a]||10)-10)/2))}</div>
            </div>`).join('')}
        </div>
        ${char.class_features?.length?`
          <div style="margin-bottom:10px;">
            <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Klassenmerkmale</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${char.class_features.map(f=>`<span class="detail-tag">${f}</span>`).join('')}
            </div>
          </div>`:''}
        ${char.race_traits?.length?`
          <div style="margin-bottom:10px;">
            <div style="font-family:var(--font-title);font-size:11px;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Rassenmerkmale</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${char.race_traits.map(t=>`<span class="detail-tag" style="border-color:var(--gold);color:#7a5c1a;">${t}</span>`).join('')}
            </div>
          </div>`:''}
        ${char.spellIds?.length?`<div style="margin-bottom:8px;font-size:12px;color:#8a7060;">✨ ${char.spellIds.length} Spell${char.spellIds.length!==1?'s':''} bekannt</div>`:''}
        ${char.notes?`
          <div>
            <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Notizen</div>
            <p style="font-size:13px;color:var(--ink-light);line-height:1.5;">${char.notes.slice(0,300)}${char.notes.length>300?'…':''}</p>
          </div>`:''}
        <div style="margin-top:12px;font-size:11px;color:#a09080;">
          Spieler: ${char._ownerName||'?'} · Geteilt: ${char._sharedAt?new Date(char._sharedAt).toLocaleDateString('de-DE'):'–'}
        </div>
      </div>
    `);
  }

  return { init, renderCampaign };
})();

window.CampaignUI = CampaignUI;
