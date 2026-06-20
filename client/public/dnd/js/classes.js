
// ── Open5e Beschreibungen (Subklassen + Hintergründe) ────────────────────────
const SC_DESC_CACHE_KEY = 'dnd5e_sc_descriptions';
const BG_DESC_CACHE_KEY = 'dnd5e_bg_descriptions';

async function fetchSubclassDesc(name) {
  const cache = JSON.parse(localStorage.getItem(SC_DESC_CACHE_KEY) || '{}');
  if (cache[name]) return cache[name];

  try {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const resp = await fetch(`https://www.dnd5eapi.co/api/subclasses/${slug}`);
    if (resp.ok) {
      const data = await resp.json();
      const desc = data.desc || '';
      if (desc) {
        cache[name] = desc;
        localStorage.setItem(SC_DESC_CACHE_KEY, JSON.stringify(cache));
        return desc;
      }
    }
  } catch {}

  try {
    const resp = await fetch(`https://api.open5e.com/v1/subclasses/?search=${encodeURIComponent(name)}&limit=1`);
    if (resp.ok) {
      const data = await resp.json();
      const desc = data.results?.[0]?.desc || '';
      if (desc) {
        cache[name] = desc;
        localStorage.setItem(SC_DESC_CACHE_KEY, JSON.stringify(cache));
        return desc;
      }
    }
  } catch {}

  return null;
}

async function fetchBackgroundDesc(name) {
  const cache = JSON.parse(localStorage.getItem(BG_DESC_CACHE_KEY) || '{}');
  if (cache[name]) return cache[name];

  // D&D 5e API: Hintergründe sind nicht direkt verfügbar, aber Open5e hat sie
  try {
    const resp = await fetch(`https://api.open5e.com/v1/backgrounds/?search=${encodeURIComponent(name)}&limit=1`);
    if (resp.ok) {
      const data = await resp.json();
      const result = data.results?.[0];
      if (result?.desc) {
        const desc = result.desc;
        cache[name] = desc;
        localStorage.setItem(BG_DESC_CACHE_KEY, JSON.stringify(cache));
        return desc;
      }
    }
  } catch {}

  return null;
}

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
        <button class="btn-tab-cr active" data-cr="class" style="flex:1;padding:7px;font-family:var(--font-title);font-size:11px;font-weight:600;border-radius:4px;cursor:pointer;border:1px solid var(--blood);background:rgba(139,26,26,0.15);color:var(--blood);letter-spacing:1px;text-transform:uppercase;">⚔ Klasse</button>
        <button class="btn-tab-cr" data-cr="race" style="flex:1;padding:7px;font-family:var(--font-title);font-size:11px;font-weight:600;border-radius:4px;cursor:pointer;border:1px solid #c8a55a;background:rgba(200,165,90,0.08);color:#8a7060;letter-spacing:1px;text-transform:uppercase;">🧝 Rasse</button>
        <button class="btn-tab-cr" data-cr="background" style="flex:1;padding:7px;font-family:var(--font-title);font-size:11px;font-weight:600;border-radius:4px;cursor:pointer;border:1px solid #c8a55a;background:rgba(200,165,90,0.08);color:#8a7060;letter-spacing:1px;text-transform:uppercase;">📖 Hintergrund</button>
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
          else if (_activeTab === 'race') renderRaceList();
          else renderBackgroundList();
          const icons = {class:'⚔',race:'🧝',background:'📖'};
          const labels = {class:'Klasse',race:'Rasse',background:'Hintergrund'};
          if (detail) detail.innerHTML = `<div class="empty-state"><div class="empty-icon">${icons[_activeTab]||'⚔'}</div><p>Wähle ${_activeTab==='background'?'einen':'eine'} ${labels[_activeTab]||'Klasse'} aus</p></div>`;
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
        ${cls._custom ? `<span class="list-delete-btn" data-type="class" data-id="${cls.id}" title="Löschen">✕</span>` : ''}
      `;
      btn.addEventListener('click', e => {
        if (e.target.classList.contains('list-delete-btn')) return;
        selectClass(cls.id);
      });
      const delBtn = btn.querySelector('.list-delete-btn');
      if (delBtn) delBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(`"${cls.name}" wirklich löschen?`)) {
          DnDData.deleteEntry('class', cls.id);
          if (Character.data.classId === cls.id) Character.update({ classId: null, subclassId: null });
          renderClassList();
          document.getElementById('class-detail').innerHTML = '<div class="empty-state"><div class="empty-icon">⚔</div><p>Wähle eine Klasse aus</p></div>';
          showToast(`🗑 ${cls.name} gelöscht`);
        }
      });
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
            ${cls.features.map(f => {
              const tip = window.getFeatureTooltip ? (getFeatureTooltip(f)||'') : '';
              return `<span class="detail-tag" ${tip?`data-tooltip="${tip.replace(/"/g,"'")}"`:''} style="${tip?'cursor:help;border-bottom:1px dashed rgba(139,26,26,0.4);':''}">${f}</span>`;
            }).join('')}
          </div>
        </div>

        <div class="subclass-section">
          <h3>Subklassen</h3>
          <div class="subclass-grid">
            ${cls.subclasses.map(sc => `
              <div class="subclass-card ${currentSub===sc.id?'selected':''}" data-subclass="${sc.id}"
                   data-tooltip="${sc.description ? sc.description.replace(/"/g,"'").slice(0,280) : ''}">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                  <div class="subclass-name" style="flex:1;">${sc.name}</div>
                  ${sc.role ? `<span class="role-badge">${sc.role}</span>` : ''}
                </div>
                <div class="subclass-desc">${sc.description}</div>
                ${sc.features?.length?`<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px;">${sc.features.map(f=>{const tip=window.getFeatureTooltip?(getFeatureTooltip(f)||''):'';return `<span style="background:rgba(201,150,42,0.15);border:1px solid rgba(201,150,42,0.3);border-radius:3px;padding:2px 7px;font-family:var(--font-title);font-size:10px;color:var(--ink-light);${tip?'cursor:help;':''}" ${tip?`data-tooltip="${tip.replace(/"/g,"'")}"`:''}>${f}</span>`;}).join('')}</div>`:''}
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
      showWikiImport(cls.name);
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
        ${race._custom ? `<span class="list-delete-btn" data-type="race" data-id="${race.id}" title="Löschen">✕</span>` : ''}
      `;
      btn.addEventListener('click', e => {
        if (e.target.classList.contains('list-delete-btn')) return;
        selectRace(race.id);
      });
      const delBtnR = btn.querySelector('.list-delete-btn');
      if (delBtnR) delBtnR.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm(`"${race.name}" wirklich löschen?`)) {
          DnDData.deleteEntry('race', race.id);
          if (Character.data.raceId === race.id) Character.update({ raceId: null, race: '' });
          renderRaceList();
          document.getElementById('class-detail').innerHTML = '<div class="empty-state"><div class="empty-icon">🧝</div><p>Wähle eine Rasse aus</p></div>';
          showToast(`🗑 ${race.name} gelöscht`);
        }
      });
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
                  <div class="subclass-card ${currentSub===sub.id?'selected':''}" data-subrace="${sub.id}"
                       data-tooltip="${[subBonus, ...(sub.traits||[])].filter(Boolean).join(' · ').replace(/"/g,"'")}">
                    <div class="subclass-name">${sub.name} <span style="color:#8a7060;font-size:11px;">${subBonus}</span></div>
                    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">
                      ${(sub.traits||[]).map(t=>`<span style="background:rgba(201,150,42,0.15);border:1px solid rgba(201,150,42,0.3);border-radius:3px;padding:2px 7px;font-family:var(--font-title);font-size:10px;color:var(--ink-light);" data-tooltip="${t.replace(/"/g,"'")}">${t}</span>`).join('')}
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
      showWikiImport(race.name);
    });
  }

  /* ── Wiki-Import Modal (Paste-basiert) ───────────────────────────── */
  function showWikiImport(hintName) {
    showModal('📖 Wiki-Import', `
      <p style="font-size:14px;margin-bottom:4px;color:var(--ink-light);">
        <strong>Einfach kopieren &amp; einfügen:</strong><br>
        Öffne die Wikidot-Seite, markiere den gesamten Artikel-Text (Strg+A im Textbereich)
        und füge ihn unten ein. Die App erkennt automatisch ob es eine Klasse oder Rasse ist.
      </p>
      <a href="https://dnd5e.wikidot.com/" target="_blank"
         style="display:inline-block;margin:8px 0 10px;padding:6px 14px;background:rgba(201,150,42,0.12);border:1px solid var(--gold);border-radius:4px;color:var(--gold);font-family:var(--font-title);font-size:11px;text-decoration:none;letter-spacing:1px;">
        🌐 dnd5e.wikidot.com öffnen
      </a>
      <textarea id="wiki-paste-area"
        style="width:100%;height:180px;font-size:12px;font-family:monospace;margin-bottom:8px;resize:vertical;"
        placeholder="Gesamten Wiki-Artikel-Text hier einfügen...&#10;&#10;Beispiel:&#10;Paladin&#10;Whether sworn before a god&#39;s altar...&#10;Hit Dice: 1d10&#10;Saving Throws: Wisdom, Charisma&#10;..."></textarea>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button class="btn-primary" id="wiki-parse-btn" style="flex:2;">🔍 Analysieren &amp; Importieren</button>
        <button class="btn-secondary" id="wiki-cancel-btn" style="flex:1;">Abbrechen</button>
      </div>
      <div id="wiki-preview" style="display:none;margin-top:10px;padding:10px;background:rgba(255,255,255,0.5);border:1px solid rgba(200,165,90,0.4);border-radius:4px;font-size:13px;"></div>
      <div id="wiki-status" style="margin-top:8px;font-size:13px;"></div>
    `);

    document.getElementById('wiki-parse-btn')?.addEventListener('click', () => {
      const raw    = document.getElementById('wiki-paste-area')?.value?.trim();
      const status = document.getElementById('wiki-status');
      const preview = document.getElementById('wiki-preview');
      if (!raw || raw.length < 30) { status.textContent = '❌ Bitte Text einfügen'; return; }

      status.textContent = '⏳ Analysiere...';
      preview.style.display = 'none';

      try {
        const result = WikiParser.parse(raw);
        if (result.error) { status.textContent = '❌ ' + result.error; return; }

        const { type, data } = result;

        // Preview anzeigen
        preview.style.display = 'block';
        preview.innerHTML = `
          <div style="font-family:var(--font-title);font-size:12px;color:var(--blood);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px;">
            Erkannt: ${type === 'class' ? '⚔ Klasse' : '🧝 Rasse'}
          </div>
          <div style="font-size:15px;font-weight:bold;margin-bottom:4px;">${data.icon} ${data.name}</div>
          ${type === 'class' ? `
            <div style="font-size:12px;color:#5a4f48;">
              Hit Dice: ${data.hit_dice} · Saves: ${(data.saving_throws||[]).join(', ').toUpperCase()}
            </div>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
              ${(data.features||[]).map(f=>`<span style="background:rgba(139,26,26,0.08);border:1px solid rgba(139,26,26,0.2);border-radius:3px;padding:2px 7px;font-size:11px;font-family:var(--font-title);color:var(--blood);">${f}</span>`).join('')}
            </div>
            ${data.subclasses?.length ? `<div style="margin-top:6px;font-size:12px;color:#5a4f48;">Subklassen: ${data.subclasses.map(s=>s.name).join(', ')}</div>` : ''}
          ` : `
            <div style="font-size:12px;color:#5a4f48;">
              Tempo: ${data.speed} ft · Größe: ${data.size}
            </div>
            <div style="font-size:12px;color:#5a4f48;margin-top:2px;">
              Attributboni: ${Object.entries(data.ability_bonuses||{}).map(([k,v])=>k.toUpperCase()+'+'+v).join(', ')||'–'}
            </div>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
              ${(data.traits||[]).map(t=>`<span style="background:rgba(201,150,42,0.1);border:1px solid rgba(201,150,42,0.3);border-radius:3px;padding:2px 7px;font-size:11px;font-family:var(--font-title);color:#7a5c1a;">${t}</span>`).join('')}
            </div>
          `}
          <button class="btn-primary" id="wiki-confirm-btn" style="width:100%;margin-top:10px;">
            ✅ "${data.name}" importieren
          </button>
        `;

        status.textContent = '';

        document.getElementById('wiki-confirm-btn')?.addEventListener('click', () => {
          DnDData.importExternal({ [type==='class'?'classes':'races']: [data] });
          if (type === 'class') renderClassList();
          else renderRaceList();
          showToast(`✅ ${data.name} importiert!`);
          setTimeout(closeModal, 800);
        });

      } catch(e) {
        status.textContent = '❌ Fehler: ' + e.message;
        console.error('[WikiParser]', e);
      }
    });

    document.getElementById('wiki-cancel-btn')?.addEventListener('click', closeModal);
  }

  /* ── Hintergründe ─────────────────────────────────────────────────── */
  function renderBackgroundList() {
    const container = document.getElementById('class-list');
    if (!container) return;
    container.innerHTML = '';
    const bgs = DnDData.backgrounds || [];
    if (!bgs.length) {
      container.innerHTML = '<div style="padding:20px;color:#8a7060;font-style:italic;font-size:13px;">Keine Hintergründe geladen</div>';
      return;
    }
    bgs.forEach(bg => {
      const btn = document.createElement('button');
      btn.className = 'class-btn' + (Character.data.background === bg.name ? ' selected' : '');
      btn.dataset.id = bg.id;
      btn.innerHTML = `
        <span class="class-btn-icon">${bg.icon}</span>
        <span class="class-btn-info">
          <span class="class-btn-name">${bg.name}</span>
          <span class="class-btn-hit">${(bg.skill_proficiencies||[]).map(s=>s.replace(/_/g,' ')).join(', ')}</span>
        </span>
      `;
      btn.addEventListener('click', () => selectBackground(bg.id));
      container.appendChild(btn);
    });
  }

  function selectBackground(bgId) {
    document.querySelectorAll('.class-btn').forEach(b =>
      b.classList.toggle('selected', b.dataset.id === bgId));
    const bg = DnDData.getBackgroundById(bgId);
    if (!bg) return;
    renderBackgroundDetail(bg);
  }

  function renderBackgroundDetail(bg) {
    const detail = document.getElementById('class-detail');
    if (!detail) return;

    detail.innerHTML = `
      <div class="class-detail-content">
        <h2>${bg.icon} ${bg.name}</h2>
        <div class="class-meta">
          <span class="class-meta-item">Fertigkeiten: ${(bg.skill_proficiencies||[]).map(s=>s.replace(/_/g,' ')).join(', ')}</span>
          ${(bg.tool_proficiencies||[]).length ? `<span class="class-meta-item">Werkzeuge: ${bg.tool_proficiencies.join(', ')}</span>` : ''}
          ${bg.languages ? `<span class="class-meta-item">Sprachen: +${bg.languages}</span>` : ''}
        </div>
        <p class="class-desc">${bg.description}</p>
        <div id="bg-api-desc" style="min-height:10px;"></div>

        <div style="margin-bottom:12px;">
          <h3 style="font-family:var(--font-title);font-size:12px;color:var(--blood);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid rgba(139,26,26,0.2);">
            Merkmal: ${bg.feature}
          </h3>
          <p style="font-size:14px;color:var(--ink-light);line-height:1.6;">${bg.feature_desc}</p>
        </div>

        <div style="margin-bottom:12px;">
          <h3 style="font-family:var(--font-title);font-size:12px;color:var(--blood);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid rgba(139,26,26,0.2);">Ausrüstung</h3>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${(bg.equipment||[]).map(e => `<span class="detail-tag" style="font-size:11px;">${e}</span>`).join('')}
          </div>
        </div>

        ${(bg.personality_traits||[]).length ? `
        <div style="margin-bottom:10px;">
          <h3 style="font-family:var(--font-title);font-size:12px;color:var(--blood);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid rgba(139,26,26,0.2);">Persönlichkeit</h3>
          ${bg.personality_traits.map(t => `<p style="font-size:13px;color:var(--ink-light);margin-bottom:3px;">• ${t}</p>`).join('')}
        </div>` : ''}

        ${(bg.ideals||[]).length ? `
        <div style="margin-bottom:10px;">
          <h3 style="font-family:var(--font-title);font-size:12px;color:var(--blood);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid rgba(139,26,26,0.2);">Ideale</h3>
          <div style="display:flex;flex-wrap:wrap;gap:4px;">
            ${bg.ideals.map(i => `<span class="detail-tag" style="font-size:11px;">${i}</span>`).join('')}
          </div>
        </div>` : ''}

        <button class="btn-primary" id="btn-apply-bg" style="width:100%;margin-top:8px;">
          ✅ Hintergrund übernehmen
        </button>
      </div>
    `;

    // Offizielle Beschreibung via API nachladen
    (async () => {
      const apiDescEl = detail.querySelector('#bg-api-desc');
      if (!apiDescEl) return;
      const apiDesc = await fetchBackgroundDesc(bg.name);
      if (apiDesc) {
        apiDescEl.innerHTML = `
          <div style="margin-bottom:10px;padding:10px;
            background:rgba(201,150,42,0.06);border:1px solid rgba(201,150,42,0.2);
            border-radius:4px;">
            <div style="font-family:var(--font-title);font-size:9px;color:#8a7060;
              text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">
              📖 Offizielle Beschreibung (SRD)
            </div>
            <p style="font-size:13px;color:var(--ink-light);line-height:1.6;">${apiDesc}</p>
          </div>`;
      }
    })();

    detail.querySelector('#btn-apply-bg')?.addEventListener('click', () => {
      const skillProfs = [...(Character.data.proficiencies?.skills || [])];
      (bg.skill_proficiencies||[]).forEach(sk => {
        if (!skillProfs.includes(sk)) skillProfs.push(sk);
      });
      Character.update({
        background: bg.name,
        proficiencies: { ...Character.data.proficiencies, skills: skillProfs },
      });
      const bgInput = document.getElementById('char-background');
      if (bgInput) bgInput.value = bg.name;
      if (typeof CharUI !== 'undefined') CharUI.renderSkills();
      showToast('✅ Hintergrund "' + bg.name + '" übernommen!');
      renderBackgroundList();
    });
  }

    // features_detail aus subclass JSON anzeigen
  function renderSubclassFeatureDetail(sc) {
    if (!sc.features_detail || !sc.features_detail.length) return "";
    const charLevel = parseInt(Character.data.level) || 1;
    return sc.features_detail.map(f => {
      const unlocked = charLevel >= f.level;
      return `<div style="opacity:${unlocked?1:0.5};">
        <strong>Lv.${f.level} ${f.name}</strong>: ${f.desc}
      </div>`;
    }).join("");
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
