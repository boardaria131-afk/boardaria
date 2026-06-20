/**
 * bestiary.js — Monster-Referenz für DM und Spieler
 */

const BestiaryUI = (() => {

  let _monsters = [];
  let _filtered  = [];
  let _search    = '';
  let _filterCR  = '';
  let _filterType= '';

  const CR_ORDER = ['0','1/8','1/4','1/2','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24','25','26','27','28','29','30'];

  function crNum(cr) {
    const map = {'0':0,'1/8':0.125,'1/4':0.25,'1/2':0.5};
    return map[cr] !== undefined ? map[cr] : parseFloat(cr) || 0;
  }

  async function loadMonsters() {
    if (_monsters.length) return;
    try {
      const r = await fetch('/dnd/data/bestiary.json');
      const d = await r.json();
      _monsters = d.monsters || [];
      _monsters.sort((a,b) => crNum(a.cr) - crNum(b.cr) || a.name.localeCompare(b.name));
    } catch(e) { console.error('[Bestiary] Laden fehlgeschlagen:', e); }
  }

  function applyFilter() {
    const q = _search.toLowerCase();
    _filtered = _monsters.filter(m => {
      if (q && !m.name.toLowerCase().includes(q) && !m.type.toLowerCase().includes(q)) return false;
      if (_filterCR && m.cr !== _filterCR) return false;
      if (_filterType && m.type !== _filterType) return false;
      return true;
    });
  }

  function renderPanel() {
    const container = document.getElementById('bestiary-panel');
    if (!container) return;

    const types = [...new Set(_monsters.map(m => m.type))].sort();
    const crs   = [...new Set(_monsters.map(m => m.cr))]
      .sort((a,b) => crNum(a) - crNum(b));

    applyFilter();

    container.innerHTML = `
      <div class="card">
        <div class="card-title">👹 Bestiarium (${_filtered.length}/${_monsters.length})</div>

        <!-- Filter -->
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
          <input type="text" id="bestiary-search" placeholder="🔍 Monster suchen…"
            value="${_search}"
            style="flex:1;min-width:120px;" />
          <select id="bestiary-cr" style="padding:6px;">
            <option value="">Alle CR</option>
            ${crs.map(cr => `<option value="${cr}" ${_filterCR===cr?'selected':''}>CR ${cr}</option>`).join('')}
          </select>
          <select id="bestiary-type" style="padding:6px;">
            <option value="">Alle Typen</option>
            ${types.map(t => `<option value="${t}" ${_filterType===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>

        <!-- Monster-Liste -->
        <div style="display:flex;flex-direction:column;gap:4px;max-height:500px;overflow-y:auto;" id="bestiary-list">
          ${_filtered.length === 0
            ? '<div style="color:#8a7060;font-style:italic;font-size:13px;text-align:center;padding:20px;">Keine Monster gefunden</div>'
            : _filtered.map(m => renderMonsterRow(m)).join('')}
        </div>
      </div>
    `;

    // Events
    document.getElementById('bestiary-search')?.addEventListener('input', e => {
      _search = e.target.value;
      applyFilter();
      document.getElementById('bestiary-list').innerHTML = _filtered.map(renderMonsterRow).join('');
      bindRowEvents();
    });
    document.getElementById('bestiary-cr')?.addEventListener('change', e => {
      _filterCR = e.target.value;
      applyFilter();
      document.getElementById('bestiary-list').innerHTML = _filtered.map(renderMonsterRow).join('');
      bindRowEvents();
    });
    document.getElementById('bestiary-type')?.addEventListener('change', e => {
      _filterType = e.target.value;
      applyFilter();
      document.getElementById('bestiary-list').innerHTML = _filtered.map(renderMonsterRow).join('');
      bindRowEvents();
    });

    bindRowEvents();
  }

  function renderMonsterRow(m) {
    const crColor = crNum(m.cr) >= 17 ? '#ef4444'
      : crNum(m.cr) >= 11 ? '#f59e0b'
      : crNum(m.cr) >= 5  ? '#a855f7'
      : crNum(m.cr) >= 1  ? '#3b82f6' : '#6b7280';

    return `
      <div class="monster-row" data-id="${m.id}"
        style="display:flex;align-items:center;gap:8px;padding:7px 10px;
        background:rgba(255,255,255,0.45);border:1px solid rgba(200,165,90,0.2);
        border-radius:6px;cursor:pointer;transition:all 0.15s;">
        <div style="text-align:center;min-width:40px;padding:3px 6px;border-radius:4px;
          background:${crColor}22;border:1px solid ${crColor}44;">
          <div style="font-family:var(--font-title);font-size:9px;color:#8a7060;">CR</div>
          <div style="font-family:var(--font-title);font-size:12px;font-weight:700;color:${crColor};">${m.cr}</div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-title);font-size:13px;font-weight:600;color:var(--ink);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.name}</div>
          <div style="font-size:11px;color:#8a7060;">${m.size} ${m.type}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:11px;color:var(--ink-light);">AC ${m.ac}</div>
          <div style="font-size:11px;color:var(--blood-light);">HP ${m.hp}</div>
        </div>
        <span style="color:rgba(200,165,90,0.4);font-size:14px;">›</span>
      </div>`;
  }

  function bindRowEvents() {
    document.querySelectorAll('.monster-row').forEach(row => {
      row.addEventListener('mouseenter', () => row.style.background = 'rgba(139,26,26,0.08)');
      row.addEventListener('mouseleave', () => row.style.background = 'rgba(255,255,255,0.45)');
      row.addEventListener('click', () => {
        const m = _monsters.find(x => x.id === row.dataset.id);
        if (m) showMonsterDetail(m);
      });
    });
  }

  function showMonsterDetail(m) {
    const AB = ['str','dex','con','int','wis','cha'];
    const AL = ['STR','DEX','CON','INT','WIS','CHA'];
    const fmtMod = n => { const mod = Math.floor((n-10)/2); return (mod>=0?'+':'')+mod; };

    showModal(`👹 ${m.name}`, `
      <div>
        <!-- Info Row -->
        <div style="font-size:13px;color:#8a7060;margin-bottom:10px;">
          ${m.size} ${m.type} · CR ${m.cr} · AC ${m.ac} · HP ${m.hp}
        </div>
        <div style="font-size:12px;color:#8a7060;margin-bottom:8px;">
          🏃 ${m.speed}
          ${m.senses ? ' · 👁 ' + m.senses : ''}
        </div>
        ${m.languages ? `<div style="font-size:12px;color:#8a7060;margin-bottom:10px;">🗣 ${m.languages}</div>` : ''}

        <!-- Attribute -->
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-bottom:12px;
          background:rgba(255,255,255,0.5);border-radius:6px;padding:8px;">
          ${AB.map((ab,i) => `
            <div style="text-align:center;">
              <div style="font-family:var(--font-title);font-size:9px;color:#8a7060;text-transform:uppercase;">${AL[i]}</div>
              <div style="font-family:var(--font-title);font-size:16px;font-weight:700;color:var(--ink);">${m[ab]||10}</div>
              <div style="font-size:11px;color:var(--blood-light);">${fmtMod(m[ab]||10)}</div>
            </div>`).join('')}
        </div>

        <!-- Resistances -->
        ${m.damage_vulnerabilities ? `<div style="font-size:12px;margin-bottom:4px;"><span style="color:#f87171;">⚡ Schwäche:</span> ${m.damage_vulnerabilities}</div>` : ''}
        ${m.damage_resistances ? `<div style="font-size:12px;margin-bottom:4px;"><span style="color:#fbbf24;">🛡 Resistenz:</span> ${m.damage_resistances}</div>` : ''}
        ${m.damage_immunities ? `<div style="font-size:12px;margin-bottom:4px;"><span style="color:#4ade80;">🔰 Immunität:</span> ${m.damage_immunities}</div>` : ''}
        ${m.condition_immunities ? `<div style="font-size:12px;margin-bottom:8px;"><span style="color:#60a5fa;">⚙ Zustandsimmunität:</span> ${m.condition_immunities}</div>` : ''}

        <!-- Aktionen -->
        ${m.actions?.length ? `
          <div style="font-family:var(--font-title);font-size:10px;color:var(--blood);
            text-transform:uppercase;letter-spacing:1px;margin:10px 0 6px;">Aktionen</div>
          ${m.actions.map(a => `
            <div style="margin-bottom:6px;padding:6px 8px;background:rgba(255,255,255,0.4);
              border-left:2px solid var(--blood);border-radius:0 4px 4px 0;">
              <div style="font-family:var(--font-title);font-size:11px;color:var(--ink);font-weight:700;">${a.name}</div>
              <div style="font-size:12px;color:#8a7060;line-height:1.4;">${a.desc}</div>
            </div>`).join('')}` : ''}

        <!-- Legendäre Aktionen -->
        ${m.legendary_actions?.length ? `
          <div style="font-family:var(--font-title);font-size:10px;color:var(--gold);
            text-transform:uppercase;letter-spacing:1px;margin:10px 0 6px;">⭐ Legendäre Aktionen</div>
          ${m.legendary_actions.map(a => `
            <div style="margin-bottom:6px;padding:6px 8px;background:rgba(201,150,42,0.06);
              border-left:2px solid var(--gold);border-radius:0 4px 4px 0;">
              <div style="font-family:var(--font-title);font-size:11px;color:var(--gold);font-weight:700;">${a.name}</div>
              <div style="font-size:12px;color:#8a7060;line-height:1.4;">${a.desc}</div>
            </div>`).join('')}` : ''}

        <!-- Reaktionen -->
        ${m.reactions?.length ? `
          <div style="font-family:var(--font-title);font-size:10px;color:#60a5fa;
            text-transform:uppercase;letter-spacing:1px;margin:10px 0 6px;">⚡ Reaktionen</div>
          ${m.reactions.map(a => `
            <div style="margin-bottom:6px;padding:6px 8px;background:rgba(96,165,250,0.06);
              border-left:2px solid #60a5fa;border-radius:0 4px 4px 0;">
              <div style="font-family:var(--font-title);font-size:11px;color:#60a5fa;font-weight:700;">${a.name}</div>
              <div style="font-size:12px;color:#8a7060;line-height:1.4;">${a.desc}</div>
            </div>`).join('')}` : ''}

        <!-- Beschreibung -->
        ${m.description ? `
          <div style="font-family:var(--font-title);font-size:10px;color:#8a7060;
            text-transform:uppercase;letter-spacing:1px;margin:10px 0 6px;">📖 Beschreibung</div>
          <p style="font-size:13px;color:var(--ink);line-height:1.6;">${m.description}</p>` : ''}

        <!-- Initiative Tracker Button -->
        <button onclick="addMonsterToInitiative('${m.id}')"
          style="width:100%;margin-top:12px;padding:10px;
          background:rgba(139,26,26,0.2);border:1px solid var(--blood-light);
          border-radius:6px;color:#f0a0a0;font-family:var(--font-title);
          font-size:12px;cursor:pointer;letter-spacing:0.5px;">
          ⚔ Zum Initiative-Tracker hinzufügen
        </button>
      </div>
    `);
  }

  function init() {
    loadMonsters().then(() => renderPanel());
  }

  return { init, renderPanel, loadMonsters };
})();

// Hilfsfunktion: Monster direkt aus Detail-Modal zum Initiative Tracker
window.addMonsterToInitiative = function(monsterId) {
  const m = BestiaryUI._monsters?.find ? null : null; // Accessor
  // Daten aus dem DOM lesen
  const modal = document.querySelector('.modal-content');
  const name  = modal?.querySelector('h2')?.textContent?.replace('👹 ','') || monsterId;

  // Zum Initiative-Tracker hinzufügen (falls geöffnet)
  if (typeof InitiativeUI !== 'undefined' && InitiativeUI.addMonsterFromBestiary) {
    InitiativeUI.addMonsterFromBestiary(monsterId);
  }
  closeModal();
  showToast(`👹 ${name} zum Initiative-Tracker hinzugefügt`);
};

window.BestiaryUI = BestiaryUI;
