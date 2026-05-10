/**
 * campaign.js — Kampagnen-Übersicht
 * Zeigt alle geteilten Charaktere der Mitspieler
 */

const CampaignUI = (() => {

  let _refreshInterval = null;

  function init() {
    renderCampaign();
    // Auto-Refresh alle 30 Sekunden
    if (_refreshInterval) clearInterval(_refreshInterval);
    _refreshInterval = setInterval(() => {
      const tab = document.getElementById('tab-campaign');
      if (tab?.classList.contains('active')) renderCampaign();
    }, 30000);
  }

  async function renderCampaign() {
    const container = document.getElementById('tab-campaign');
    if (!container) return;

    // Loading state
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#8a7060;font-style:italic;">⏳ Lade Kampagnendaten…</div>';

    const currentUser = window.Auth ? window.Auth.getUser() : null;

    // Server-Daten laden, Fallback auf localStorage
    let shared = await Character.getSharedFromServer();
    if (!shared.length) shared = Character.getSharedChars();

    container.innerHTML = `
      <div class="section-header">
        <h2>Kampagne</h2>
        <button class="btn-secondary" id="btn-refresh-campaign"
          style="font-size:12px;">🔄 Aktualisieren</button>
      </div>

      <div class="campaign-layout">

        <!-- Meine geteilten Charaktere -->
        <div class="card">
          <h3>Mein aktiver Charakter</h3>
          ${renderMyCharCard(currentUser)}
        </div>

        <!-- Alle Mitspieler -->
        <div class="card campaign-party-card">
          <h3>Gruppe <span class="badge">${shared.length}</span></h3>
          ${shared.length === 0
            ? '<div class="empty-state" style="padding:20px 0;"><div class="empty-icon">🛡️</div><p>Noch keine geteilten Charaktere.<br>Teile deinen Charakter über 📂 → 🌐</p></div>'
            : '<div class="party-grid">' + shared.map(c => renderPartyCard(c, currentUser)).join('') + '</div>'
          }
        </div>

      </div>
    `;

    document.getElementById('btn-refresh-campaign')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-refresh-campaign');
      if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
      await renderCampaign();
      if (btn) { btn.textContent = '🔄 Aktualisieren'; btn.disabled = false; }
      showToast('🔄 Kampagne aktualisiert');
    });

    // Detail-Ansicht bei Klick
    container.querySelectorAll('[data-view-char]').forEach(btn => {
      btn.addEventListener('click', () => {
        const charId = btn.dataset.viewChar;
        const char   = Character.loadShared(charId);
        if (char) showCharDetail(char);
      });
    });
  }

  function renderMyCharCard(user) {
    const char    = Character.data;
    const isShared = Character.isShared();
    if (!char.name) return '<p style="color:#8a7060;font-style:italic;font-size:13px;">Kein Charakter geladen. Erstelle oder lade einen Charakter im Charakter-Tab.</p>';

    const cls = DnDData.getClassById(char.classId);
    return `
      <div class="party-card my-card">
        <div class="party-card-header">
          <span class="party-card-icon">${cls?.icon || '⚔'}</span>
          <div class="party-card-info">
            <div class="party-card-name">${char.name || 'Unbenannt'}</div>
            <div class="party-card-meta">${cls?.name || '–'} · Level ${char.level} · ${char.race || 'Keine Rasse'}</div>
            <div style="font-size:11px;color:#8a7060;">${user?.username || ''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
            <span style="font-family:var(--font-title);font-size:10px;padding:3px 8px;border-radius:10px;
              background:${isShared ? 'rgba(34,197,94,0.15)' : 'rgba(139,26,26,0.1)'};
              border:1px solid ${isShared ? '#22c55e' : 'rgba(139,26,26,0.3)'};
              color:${isShared ? '#15803d' : '#8a7060'};">
              ${isShared ? '🌐 Geteilt' : '🔒 Privat'}
            </span>
          </div>
        </div>
        <div class="party-card-stats">
          <div class="party-stat"><span class="party-stat-label">HP</span><span class="party-stat-val">${char.hp_current}/${char.hp_max}</span></div>
          <div class="party-stat"><span class="party-stat-label">AC</span><span class="party-stat-val">${char.ac}</span></div>
          <div class="party-stat"><span class="party-stat-label">Speed</span><span class="party-stat-val">${char.speed} ft</span></div>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;">
          <button class="btn-primary" id="btn-toggle-share"
            style="flex:1;font-size:11px;padding:6px;">
            ${isShared ? '🔒 Teilen aufheben' : '🌐 Mit Kampagne teilen'}
          </button>
        </div>
      </div>
    `;
  }

  function renderPartyCard(char, currentUser) {
    const cls    = DnDData.getClassById(char.classId);
    const isOwn  = currentUser && char._ownerId === currentUser.id;
    const abilities = char.abilities || {};

    return `
      <div class="party-card ${isOwn ? 'my-card' : ''}">
        <div class="party-card-header">
          <span class="party-card-icon">${cls?.icon || '⚔'}</span>
          <div class="party-card-info">
            <div class="party-card-name">${char.name || 'Unbenannt'}</div>
            <div class="party-card-meta">${cls?.name || '–'} · Level ${char.level} · ${char.race || ''}</div>
            <div style="font-size:11px;color:#8a7060;">Spieler: ${char._ownerName || '?'}${isOwn ? ' (du)' : ''}</div>
          </div>
        </div>

        <!-- Attribute kompakt -->
        <div class="party-attr-row">
          ${['str','dex','con','int','wis','cha'].map(ab => `
            <div class="party-attr">
              <div class="party-attr-label">${ab.toUpperCase()}</div>
              <div class="party-attr-val">${abilities[ab] || 10}</div>
              <div class="party-attr-mod">${fmtMod(Math.floor(((abilities[ab]||10)-10)/2))}</div>
            </div>
          `).join('')}
        </div>

        <!-- Stats -->
        <div class="party-card-stats">
          <div class="party-stat"><span class="party-stat-label">HP</span><span class="party-stat-val">${char.hp_current}/${char.hp_max}</span></div>
          <div class="party-stat"><span class="party-stat-label">AC</span><span class="party-stat-val">${char.ac}</span></div>
          <div class="party-stat"><span class="party-stat-label">Prof.</span><span class="party-stat-val">${fmtMod(Math.ceil(char.level/4)+1)}</span></div>
          <div class="party-stat"><span class="party-stat-label">Speed</span><span class="party-stat-val">${char.speed||30} ft</span></div>
        </div>

        <!-- Klassenmerkmale -->
        ${char.class_features?.length ? `
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:3px;">
            ${char.class_features.slice(0,5).map(f =>
              `<span class="detail-tag" style="font-size:10px;padding:1px 6px;">${f}</span>`
            ).join('')}
            ${char.class_features.length > 5 ? `<span style="font-size:10px;color:#8a7060;align-self:center;">+${char.class_features.length-5}</span>` : ''}
          </div>` : ''}

        <!-- Spells -->
        ${char.spellIds?.length ? `
          <div style="margin-top:6px;font-size:12px;color:#8a7060;">
            ✨ ${char.spellIds.length} Spell${char.spellIds.length!==1?'s':''}
          </div>` : ''}

        <div style="margin-top:10px;font-size:10px;color:#a09080;text-align:right;">
          Geteilt: ${char._sharedAt ? new Date(char._sharedAt).toLocaleDateString('de-DE') : '–'}
        </div>
      </div>
    `;
  }

  function fmtMod(n) { return (n >= 0 ? '+' : '') + n; }

  function showCharDetail(char) {
    const cls = DnDData.getClassById(char.classId);
    const abilities = char.abilities || {};

    showModal(`${cls?.icon || '⚔'} ${char.name}`, `
      <div style="font-size:14px;">
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
          <span class="detail-tag">${cls?.name || '–'}</span>
          <span class="detail-tag">Level ${char.level}</span>
          <span class="detail-tag">${char.race || 'Keine Rasse'}</span>
          <span class="detail-tag">HP: ${char.hp_current}/${char.hp_max}</span>
          <span class="detail-tag">AC: ${char.ac}</span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:12px;">
          ${['str','dex','con','int','wis','cha'].map(ab => `
            <div style="text-align:center;background:rgba(139,26,26,0.08);border:1px solid rgba(139,26,26,0.2);border-radius:4px;padding:6px 4px;">
              <div style="font-family:var(--font-title);font-size:9px;color:var(--blood);letter-spacing:1px;">${ab.toUpperCase()}</div>
              <div style="font-family:var(--font-title);font-size:18px;font-weight:800;color:var(--ink);">${abilities[ab]||10}</div>
              <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);">${fmtMod(Math.floor(((abilities[ab]||10)-10)/2))}</div>
            </div>
          `).join('')}
        </div>

        ${char.class_features?.length ? `
          <div style="margin-bottom:10px;">
            <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Klassenmerkmale</div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">
              ${char.class_features.map(f => `<span class="detail-tag">${f}</span>`).join('')}
            </div>
          </div>` : ''}

        ${char.notes ? `
          <div>
            <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Notizen</div>
            <p style="font-size:13px;color:var(--ink-light);line-height:1.5;">${char.notes}</p>
          </div>` : ''}

        <div style="margin-top:12px;font-size:11px;color:#a09080;">
          Spieler: ${char._ownerName || '?'} · 
          Geteilt: ${char._sharedAt ? new Date(char._sharedAt).toLocaleDateString('de-DE') : '–'}
        </div>
      </div>
    `);
  }

  return { init, renderCampaign };
})();

window.CampaignUI = CampaignUI;
