/**
 * classes.js — v2: Klassen & Rassen UI, applyClass/applyRace, Wiki-Import
 */

const ClassesUI = (() => {
  let _activeTab = 'class'; // 'class' | 'race'

  function init() {
    renderTabs();
    renderClassList();
  }

  /* ── Tab-Umschalter Klasse/Rasse ──────────────────────────────────── */
  function renderTabs() {
    const detail = document.getElementById('class-detail');
    const list   = document.getElementById('class-list');
    if (!list) return;

    // Tab-Buttons über der Liste einfügen (falls noch nicht da)
    let tabBar = document.getElementById('class-race-tabs');
    if (!tabBar) {
      tabBar = document.createElement('div');
      tabBar.id = 'class-race-tabs';
      tabBar.style.cssText = 'display:flex;gap:6px;margin-bottom:12px;';
      tabBar.innerHTML = `
        <button class="btn-tab-cr active" data-cr="class" style="flex:1;padding:7px;font-family:var(--font-title);font-size:12px;font-weight:600;border-radius:4px;cursor:pointer;border:1px solid var(--blood);background:rgba(139,26,26,0.15);color:var(--blood);letter-spacing:1px;text-transform:uppercase;">⚔ Klasse</button>
        <button class="btn-tab-cr" data-cr="race" style="flex:1;padding:7px;font-family:var(--font-title);font-size:12px;font-weight:600;border-radius:4px;cursor:pointer;border:1px solid #c8a55a;background:rgba(200,165,90,0.08);color:#8a7060;letter-spacing:1px;text-transform:uppercase;">🧝 Rasse</button>
      `;
      list.parentElement.insertBefore(tabBar, list);
      tabBar.querySelectorAll('.btn-tab-cr').forEach(btn => {
        btn.addEventListener('click', () => {
          _activeTab = btn.dataset.cr;
          tabBar.querySelectorAll('.btn-tab-cr').forEach(b => {
            const active = b.dataset.cr === _activeTab;
            b.style.background = active ? 'rgba(139,26,26,0.15)' : 'rgba(200,165,90,0.08)';
            b.style.borderColor = active ? 'var(--blood)' : '#c8a55a';
            b.style.color = active ? 'var(--blood)' : '#8a7060';
          });
          if (_activeTab === 'class') renderClassList();
          else renderRaceList();
          if (detail) detail.innerHTML = `<div class="empty-state"><div class="empty-icon">${_activeTab==='class'?'⚔':'🧝'}</div><p>Wähle eine ${_activeTab==='class'?'Klasse':'Rasse'} aus</p></div>`;
        });
      });
    }
  }

  /* ── Klassenliste ─────────────────────────────────────────────────── */
  function renderClassList() {
    const container = document.getElementById('class-list');
    if (!container) return;
    container.innerHTML = '';
    DnDData.classes.forEach(cls => {
      const btn = document.createElement('button');
      btn.className = 'class-btn' + (Character.data.classId === cls.id ? ' selected' : '');
      btn.dataset.id = cls.id;
      btn.innerHTML = `
        <span class="class-btn-icon">${cls.icon}</span>
        <span class="class-btn-info">
          <span class="class-btn-name">${cls.name}</span>
          <span class="class-btn-hit">Hit Dice: ${cls.hit_dice}</span>
        </span>
      `;
      btn.addEventListener('click', () => selectClass(cls.id));
      container.appendChild(btn);
    });
  }

  function selectClass(classId) {
    document.querySelectorAll('.class-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.id === classId));
    const cls = DnDData.getClassById(classId);
    if (!cls) return;
    Character.update({ classId, subclassId: null });
    updateClassBadge(cls);
    renderClassDetail(cls);
  }

  function updateClassBadge(cls) {
    const badge = document.getElementById('char-class-display');
    if (badge) badge.textContent = `${cls.icon} ${cls.name}`;
  }

  function renderClassDetail(cls) {
    const detail = document.getElementById('class-detail');
    if (!detail) return;
    const currentSub = Character.data.subclassId;

    detail.innerHTML = `
      <div class="class-detail-content">
        <h2>${cls.icon} ${cls.name}</h2>
        <div class="class-meta">
          <span class="class-meta-item">Hit Dice: ${cls.hit_dice}</span>
          <span class="class-meta-item">Primär: ${cls.primary_abilities.join(', ')}</span>
          <span class="class-meta-item">Saves: ${cls.saving_throws.join(', ').toUpperCase()}</span>
        </div>
        <p class="class-desc">${cls.description}</p>

        <div style="margin-bottom:12px;">
          <h3 style="font-family:var(--font-title);font-size:12px;color:var(--blood);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid rgba(139,26,26,0.2);">Klassenmerkmale</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${cls.features.map(f=>`<span class="detail-tag">${f}</span>`).join('')}
          </div>
        </div>

        <div class="subclass-section">
          <h3>Subklassen</h3>
          <div class="subclass-grid">
            ${cls.subclasses.map(sc => `
              <div class="subclass-card ${currentSub===sc.id?'selected':''}" data-subclass="${sc.id}">
                <div class="subclass-name">${sc.name}</div>
                <div class="subclass-desc">${sc.description}</div>
                ${sc.features?`<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">${sc.features.map(f=>`<span style="background:rgba(201,150,42,0.15);border:1px solid rgba(201,150,42,0.3);border-radius:3px;padding:2px 7px;font-family:var(--font-title);font-size:10px;color:var(--ink-light);">${f}</span>`).join('')}</div>`:''}
              </div>`).join('')}
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="btn-primary" id="btn-apply-class" style="flex:1;">
            ✅ Klasse übernehmen
          </button>
          <button class="btn-secondary" id="btn-wiki-class" style="flex:1;">
            📖 Wiki-Import
          </button>
        </div>
      </div>
    `;

    detail.querySelectorAll('.subclass-card').forEach(card => {
      card.addEventListener('click', () => {
        detail.querySelectorAll('.subclass-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        Character.update({ subclassId: card.dataset.subclass });
      });
    });

    detail.querySelector('#btn-apply-class').addEventListener('click', () => {
      const subId = Character.data.subclassId;
      Character.applyClass(cls, subId);
      updateClassBadge(cls);
      // UI-Felder neu setzen
      const hpMax = document.getElementById('char-hp-max');
      const hpCur = document.getElementById('char-hp-current');
      if (hpMax) hpMax.value = Character.data.hp_max;
      if (hpCur) hpCur.value = Character.data.hp_current;
      if (typeof CharUI !== 'undefined') {
        CharUI.renderSavingThrows();
        CharUI.renderFeatures();
      }
      showToast(`✅ ${cls.name} übernommen! HP-Max: ${Character.data.hp_max}`);
    });

    detail.querySelector('#btn-wiki-class').addEventListener('click', () => {
      showWikiImport('class', cls.name);
    });
  }

  /* ── Rassenliste ──────────────────────────────────────────────────── */
  function renderRaceList() {
    const container = document.getElementById('class-list');
    if (!container) return;
    container.innerHTML = '';
    DnDData.races.forEach(race => {
      const btn = document.createElement('button');
      btn.className = 'class-btn' + (Character.data.raceId === race.id ? ' selected' : '');
      btn.dataset.id = race.id;
      btn.innerHTML = `
        <span class="class-btn-icon">${race.icon}</span>
        <span class="class-btn-info">
          <span class="class-btn-name">${race.name}</span>
          <span class="class-btn-hit">Tempo: ${race.speed} ft · ${race.size}</span>
        </span>
      `;
      btn.addEventListener('click', () => selectRace(race.id));
      container.appendChild(btn);
    });
  }

  function selectRace(raceId) {
    document.querySelectorAll('.class-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.id === raceId));
    const race = DnDData.getRaceById(raceId);
    if (!race) return;
    renderRaceDetail(race);
  }

  function renderRaceDetail(race) {
    const detail = document.getElementById('class-detail');
    if (!detail) return;
    const currentSub = Character.data.subraceId;

    const bonusStr = Object.entries(race.ability_bonuses||{})
      .map(([k,v]) => `${k.toUpperCase()} +${v}`).join(', ') || '–';

    detail.innerHTML = `
      <div class="class-detail-content">
        <h2>${race.icon} ${race.name}</h2>
        <div class="class-meta">
          <span class="class-meta-item">Tempo: ${race.speed} ft</span>
          <span class="class-meta-item">Größe: ${race.size}</span>
          <span class="class-meta-item">Attributboni: ${bonusStr}</span>
        </div>
        <p class="class-desc">${race.description}</p>

        <div style="margin-bottom:12px;">
          <h3 style="font-family:var(--font-title);font-size:12px;color:var(--blood);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid rgba(139,26,26,0.2);">Rassenmerkmale</h3>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${(race.traits||[]).map(t=>`<span class="detail-tag">${t}</span>`).join('')}
          </div>
        </div>

        ${race.subraces?.length ? `
          <div class="subclass-section">
            <h3>Unterrassen</h3>
            <div class="subclass-grid">
              ${race.subraces.map(sub => {
                const subBonus = Object.entries(sub.ability_bonuses||{}).map(([k,v])=>`${k.toUpperCase()}+${v}`).join(' ');
                return `
                  <div class="subclass-card ${currentSub===sub.id?'selected':''}" data-subrace="${sub.id}">
                    <div class="subclass-name">${sub.name} <span style="color:#8a7060;font-size:11px;">${subBonus}</span></div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                      ${(sub.traits||[]).map(t=>`<span style="background:rgba(201,150,42,0.15);border:1px solid rgba(201,150,42,0.3);border-radius:3px;padding:2px 7px;font-family:var(--font-title);font-size:10px;color:var(--ink-light);">${t}</span>`).join('')}
                    </div>
                  </div>`;
              }).join('')}
            </div>
          </div>` : ''}

        <div style="display:flex;gap:8px;margin-top:16px;">
          <button class="btn-primary" id="btn-apply-race" style="flex:1;">✅ Rasse übernehmen</button>
          <button class="btn-secondary" id="btn-wiki-race" style="flex:1;">📖 Wiki-Import</button>
        </div>
      </div>
    `;

    detail.querySelectorAll('.subclass-card').forEach(card => {
      card.addEventListener('click', () => {
        detail.querySelectorAll('.subclass-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        Character.update({ subraceId: card.dataset.subrace });
      });
    });

    detail.querySelector('#btn-apply-race').addEventListener('click', () => {
      const subId = Character.data.subraceId;
      Character.applyRace(race, subId);
      // Inputs aktualisieren
      const raceInput = document.getElementById('char-race');
      if (raceInput) raceInput.value = race.name;
      if (typeof CharUI !== 'undefined') {
        CharUI.refreshAbilities();
        CharUI.renderFeatures();
      }
      showToast(`✅ ${race.name} übernommen! Attributboni angewendet.`);
    });

    detail.querySelector('#btn-wiki-race').addEventListener('click', () => {
      showWikiImport('race', race.name);
    });
  }

  /* ── Wiki-Import Modal ────────────────────────────────────────────── */
  function showWikiImport(type, name) {
    const wikiSlug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g,'');
    const wikiUrl  = `https://dnd5e.wikidot.com/${type==='class'?wikiSlug:'lineage:'+wikiSlug}`;

    showModal(`📖 Wiki-Import: ${name}`, `
      <p style="font-size:14px;margin-bottom:12px;color:var(--ink-light);">
        Öffne das Wiki und kopiere die Eigenschaften als JSON in das Feld unten.<br>
        Alternativ: direkt als JSON-Objekt einfügen.
      </p>
      <a href="${wikiUrl}" target="_blank" style="display:inline-block;margin-bottom:12px;padding:7px 14px;background:rgba(201,150,42,0.15);border:1px solid var(--gold);border-radius:4px;color:var(--gold);font-family:var(--font-title);font-size:12px;text-decoration:none;letter-spacing:1px;">
        🌐 Wiki öffnen: ${name}
      </a>
      <div style="margin-bottom:10px;">
        <label style="font-family:var(--font-title);font-size:11px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px;">
          JSON einfügen (${type==='class'?'Klasse':'Rasse'}-Format)
        </label>
        <textarea id="wiki-import-json" style="width:100%;height:140px;font-size:12px;font-family:monospace;" placeholder='${type==='class'?
          '{\n  "id": "artificer",\n  "name": "Artificer",\n  "icon": "⚙️",\n  "hit_dice": "d8",\n  "primary_abilities": ["INT"],\n  "saving_throws": ["con","int"],\n  "description": "...",\n  "features": ["Magical Tinkering"],\n  "subclasses": []\n}' :
          '{\n  "id": "aasimar",\n  "name": "Aasimar",\n  "icon": "😇",\n  "speed": 30,\n  "size": "Medium",\n  "ability_bonuses": {"cha": 2},\n  "traits": ["Darkvision","Celestial Resistance"],\n  "description": "..."\n}'
        }'></textarea>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn-primary" id="wiki-import-btn" style="flex:1;">✅ Importieren</button>
        <button class="btn-secondary" id="wiki-cancel-btn" style="flex:1;">Abbrechen</button>
      </div>
      <div id="wiki-status" style="margin-top:10px;font-size:13px;"></div>
    `);

    document.getElementById('wiki-import-btn')?.addEventListener('click', () => {
      const raw    = document.getElementById('wiki-import-json')?.value?.trim();
      const status = document.getElementById('wiki-status');
      if (!raw) { status.textContent = '❌ Kein JSON eingegeben'; return; }
      try {
        const data = JSON.parse(raw);
        const count = DnDData.importExternal({
          [type==='class'?'classes':'races']: [data]
        });
        if (type === 'class') renderClassList();
        else renderRaceList();
        status.style.color = 'green';
        status.textContent = `✅ "${data.name}" importiert!`;
        setTimeout(closeModal, 1500);
        showToast(`✅ ${data.name} importiert!`);
      } catch(e) {
        status.style.color = 'red';
        status.textContent = '❌ Ungültiges JSON: ' + e.message;
      }
    });
    document.getElementById('wiki-cancel-btn')?.addEventListener('click', closeModal);
  }

  /* ── Restore on load ──────────────────────────────────────────────── */
  function restoreFromSave() {
    const { classId } = Character.data;
    if (!classId) return;
    const cls = DnDData.getClassById(classId);
    if (cls) { updateClassBadge(cls); }
  }

  return { init, restoreFromSave };
})();

window.ClassesUI = ClassesUI;
