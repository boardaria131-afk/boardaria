/**
 * app.js — v2: Tabs, Speichern/Laden (Multi-Charakter), Wiki-Import, Features-Panel
 */

/* ── Toast ────────────────────────────────────────────────────────────────── */
function showToast(msg, duration=2800) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), duration);
}
window.showToast = showToast;

/* ── Modal ────────────────────────────────────────────────────────────────── */
function showModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }
window.showModal = showModal;
window.closeModal = closeModal;

/* ── CharUI ───────────────────────────────────────────────────────────────── */
const CharUI = (() => {
  const ABILITIES = ['str','dex','con','int','wis','cha'];

  const SAVING_THROWS = [
    {key:'str',label:'Stärke'},{key:'dex',label:'Geschicklichkeit'},
    {key:'con',label:'Konstitution'},{key:'int',label:'Intelligenz'},
    {key:'wis',label:'Weisheit'},{key:'cha',label:'Charisma'},
  ];

  const SKILLS = [
    {key:'acrobatics',label:'Akrobatik',ability:'DEX'},
    {key:'animal_handling',label:'Mit Tieren umgehen',ability:'WIS'},
    {key:'arcana',label:'Arkanes Wissen',ability:'INT'},
    {key:'athletics',label:'Athletik',ability:'STR'},
    {key:'deception',label:'Täuschung',ability:'CHA'},
    {key:'history',label:'Geschichte',ability:'INT'},
    {key:'insight',label:'Einsicht',ability:'WIS'},
    {key:'intimidation',label:'Einschüchterung',ability:'CHA'},
    {key:'investigation',label:'Nachforschung',ability:'INT'},
    {key:'medicine',label:'Medizin',ability:'WIS'},
    {key:'nature',label:'Naturkunde',ability:'INT'},
    {key:'perception',label:'Wahrnehmung',ability:'WIS'},
    {key:'performance',label:'Aufführung',ability:'CHA'},
    {key:'persuasion',label:'Überzeugung',ability:'CHA'},
    {key:'religion',label:'Religionskunde',ability:'INT'},
    {key:'sleight_of_hand',label:'Taschenspielerei',ability:'DEX'},
    {key:'stealth',label:'Heimlichkeit',ability:'DEX'},
    {key:'survival',label:'Überleben',ability:'WIS'},
  ];

  const fmt = n => (n>=0?'+':'')+n;

  /* Alle Text-Inputs mit Charakter-Daten befüllen und binden */
  function bindInputs() {
    const bindText = (id, field) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = Character.data[field] || '';
      el.addEventListener('input', () => Character.update({ [field]: el.value }));
    };
    const bindNum = (id, field) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = Character.data[field] ?? '';
      el.addEventListener('input', () => Character.update({ [field]: parseInt(el.value)||0 }));
    };
    bindText('char-name',       'name');
    bindText('char-race',       'race');
    bindText('char-background', 'background');
    bindNum('char-level',       'level');
    document.getElementById('char-level')?.addEventListener('change', () => SpellSlotUI.renderSpellSlots());
    bindNum('char-xp',          'xp');
    bindNum('char-hp-current',  'hp_current');
    bindNum('char-hp-max',      'hp_max');
    bindNum('char-ac',          'ac');

    // Regelwerk-Auswahl
    const rulesetSelect = document.getElementById('char-ruleset');
    if (rulesetSelect) {
      // Optionen befüllen
      DnDData.rulesets.forEach(rs => {
        const opt = document.createElement('option');
        opt.value = rs.id;
        opt.textContent = rs.short;
        rulesetSelect.appendChild(opt);
      });
      rulesetSelect.value = Character.data.rulesetId || '5e';
      rulesetSelect.addEventListener('change', () => {
        Character.update({ rulesetId: rulesetSelect.value });
        updateRulesetBadge();
        showRulesetConflicts(rulesetSelect.value);
      });
      updateRulesetBadge();
    }

    const notes = document.getElementById('char-notes');
    if (notes) {
      notes.value = Character.data.notes || '';
      notes.addEventListener('input', () => Character.update({ notes: notes.value }));
    }
  }

  /* Attribut-Blöcke befüllen */
  function bindAbilities() {
    ABILITIES.forEach(ab => {
      const block = document.querySelector(`.ability-block[data-ability="${ab}"]`);
      if (!block) return;
      const input = block.querySelector('.ability-score');
      const modEl = block.querySelector('.ability-mod');
      input.value = Character.data.abilities[ab];
      modEl.textContent = fmt(Character.getMod(Character.data.abilities[ab]));
      input.addEventListener('input', () => {
        const val = parseInt(input.value)||10;
        Character.updateAbility(ab, val);
        modEl.textContent = fmt(Character.getMod(val));
        renderSavingThrows();
        renderSkills();
      });
    });
  }

  /* Attribute aus Charakter-Objekt in UI schreiben (z.B. nach Rassen-Apply) */
  function refreshAbilities() {
    ABILITIES.forEach(ab => {
      const block = document.querySelector(`.ability-block[data-ability="${ab}"]`);
      if (!block) return;
      const input = block.querySelector('.ability-score');
      const modEl = block.querySelector('.ability-mod');
      input.value = Character.data.abilities[ab];
      modEl.textContent = fmt(Character.getMod(Character.data.abilities[ab]));
    });
    renderSavingThrows();
    renderSkills();
  }

  function renderSavingThrows() {
    const container = document.getElementById('saving-throws');
    if (!container) return;
    container.innerHTML = SAVING_THROWS.map(st => {
      const prof  = Character.data.proficiencies.saving_throws.includes(st.key);
      const bonus = Character.getSavingThrowBonus(st.key);
      return `<div class="skill-row">
        <input type="checkbox" data-st="${st.key}" ${prof?'checked':''} />
        <span class="skill-name">${st.label}</span>
        <span class="skill-ability">${st.key.toUpperCase()}</span>
        <span class="skill-value">${fmt(bonus)}</span>
      </div>`;
    }).join('');
    container.querySelectorAll('input[data-st]').forEach(cb => {
      cb.addEventListener('change', () => { Character.toggleSavingThrow(cb.dataset.st); renderSavingThrows(); });
    });
  }

  function renderSkills() {
    const container = document.getElementById('skills-list');
    if (!container) return;
    container.innerHTML = SKILLS.map(sk => {
      const prof  = Character.data.proficiencies.skills.includes(sk.key);
      const bonus = Character.getSkillBonus(sk.key);
      return `<div class="skill-row">
        <input type="checkbox" data-skill="${sk.key}" ${prof?'checked':''} />
        <span class="skill-name">${sk.label}</span>
        <span class="skill-ability">${sk.ability}</span>
        <span class="skill-value">${fmt(bonus)}</span>
      </div>`;
    }).join('');
    container.querySelectorAll('input[data-skill]').forEach(cb => {
      cb.addEventListener('change', () => { Character.toggleSkill(cb.dataset.skill); renderSkills(); });
    });
  }

  /* Features-Panel (Klasse + Rasse) */
  function updateRulesetBadge() {
    const rsId  = Character.data.rulesetId || '5e';
    const rs    = DnDData.getRulesetById(rsId);
    const badge = document.getElementById('char-ruleset-badge');
    if (badge && rs) {
      badge.textContent = rs.short;
      badge.style.background = rs.color + '22';
      badge.style.borderColor = rs.color;
      badge.style.color = rs.color;
    }
  }

  function showRulesetConflicts(rulesetId) {
    const rs = DnDData.getRulesetById(rulesetId);
    if (!rs || !rs.conflicts?.length) {
      document.getElementById('ruleset-conflicts')?.remove();
      return;
    }
    let panel = document.getElementById('ruleset-conflicts');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'ruleset-conflicts';
      panel.className = 'card';
      panel.style.cssText = 'grid-column:1/-1;border-color:' + rs.color + ';';
      const spellSlotCard = document.getElementById('spell-slots-card');
      spellSlotCard?.after(panel);
    }
    panel.innerHTML = `
      <h3 style="color:${rs.color};">⚠ ${rs.name} — Regelunterschiede zu 5e SRD</h3>
      <p style="font-size:13px;color:var(--ink-light);margin-bottom:10px;">${rs.description}</p>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${rs.conflicts.map(c => `
          <div style="display:flex;gap:10px;padding:8px 10px;background:rgba(255,255,255,0.5);border-radius:4px;border-left:3px solid ${c.severity==='major'?'#ef4444':'#f59e0b'};">
            <span style="font-size:16px;flex-shrink:0;">${c.severity==='major'?'🔴':'🟡'}</span>
            <div>
              <div style="font-family:var(--font-title);font-size:12px;font-weight:600;color:var(--ink);margin-bottom:2px;">${c.area}</div>
              <div style="font-size:13px;color:var(--ink-light);">${c.detail}</div>
            </div>
          </div>`).join('')}
      </div>
    `;
  }

  function renderFeatures() {
    const container = document.getElementById('char-features-list');
    if (!container) return;
    const clsFeatures = Character.data.class_features || [];
    const raceTraits  = Character.data.race_traits || [];
    if (!clsFeatures.length && !raceTraits.length) {
      container.innerHTML = '<span style="font-style:italic;color:#8a7060;font-size:13px;">Noch keine Klasse/Rasse übernommen</span>';
      return;
    }
    const mkTag = (icon, f, gold) => {
      const tip = window.getFeatureTooltip ? (getFeatureTooltip(f) || '') : '';
      const style = gold ? 'border-color:var(--gold);color:#7a5c1a;' : '';
      const tipAttr = tip ? `data-tooltip="${tip.replace(/"/g,"'")}"` : '';
      const cursor  = tip ? 'cursor:help;border-bottom:1px dashed rgba(139,26,26,0.3);' : '';
      return `<span class="detail-tag" style="margin:2px;${style}${cursor}" ${tipAttr}>${icon} ${f}</span>`;
    };
    container.innerHTML = [
      ...clsFeatures.map(f => mkTag('⚔', f, false)),
      ...raceTraits.map(t  => mkTag('🧝', t, true)),
    ].join('');
  }

  /* Klassen-Badge */
  function updateClassBadge() {
    const badge = document.getElementById('char-class-display');
    if (!badge) return;
    const cls  = DnDData.getClassById(Character.data.classId);
    const race = DnDData.getRaceById(Character.data.raceId);
    let text   = cls  ? `${cls.icon} ${cls.name}` : 'Keine Klasse';
    if (race) text += ` · ${race.icon} ${race.name}`;
    badge.textContent = text;
  }

  function init() {
    bindInputs();
    bindAbilities();
    renderSavingThrows();
    renderSkills();
    renderFeatures();
    updateClassBadge();

    document.getElementById('btn-new-char')?.addEventListener('click', () => {
      if (confirm('Neuen Charakter erstellen?')) { Character.reset(); location.reload(); }
    });
  }

  return { init, renderSkills, renderSavingThrows, renderFeatures, refreshAbilities, updateClassBadge };
})();
window.CharUI = CharUI;

/* ── Tabs ─────────────────────────────────────────────────────────────────── */
function initTabs() {
  const btns    = document.querySelectorAll('.tab-btn');
  const content = document.querySelectorAll('.tab-content');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      content.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
      // Kampagnen-Tab: immer neu rendern (aktueller Share-Status)
      if (btn.dataset.tab === 'campaign') CampaignUI.renderCampaign();
      if (btn.dataset.tab === 'journal')  JournalUI.init();
    });
  });
}

/* ── Persistenz & Multi-Charakter ─────────────────────────────────────────── */
function initPersistence() {

  /* 💾 Speichern */
  document.getElementById('btn-save')?.addEventListener('click', () => {
    if (Character.save()) showToast('💾 Gespeichert!');
    else showToast('❌ Speichern fehlgeschlagen');
  });

  /* 📂 Laden — zeigt Roster + JSON-Import */
  document.getElementById('btn-load')?.addEventListener('click', () => {
    renderRosterModal();
  });

  /* 🌐 Daten-Import (Spells API) */
  document.getElementById('btn-export-pdf')?.addEventListener('click', () => {
    PdfExport.generate();
  });

  document.getElementById('btn-import-api')?.addEventListener('click', () => {
    showModal('Online-Daten importieren', `
      <p style="font-size:14px;margin-bottom:12px;">Lade Spells aus der öffentlichen D&D 5e SRD API.</p>
      <button class="btn-primary" id="modal-api-spells">🌐 SRD Spells laden</button>
      <div id="api-status" style="margin-top:12px;font-size:13px;color:var(--ink-light);"></div>
    `);
    document.getElementById('modal-api-spells')?.addEventListener('click', fetchSpellsFromAPI);
  });
}

function renderRosterModal() {
  const roster = Character.roster;

  const rosterHTML = roster.length === 0
    ? '<p style="color:#8a7060;font-style:italic;font-size:13px;">Keine gespeicherten Charaktere.</p>'
    : `<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">
        ${roster.map(c => {
          const cls  = DnDData.getClassById(c.classId);
          const isActive = c.id === Character.data.id;
          return `
            <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:${isActive?'rgba(139,26,26,0.1)':'rgba(255,255,255,0.5)'};border:1px solid ${isActive?'var(--blood)':'rgba(200,165,90,0.3)'};border-radius:4px;">
              <div style="flex:1;">
                <div style="font-family:var(--font-title);font-size:13px;font-weight:600;color:var(--ink);">
                  ${isActive?'▶ ':''}${c.name||'Unbenannt'} ${isActive?'<span style="font-size:10px;color:var(--blood);">(aktiv)</span>':''}
                </div>
                <div style="font-size:12px;color:#8a7060;">
                  ${cls?cls.icon+' '+cls.name:'–'} · Level ${c.level} · ${c.race||'Keine Rasse'}
                </div>
              </div>
              ${!isActive?`<button class="btn-secondary" data-load="${c.id}" style="padding:4px 10px;font-size:11px;">Laden</button>`:''}
              <button class="btn-share ${Character.isShared()&&isActive?'btn-shared':''}" data-share="${c.id}"
                style="padding:4px 10px;font-size:11px;background:${Character.isShared()&&isActive?'rgba(34,197,94,0.15)':'rgba(201,150,42,0.1)'};border:1px solid ${Character.isShared()&&isActive?'#22c55e':'var(--gold)'};color:${Character.isShared()&&isActive?'#15803d':'var(--gold)'};border-radius:4px;cursor:pointer;font-family:var(--font-title);letter-spacing:0.5px;"
                title="${Character.isShared()&&isActive?'Teilen aufheben':'Mit Kampagne teilen'}">
                ${Character.isShared()&&isActive?'🌐 Geteilt':'🔒 Privat'}
              </button>
              <button class="btn-remove" data-delete="${c.id}" title="Löschen" style="font-size:16px;opacity:0.5;">🗑</button>
            </div>`;
        }).join('')}
      </div>`;

  showModal('📂 Charaktere', `
    ${rosterHTML}
    <div style="border-top:1px solid rgba(200,165,90,0.3);padding-top:12px;margin-top:4px;">

      <!-- Server-Sync Status -->
      <div id="sync-status" style="font-size:11px;color:#8a7060;margin-bottom:8px;font-style:italic;">
        ⏳ Prüfe Server-Verbindung…
      </div>

      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <button class="btn-primary" id="modal-sync-btn" style="flex:1;font-size:11px;padding:6px;">
          ☁ Vom Server laden
        </button>
        <button class="btn-secondary" id="modal-push-btn" style="flex:1;font-size:11px;padding:6px;">
          ⬆ Auf Server sichern
        </button>
      </div>

      <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">JSON Export / Import</div>
      <div style="display:flex;gap:8px;margin-bottom:8px;">
        <button class="btn-secondary" id="modal-export-btn" style="flex:1;">📋 Aktuell exportieren</button>
        <button class="btn-secondary" id="modal-show-import" style="flex:1;">📥 JSON importieren</button>
      </div>
      <div id="json-import-area" style="display:none;">
        <textarea id="import-json" placeholder='{"name":"Aragorn",...}' style="width:100%;height:100px;font-size:12px;font-family:monospace;margin-bottom:8px;"></textarea>
        <button class="btn-primary" id="modal-import-btn" style="width:100%;">Importieren</button>
      </div>
    </div>
  `);

  // Events
  // Server-Status prüfen
  fetch('/api/dnd/status')
    .then(r => r.json())
    .then(d => {
      const el = document.getElementById('sync-status');
      if (el) el.textContent = '☁ Speicherung: ' + (d.db === 'postgresql' ? '✅ PostgreSQL (persistent)' : '⚠ In-Memory (nicht persistent)');
    })
    .catch(() => {
      const el = document.getElementById('sync-status');
      if (el) el.textContent = '❌ Server nicht erreichbar — nur lokale Speicherung';
    });

  // Vom Server laden
  document.getElementById('modal-sync-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('modal-sync-btn');
    btn.textContent = '⏳ Lade…'; btn.disabled = true;
    const chars = await Character.loadFromServer();
    btn.textContent = '☁ Vom Server laden'; btn.disabled = false;
    if (chars.length > 0) {
      showToast('✅ ' + chars.length + ' Charakter(e) vom Server geladen!');
      closeModal();
      renderRosterModal(); // neu öffnen mit aktualisierten Daten
    } else {
      showToast('⚠ Keine Charaktere auf dem Server gefunden');
    }
  });

  // Aktuellen Charakter auf Server sichern
  document.getElementById('modal-push-btn')?.addEventListener('click', async () => {
    if (!Character.data.name) { showToast('⚠ Kein Charakter geladen'); return; }
    const btn = document.getElementById('modal-push-btn');
    btn.textContent = '⏳ Sende…'; btn.disabled = true;
    const ok = await Character.syncToServer();
    btn.textContent = '⬆ Auf Server sichern'; btn.disabled = false;
    showToast(ok ? '✅ Charakter auf Server gesichert!' : '❌ Server-Sync fehlgeschlagen — Console prüfen');
  });

  document.getElementById('modal-export-btn')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(Character.exportJSON());
    showToast('📋 JSON kopiert!');
  });

  document.getElementById('modal-show-import')?.addEventListener('click', () => {
    const area = document.getElementById('json-import-area');
    if (area) area.style.display = area.style.display==='none'?'block':'none';
  });

  document.getElementById('modal-import-btn')?.addEventListener('click', () => {
    const json = document.getElementById('import-json')?.value;
    if (Character.importJSON(json)) {
      closeModal(); showToast('✅ Charakter importiert!'); location.reload();
    } else showToast('❌ Ungültiges JSON');
  });

  document.querySelectorAll('[data-load]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (Character.loadFromRoster(btn.dataset.load)) {
        closeModal(); showToast('✅ Charakter geladen!'); location.reload();
      }
    });
  });

  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Charakter wirklich löschen?')) {
        Character.deleteFromRoster(btn.dataset.delete);
        Character.unshare();
        renderRosterModal();
      }
    });
  });

  document.querySelectorAll('[data-share]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.share;
      // Nur eigene aktive Chars teilen
      if (id !== Character.data.id) {
        showToast('💡 Lade den Charakter zuerst, um ihn zu teilen');
        return;
      }
      if (Character.isShared()) {
        if (confirm('Teilen aufheben? Der Charakter wird für andere nicht mehr sichtbar.')) {
          Character.unshare();
          await Character.unshareFromServer(Character.data.id);
          showToast('🔒 Charakter ist jetzt privat');
          renderRosterModal();
        }
      } else {
        Character.share();
        await Character.shareToServer(Character.data);
        showToast('🌐 Charakter wird mit der Kampagne geteilt!');
        renderRosterModal();
      }
    });
  });
}

/* ── API Spells ───────────────────────────────────────────────────────────── */
async function fetchSpellsFromAPI() {
  const status = document.getElementById('api-status');
  if (status) status.textContent = '⏳ Verbinde...';
  try {
    const resp = await fetch('https://www.dnd5eapi.co/api/spells');
    if (!resp.ok) throw new Error('Nicht erreichbar');
    const data = await resp.json();
    const list = data.results || [];
    if (status) status.textContent = `📥 Lade ${list.length} Spells...`;
    const details = await Promise.allSettled(
      list.slice(0, 30).map(s => fetch(`https://www.dnd5eapi.co/api/spells/${s.index}`).then(r=>r.json()))
    );
    const normalized = details.filter(r=>r.status==='fulfilled').map(r=>DnDData.normalizeApiSpell(r.value));
    DnDData.importExternal({ spells: normalized });
    if (status) status.textContent = `✅ ${normalized.length} Spells geladen!`;
    SpellsUI.init();
    showToast(`✨ ${normalized.length} Spells importiert!`);
  } catch(e) {
    if (status) status.textContent = '❌ Nicht erreichbar – lokale Daten werden genutzt';
  }
}

/* ── Online-Status ────────────────────────────────────────────────────────── */
function initOnlineStatus() {
  const badge = document.createElement('div');
  badge.className = 'online-status';
  document.body.appendChild(badge);
  const update = () => {
    badge.className = `online-status ${navigator.onLine?'online':'offline'}`;
    badge.textContent = navigator.onLine ? '🟢 Online' : '🔴 Offline';
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

/* ── Bootstrap ────────────────────────────────────────────────────────────── */
async function bootstrap() {
  await DnDData.init();

  // Auth initialisieren — App startet erst nach Login
  Auth.init();
  Auth.onReady(user => {
    console.log('[App] Eingeloggt als:', user.username);
    startApp(user);
  });
}

function startApp(user) {
  // User-Kontext setzen BEVOR Charaktere geladen werden
  Character.setUserContext(user);

  // Charakter laden: zuerst localStorage, dann Server-Sync
  Character.load();
  console.log('[App] Charakter geladen:', Character.data.name || '(neu)');

  Tooltip.init();
  initTabs();
  CharUI.init();
  ClassesUI.init();
  SpellsUI.init();
  ItemsUI.init();
  FeatsUI.init();
  SpellSlotUI.init();
  CampaignUI.init();
  JournalUI.init();
  DiceUI.init();

  // User-Badge im Header rendern
  Auth.updateHeaderBadge();

  // Share-Toggle im Kampagnen-Tab (delegated)
  document.getElementById('tab-campaign')?.addEventListener('click', async e => {
    if (e.target.id === 'btn-toggle-share' || e.target.closest('#btn-toggle-share')) {
      if (Character.isShared()) {
        if (confirm('Teilen aufheben?')) {
          Character.unshare();
          await Character.unshareFromServer(Character.data.id);
          showToast('🔒 Charakter ist jetzt privat');
          CampaignUI.renderCampaign();
        }
      } else {
        Character.share();
        await Character.shareToServer(Character.data);
        showToast('🌐 Charakter geteilt!');
        CampaignUI.renderCampaign();
      }
    }
  });

  ClassesUI.restoreFromSave();

  // Server-Sync im Hintergrund (non-blocking, nach UI-Init)
  if (!Auth.isGuest()) {
    setTimeout(() => {
      Character.loadFromServer()
        .then(chars => {
          if (chars.length > 0) {
            console.log('[App] Server-Sync:', chars.length, 'Charaktere geladen');
            showToast('☁ ' + chars.length + ' Charakter(e) vom Server synchronisiert');
          }
        })
        .catch(e => console.warn('[App] Server-Sync fehlgeschlagen:', e.message));
    }, 1500); // kurze Verzögerung damit UI fertig gerendert ist
  }
  SpellsUI.updateCharSummary();
  ItemsUI.updateCharSummary();
  FeatsUI.updateCharSummary();

  initPersistence();

  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // Auto-Save alle 30s
  setInterval(() => Character.save(), 30000);

  AppVersion.init();
  initOnlineStatus();
  console.log('[App] Bereit ⚔ v' + AppVersion.version);
}

document.addEventListener('DOMContentLoaded', bootstrap);
