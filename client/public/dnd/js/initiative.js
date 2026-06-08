/**
 * initiative.js — Initiative Tracker mit Socket.IO Sync
 * Alle Kampagnen-Teilnehmer sehen dieselbe Reihenfolge in Echtzeit
 */

const InitiativeUI = (() => {

  const STORE_KEY = () => {
    const camp = JSON.parse(localStorage.getItem('dnd_campaign') || 'null');
    return camp ? 'dnd_initiative_' + camp.code : 'dnd_initiative_local';
  };

  let _entries = [];    // [{id, name, initiative, hp, maxHp, ac, icon, isPlayer, userId, active}]
  let _activeIdx = 0;
  let _round = 1;
  let _socket = null;

  // ── Persistenz ────────────────────────────────────────────────────────────
  function save() {
    localStorage.setItem(STORE_KEY(), JSON.stringify({ entries: _entries, activeIdx: _activeIdx, round: _round }));
    syncViaCampaign();
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY()) || 'null');
      if (d) { _entries = d.entries || []; _activeIdx = d.activeIdx || 0; _round = d.round || 1; }
    } catch {}
  }

  // Server-Sync über /api/dnd/initiative
  async function syncViaCampaign() {
    const camp  = JSON.parse(localStorage.getItem('dnd_campaign') || 'null');
    const token = window.Auth ? window.Auth.getToken() : null;
    if (!camp || !token) return;
    try {
      await fetch('/api/dnd/initiative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ campaignCode: camp.code, entries: _entries, activeIdx: _activeIdx, round: _round }),
      });
    } catch {}
  }

  async function loadFromServer() {
    const camp  = JSON.parse(localStorage.getItem('dnd_campaign') || 'null');
    const token = window.Auth ? window.Auth.getToken() : null;
    if (!camp || !token) return false;
    try {
      const resp = await fetch('/api/dnd/initiative?code=' + encodeURIComponent(camp.code), {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!resp.ok) return false;
      const d = await resp.json();
      if (d.entries) {
        _entries = d.entries; _activeIdx = d.activeIdx || 0; _round = d.round || 1;
        return true;
      }
    } catch {}
    return false;
  }

  // ── Einträge verwalten ────────────────────────────────────────────────────
  function addEntry(entry) {
    _entries.push({
      id:       entry.id || 'e_' + Date.now(),
      name:     entry.name || 'Unbekannt',
      initiative: parseInt(entry.initiative) || 0,
      hp:       parseInt(entry.hp) || 0,
      maxHp:    parseInt(entry.maxHp) || 0,
      ac:       parseInt(entry.ac) || 10,
      icon:     entry.icon || '⚔',
      isPlayer: !!entry.isPlayer,
      userId:   entry.userId || null,
      active:   false,
    });
    sortEntries();
    save();
    render();
  }

  function removeEntry(id) {
    _entries = _entries.filter(e => e.id !== id);
    _activeIdx = Math.min(_activeIdx, Math.max(0, _entries.length - 1));
    save();
    render();
  }

  function sortEntries() {
    _entries.sort((a, b) => b.initiative - a.initiative);
  }

  function nextTurn() {
    if (!_entries.length) return;
    _entries.forEach(e => e.active = false);
    _activeIdx = (_activeIdx + 1) % _entries.length;
    if (_activeIdx === 0) _round++;
    _entries[_activeIdx].active = true;
    save();
    render();
    showToast(`⚔ ${_entries[_activeIdx].name} ist dran! (Runde ${_round})`);
  }

  function startCombat() {
    if (!_entries.length) { showToast('⚠ Zuerst Teilnehmer hinzufügen'); return; }
    sortEntries();
    _activeIdx = 0;
    _round = 1;
    _entries.forEach((e, i) => e.active = i === 0);
    save();
    render();
    showToast(`⚔ Kampf beginnt! ${_entries[0].name} fängt an!`);
  }

  function resetCombat() {
    if (!confirm('Initiative zurücksetzen?')) return;
    _entries = [];
    _activeIdx = 0;
    _round = 1;
    save();
    render();
  }

  function updateHP(id, delta) {
    const e = _entries.find(x => x.id === id);
    if (!e) return;
    e.hp = Math.max(0, Math.min(e.maxHp || 999, (e.hp || 0) + delta));
    save();
    render();
  }

  // ── Auto-Import aus Charakter ─────────────────────────────────────────────
  function addMyCharacter() {
    const char = Character.data;
    if (!char.name) { showToast('⚠ Kein Charakter geladen'); return; }
    const ab    = char.abilities || {};
    const dexMod = Math.floor(((ab.dex || 10) - 10) / 2);
    const rolled = Math.floor(Math.random() * 20) + 1;
    const init   = rolled + dexMod;
    const cls    = DnDData.getClassById(char.classId);
    const user   = window.Auth ? window.Auth.getUser() : null;

    // Existierenden Eintrag ersetzen
    _entries = _entries.filter(e => e.userId !== user?.id);
    addEntry({
      id:         'player_' + (user?.id || Date.now()),
      name:       char.name,
      initiative: init,
      hp:         char.hp_current || char.hp_max,
      maxHp:      char.hp_max,
      ac:         char.ac || 10,
      icon:       cls?.icon || '⚔',
      isPlayer:   true,
      userId:     user?.id,
    });
    showToast(`🎲 Initiative ${init} (W20: ${rolled} + DEX: ${dexMod >= 0 ? '+' : ''}${dexMod})`);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    const container = document.getElementById('initiative-tracker');
    if (!container) return;

    const camp = JSON.parse(localStorage.getItem('dnd_campaign') || 'null');

    container.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
        <div style="font-family:var(--font-title);font-size:16px;font-weight:700;color:var(--blood);">
          ⚔ Initiative
          ${_entries.length && _entries.some(e=>e.active)
            ? `<span style="font-size:12px;color:#8a7060;font-weight:400;"> — Runde ${_round}</span>`
            : ''}
        </div>
        <div style="flex:1;"></div>
        ${camp ? `<span style="font-size:11px;color:#8a7060;font-family:var(--font-title);">📡 ${camp.name}</span>` : ''}
        <button class="btn-primary" id="btn-init-start" style="font-size:11px;padding:5px 12px;">⚔ Start</button>
        <button class="btn-secondary" id="btn-init-next" style="font-size:11px;padding:5px 12px;"
          ${!_entries.length ? 'disabled' : ''}>▶ Nächster</button>
        <button class="btn-secondary" id="btn-init-reset" style="font-size:11px;padding:5px 10px;">🔄</button>
        <button class="btn-secondary" id="btn-init-refresh" style="font-size:11px;padding:5px 10px;">📡</button>
      </div>

      <!-- Teilnehmer-Liste -->
      <div id="initiative-list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
        ${_entries.length === 0
          ? '<div style="color:#8a7060;font-style:italic;font-size:13px;text-align:center;padding:20px;">Noch keine Teilnehmer — füge Charaktere oder Monster hinzu</div>'
          : _entries.map((e, i) => renderEntry(e, i)).join('')}
      </div>

      <!-- Hinzufügen -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn-primary" id="btn-init-add-me" style="flex:1;font-size:11px;">
          ⚔ Meinen Charakter hinzufügen
        </button>
        <button class="btn-secondary" id="btn-init-add-monster" style="flex:1;font-size:11px;">
          👹 Monster hinzufügen
        </button>
        <button class="btn-secondary" id="btn-init-add-custom" style="font-size:11px;padding:5px 10px;">
          ➕ Manuell
        </button>
      </div>
    `;

    // Events
    document.getElementById('btn-init-start')?.addEventListener('click', startCombat);
    document.getElementById('btn-init-next')?.addEventListener('click', nextTurn);
    document.getElementById('btn-init-reset')?.addEventListener('click', resetCombat);
    document.getElementById('btn-init-refresh')?.addEventListener('click', async () => {
      const ok = await loadFromServer();
      if (ok) { render(); showToast('📡 Aktualisiert'); }
      else showToast('⚠ Keine Server-Daten');
    });
    document.getElementById('btn-init-add-me')?.addEventListener('click', addMyCharacter);
    document.getElementById('btn-init-add-monster')?.addEventListener('click', showMonsterPicker);
    document.getElementById('btn-init-add-custom')?.addEventListener('click', showCustomEntry);

    // HP-Buttons
    container.querySelectorAll('[data-hp-minus]').forEach(btn =>
      btn.addEventListener('click', () => { updateHP(btn.dataset.hpMinus, -1); }));
    container.querySelectorAll('[data-hp-plus]').forEach(btn =>
      btn.addEventListener('click', () => { updateHP(btn.dataset.hpPlus, +1); }));
    container.querySelectorAll('[data-remove]').forEach(btn =>
      btn.addEventListener('click', () => removeEntry(btn.dataset.remove)));
    container.querySelectorAll('[data-hp-input]').forEach(inp =>
      inp.addEventListener('change', () => {
        const e = _entries.find(x => x.id === inp.dataset.hpInput);
        if (e) { e.hp = Math.max(0, parseInt(inp.value)||0); save(); }
      }));
  }

  function renderEntry(e, i) {
    const isActive = e.active;
    const hpPct    = e.maxHp ? Math.max(0, Math.min(1, e.hp / e.maxHp)) : 1;
    const hpColor  = hpPct <= 0.25 ? '#f87171' : hpPct <= 0.5 ? '#fbbf24' : '#4ade80';

    return `
      <div style="
        display:flex;align-items:center;gap:8px;padding:10px 12px;
        background:${isActive ? 'rgba(139,26,26,0.15)' : 'rgba(255,255,255,0.5)'};
        border:${isActive ? '2px solid var(--blood)' : '1px solid rgba(200,165,90,0.3)'};
        border-radius:6px;transition:all 0.2s;
        ${isActive ? 'box-shadow:0 0 12px rgba(139,26,26,0.3);' : ''}
      ">
        <!-- Initiative Badge -->
        <div style="
          min-width:36px;height:36px;border-radius:50%;
          background:${isActive ? 'var(--blood)' : 'rgba(200,165,90,0.15)'};
          border:1px solid ${isActive ? 'var(--blood)' : 'rgba(200,165,90,0.4)'};
          display:flex;align-items:center;justify-content:center;
          font-family:var(--font-title);font-size:14px;font-weight:700;
          color:${isActive ? '#fff' : 'var(--gold)'};flex-shrink:0;">
          ${e.initiative}
        </div>

        <!-- Icon + Name -->
        <div style="font-size:20px;flex-shrink:0;">${e.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:var(--font-title);font-size:13px;font-weight:600;
            color:${isActive ? 'var(--blood)' : 'var(--ink)'};
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${isActive ? '▶ ' : ''}${e.name}
          </div>
          <div style="font-size:11px;color:#8a7060;">
            AC ${e.ac}
            ${e.isPlayer ? ' · Spieler' : ' · Monster'}
          </div>
        </div>

        <!-- HP Tracker -->
        ${e.maxHp ? `
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">
          <button data-hp-minus="${e.id}" style="
            width:24px;height:24px;border-radius:50%;border:1px solid rgba(248,113,113,0.5);
            background:rgba(248,113,113,0.1);color:#f87171;cursor:pointer;font-size:14px;
            display:flex;align-items:center;justify-content:center;line-height:1;">−</button>
          <div style="text-align:center;min-width:52px;">
            <input data-hp-input="${e.id}" type="number" value="${e.hp}"
              style="width:32px;text-align:center;background:transparent;border:none;
              font-family:var(--font-title);font-size:14px;font-weight:700;color:${hpColor};" />
            <div style="font-size:9px;color:#8a7060;">/ ${e.maxHp}</div>
          </div>
          <button data-hp-plus="${e.id}" style="
            width:24px;height:24px;border-radius:50%;border:1px solid rgba(74,222,128,0.5);
            background:rgba(74,222,128,0.1);color:#4ade80;cursor:pointer;font-size:14px;
            display:flex;align-items:center;justify-content:center;line-height:1;">+</button>
        </div>` : ''}

        <!-- Entfernen -->
        <button data-remove="${e.id}" style="
          background:none;border:none;color:rgba(139,26,26,0.4);cursor:pointer;
          font-size:16px;padding:2px;flex-shrink:0;" title="Entfernen">✕</button>
      </div>
    `;
  }

  // ── Monster-Picker ────────────────────────────────────────────────────────
  const MONSTERS = [
    {name:'Goblin',        cr:'1/4', hp:7,  ac:15, icon:'👺', atk:'+4 1d6+2'},
    {name:'Skeleton',      cr:'1/4', hp:13, ac:13, icon:'💀', atk:'+4 1d6+2'},
    {name:'Zombie',        cr:'1/4', hp:22, ac:8,  icon:'🧟', atk:'+3 1d6+1'},
    {name:'Wolf',          cr:'1/4', hp:11, ac:13, icon:'🐺', atk:'+4 2d4+2'},
    {name:'Bandit',        cr:'1/8', hp:11, ac:12, icon:'🗡️', atk:'+3 1d6+1'},
    {name:'Guard',         cr:'1/8', hp:11, ac:16, icon:'🛡️', atk:'+3 1d6+1'},
    {name:'Orc',           cr:'1/2', hp:15, ac:13, icon:'💪', atk:'+5 1d12+3'},
    {name:'Hobgoblin',     cr:'1/2', hp:11, ac:18, icon:'⚔️', atk:'+3 1d8+1'},
    {name:'Bugbear',       cr:'1',   hp:27, ac:16, icon:'👹', atk:'+4 2d8+2'},
    {name:'Gnoll',         cr:'1/2', hp:22, ac:15, icon:'🦴', atk:'+4 1d6+2'},
    {name:'Ghoul',         cr:'1',   hp:22, ac:12, icon:'😱', atk:'+2 2d6+2'},
    {name:'Specter',       cr:'1',   hp:22, ac:12, icon:'👻', atk:'+4 3d6'},
    {name:'Ogre',          cr:'2',   hp:59, ac:11, icon:'🏔️', atk:'+6 2d8+4'},
    {name:'Werewolf',      cr:'3',   hp:58, ac:11, icon:'🐺', atk:'+4 2d4+2'},
    {name:'Troll',         cr:'5',   hp:84, ac:15, icon:'🌿', atk:'+7 2d6+4'},
    {name:'Vampire Spawn', cr:'5',   hp:82, ac:15, icon:'🧛', atk:'+6 2d6+4'},
    {name:'Young Dragon',  cr:'7',   hp:178,ac:18, icon:'🐉', atk:'+7 2d6+5'},
    {name:'Beholder',      cr:'13',  hp:180,ac:18, icon:'👁',  atk:'+9 4d6'},
    {name:'Ancient Dragon',cr:'24',  hp:546,ac:22, icon:'🐲', atk:'+17 4d6+10'},
    {name:'Lich',          cr:'21',  hp:135,ac:17, icon:'☠️', atk:'+12 4d6'},
  ];

  function showMonsterPicker() {
    showModal('👹 Monster hinzufügen', `
      <div style="margin-bottom:10px;">
        <input type="text" id="monster-search" placeholder="🔍 Monster suchen…" style="width:100%;" />
      </div>
      <div id="monster-list" style="display:flex;flex-direction:column;gap:4px;max-height:350px;overflow-y:auto;">
        ${renderMonsterList(MONSTERS)}
      </div>
      <div style="margin-top:10px;">
        <label style="font-size:12px;color:#8a7060;">Anzahl:</label>
        <input type="number" id="monster-count" value="1" min="1" max="10" style="width:60px;margin-left:8px;" />
      </div>
    `);

    document.getElementById('monster-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = MONSTERS.filter(m => m.name.toLowerCase().includes(q));
      document.getElementById('monster-list').innerHTML = renderMonsterList(filtered);
      bindMonsterClicks();
    });
    bindMonsterClicks();
  }

  function renderMonsterList(monsters) {
    return monsters.map(m => `
      <div class="monster-pick-row" data-monster="${m.name}"
        style="display:flex;align-items:center;gap:8px;padding:7px 10px;
          background:rgba(255,255,255,0.4);border:1px solid rgba(200,165,90,0.25);
          border-radius:4px;cursor:pointer;transition:all 0.15s;">
        <span style="font-size:20px;">${m.icon}</span>
        <div style="flex:1;">
          <div style="font-family:var(--font-title);font-size:12px;color:var(--ink);">${m.name}</div>
          <div style="font-size:11px;color:#8a7060;">CR ${m.cr} · HP ${m.hp} · AC ${m.ac} · ${m.atk}</div>
        </div>
        <span class="detail-tag" style="font-size:10px;">CR ${m.cr}</span>
      </div>
    `).join('');
  }

  function bindMonsterClicks() {
    document.querySelectorAll('.monster-pick-row').forEach(row => {
      row.addEventListener('click', () => {
        const monster = MONSTERS.find(m => m.name === row.dataset.monster);
        if (!monster) return;
        const count = parseInt(document.getElementById('monster-count')?.value) || 1;
        for (let i = 0; i < count; i++) {
          const init = Math.floor(Math.random() * 20) + 1;
          addEntry({
            name:       count > 1 ? monster.name + ' ' + (i+1) : monster.name,
            initiative: init,
            hp:         monster.hp,
            maxHp:      monster.hp,
            ac:         monster.ac,
            icon:       monster.icon,
            isPlayer:   false,
          });
        }
        closeModal();
        showToast(`👹 ${count}× ${monster.name} hinzugefügt`);
      });
    });
  }

  // ── Manueller Eintrag ────────────────────────────────────────────────────
  function showCustomEntry() {
    showModal('➕ Teilnehmer hinzufügen', `
      <div class="form-group">
        <label>Name *</label>
        <input type="text" id="ci-name" placeholder="z.B. Mysteröser NPC" />
      </div>
      <div style="display:flex;gap:8px;">
        <div class="form-group" style="flex:1;">
          <label>Initiative</label>
          <input type="number" id="ci-init" value="${Math.floor(Math.random()*20)+1}" />
        </div>
        <div class="form-group" style="flex:1;">
          <label>HP</label>
          <input type="number" id="ci-hp" value="10" />
        </div>
        <div class="form-group" style="flex:1;">
          <label>AC</label>
          <input type="number" id="ci-ac" value="12" />
        </div>
      </div>
      <div style="display:flex;gap:8px;">
        <div class="form-group" style="flex:1;">
          <label>Icon (Emoji)</label>
          <input type="text" id="ci-icon" value="⚔" maxlength="2" />
        </div>
        <div class="form-group" style="flex:1;">
          <label>Typ</label>
          <select id="ci-type">
            <option value="false">Monster/NPC</option>
            <option value="true">Spieler</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn-primary" id="ci-add" style="flex:1;">➕ Hinzufügen</button>
        <button class="btn-secondary" id="ci-cancel" style="flex:1;">Abbrechen</button>
      </div>
    `);

    document.getElementById('ci-add')?.addEventListener('click', () => {
      const name = document.getElementById('ci-name')?.value.trim();
      if (!name) { showToast('⚠ Name erforderlich'); return; }
      addEntry({
        name,
        initiative: parseInt(document.getElementById('ci-init')?.value) || 10,
        hp:         parseInt(document.getElementById('ci-hp')?.value) || 10,
        maxHp:      parseInt(document.getElementById('ci-hp')?.value) || 10,
        ac:         parseInt(document.getElementById('ci-ac')?.value) || 12,
        icon:       document.getElementById('ci-icon')?.value || '⚔',
        isPlayer:   document.getElementById('ci-type')?.value === 'true',
      });
      closeModal();
    });
    document.getElementById('ci-cancel')?.addEventListener('click', closeModal);
    setTimeout(() => document.getElementById('ci-name')?.focus(), 100);
  }

  function init() {
    load();
    // Auto-Refresh alle 10s wenn Kampagne aktiv
    setInterval(async () => {
      const camp = JSON.parse(localStorage.getItem('dnd_campaign') || 'null');
      const tab  = document.getElementById('tab-campaign');
      if (camp && tab?.classList.contains('active')) {
        const ok = await loadFromServer();
        if (ok) render();
      }
    }, 10000);
  }

  return { init, render, addMyCharacter, nextTurn, startCombat };
})();

window.InitiativeUI = InitiativeUI;
