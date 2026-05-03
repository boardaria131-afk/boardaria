/**
 * app.js — Haupt-Einstiegspunkt
 * Initialisiert alle Module, Tab-Navigation, Charakter-UI & globale Helfer.
 */

// ---------------------------------------------------------------------------
// Global Toast
// ---------------------------------------------------------------------------
function showToast(msg, duration = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}
window.showToast = showToast;

// ---------------------------------------------------------------------------
// CharUI — Charakter-Tab Logik
// ---------------------------------------------------------------------------
const CharUI = (() => {

  const ABILITIES = ['str','dex','con','int','wis','cha'];

  const SAVING_THROWS = [
    { key: 'str', label: 'Stärke' },
    { key: 'dex', label: 'Geschicklichkeit' },
    { key: 'con', label: 'Konstitution' },
    { key: 'int', label: 'Intelligenz' },
    { key: 'wis', label: 'Weisheit' },
    { key: 'cha', label: 'Charisma' },
  ];

  const SKILLS = [
    { key: 'acrobatics',      label: 'Akrobatik',          ability: 'DEX' },
    { key: 'animal_handling', label: 'Mit Tieren umgehen',  ability: 'WIS' },
    { key: 'arcana',          label: 'Arkanes Wissen',      ability: 'INT' },
    { key: 'athletics',       label: 'Athletik',            ability: 'STR' },
    { key: 'deception',       label: 'Täuschung',           ability: 'CHA' },
    { key: 'history',         label: 'Geschichte',          ability: 'INT' },
    { key: 'insight',         label: 'Einsicht',            ability: 'WIS' },
    { key: 'intimidation',    label: 'Einschüchterung',     ability: 'CHA' },
    { key: 'investigation',   label: 'Nachforschung',       ability: 'INT' },
    { key: 'medicine',        label: 'Medizin',             ability: 'WIS' },
    { key: 'nature',          label: 'Naturkunde',          ability: 'INT' },
    { key: 'perception',      label: 'Wahrnehmung',         ability: 'WIS' },
    { key: 'performance',     label: 'Aufführung',          ability: 'CHA' },
    { key: 'persuasion',      label: 'Überzeugung',         ability: 'CHA' },
    { key: 'religion',        label: 'Religionskunde',      ability: 'INT' },
    { key: 'sleight_of_hand', label: 'Taschenspielerei',   ability: 'DEX' },
    { key: 'stealth',         label: 'Heimlichkeit',        ability: 'DEX' },
    { key: 'survival',        label: 'Überleben',           ability: 'WIS' },
  ];

  function fmtMod(n) { return (n >= 0 ? '+' : '') + n; }

  function bindInputs() {
    // Text-Felder
    const bind = (id, field) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = Character.data[field] || '';
      el.addEventListener('input', () => Character.update({ [field]: el.value }));
    };
    bind('char-name', 'name');
    bind('char-race', 'race');
    bind('char-background', 'background');

    const bindNum = (id, field) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = Character.data[field] ?? '';
      el.addEventListener('input', () => Character.update({ [field]: parseInt(el.value) || 0 }));
    };
    bindNum('char-level',      'level');
    bindNum('char-xp',         'xp');
    bindNum('char-hp-current', 'hp_current');
    bindNum('char-hp-max',     'hp_max');
    bindNum('char-ac',         'ac');

    // Notizen
    const notes = document.getElementById('char-notes');
    if (notes) {
      notes.value = Character.data.notes || '';
      notes.addEventListener('input', () => Character.update({ notes: notes.value }));
    }
  }

  function bindAbilities() {
    ABILITIES.forEach(ab => {
      const block = document.querySelector(`.ability-block[data-ability="${ab}"]`);
      if (!block) return;
      const input = block.querySelector('.ability-score');
      const modEl = block.querySelector('.ability-mod');
      input.value = Character.data.abilities[ab];
      modEl.textContent = fmtMod(Character.getMod(Character.data.abilities[ab]));
      input.addEventListener('input', () => {
        const val = parseInt(input.value) || 10;
        Character.updateAbility(ab, val);
        modEl.textContent = fmtMod(Character.getMod(val));
        renderSkills();
      });
    });
  }

  function renderSavingThrows() {
    const container = document.getElementById('saving-throws');
    if (!container) return;
    container.innerHTML = SAVING_THROWS.map(st => {
      const prof = Character.data.proficiencies.saving_throws.includes(st.key);
      const bonus = Character.getSavingThrowBonus(st.key);
      return `
        <div class="skill-row">
          <input type="checkbox" data-st="${st.key}" ${prof ? 'checked' : ''} />
          <span class="skill-name">${st.label}</span>
          <span class="skill-ability">${st.key.toUpperCase()}</span>
          <span class="skill-value">${fmtMod(bonus)}</span>
        </div>
      `;
    }).join('');
    container.querySelectorAll('input[data-st]').forEach(cb => {
      cb.addEventListener('change', () => {
        Character.toggleSavingThrow(cb.dataset.st);
        renderSavingThrows();
      });
    });
  }

  function renderSkills() {
    const container = document.getElementById('skills-list');
    if (!container) return;
    container.innerHTML = SKILLS.map(sk => {
      const prof = Character.data.proficiencies.skills.includes(sk.key);
      const bonus = Character.getSkillBonus(sk.key);
      return `
        <div class="skill-row">
          <input type="checkbox" data-skill="${sk.key}" ${prof ? 'checked' : ''} />
          <span class="skill-name">${sk.label}</span>
          <span class="skill-ability">${sk.ability}</span>
          <span class="skill-value">${fmtMod(bonus)}</span>
        </div>
      `;
    }).join('');
    container.querySelectorAll('input[data-skill]').forEach(cb => {
      cb.addEventListener('change', () => {
        Character.toggleSkill(cb.dataset.skill);
        renderSkills();
      });
    });
  }

  function init() {
    bindInputs();
    bindAbilities();
    renderSavingThrows();
    renderSkills();

    document.getElementById('btn-new-char')?.addEventListener('click', () => {
      if (confirm('Neuen Charakter erstellen? Alle Änderungen gehen verloren.')) {
        Character.reset();
        location.reload();
      }
    });
  }

  return { init, renderSkills, renderSavingThrows };
})();

window.CharUI = CharUI;

// ---------------------------------------------------------------------------
// Tab-Navigation
// ---------------------------------------------------------------------------
function initTabs() {
  const btns    = document.querySelectorAll('.tab-btn');
  const content = document.querySelectorAll('.tab-content');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      content.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
}

// ---------------------------------------------------------------------------
// Speichern / Laden / Import
// ---------------------------------------------------------------------------
function initPersistence() {
  document.getElementById('btn-save')?.addEventListener('click', () => {
    if (Character.save()) showToast('💾 Charakter gespeichert!');
    else showToast('❌ Speichern fehlgeschlagen');
  });

  document.getElementById('btn-load')?.addEventListener('click', () => {
    showModal('Charakter laden', `
      <div class="form-group">
        <label>JSON einfügen</label>
        <textarea id="import-json" placeholder='{"name":"Aragorn",...}'></textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn-primary" id="modal-import-btn">Importieren</button>
        <button class="btn-secondary" id="modal-export-btn">JSON kopieren</button>
      </div>
    `);
    document.getElementById('modal-export-btn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(Character.exportJSON());
      showToast('📋 JSON in Zwischenablage kopiert!');
    });
    document.getElementById('modal-import-btn')?.addEventListener('click', () => {
      const json = document.getElementById('import-json')?.value;
      if (Character.importJSON(json)) {
        closeModal();
        showToast('✅ Charakter geladen!');
        location.reload();
      } else {
        showToast('❌ Ungültiges JSON');
      }
    });
  });

  document.getElementById('btn-import-api')?.addEventListener('click', () => {
    showModal('Online-Daten importieren (dnd5eapi.co)', `
      <p style="margin-bottom:12px;font-size:14px;">Lade Spells direkt aus der öffentlichen D&D 5e SRD API.</p>
      <div style="display:flex;gap:8px;">
        <button class="btn-primary" id="modal-api-spells">🌐 Spells laden</button>
      </div>
      <div id="api-status" style="margin-top:12px;font-size:13px;color:var(--ink-light);"></div>
    `);
    document.getElementById('modal-api-spells')?.addEventListener('click', fetchSpellsFromAPI);
  });
}

async function fetchSpellsFromAPI() {
  const status = document.getElementById('api-status');
  if (status) status.textContent = '⏳ Verbindung...';
  try {
    const resp = await fetch('https://www.dnd5eapi.co/api/spells?limit=50');
    if (!resp.ok) throw new Error('API nicht erreichbar');
    const data = await resp.json();
    const spellList = data.results || [];
    if (status) status.textContent = `📥 Lade ${spellList.length} Spells...`;

    // Lade Details für erste 20 Spells
    const details = await Promise.allSettled(
      spellList.slice(0, 20).map(s =>
        fetch(`https://www.dnd5eapi.co/api/spells/${s.index}`).then(r => r.json())
      )
    );
    const normalized = details
      .filter(r => r.status === 'fulfilled')
      .map(r => DnDData.normalizeApiSpell(r.value));

    DnDData.importExternal({ spells: normalized });
    if (status) status.textContent = `✅ ${normalized.length} Spells importiert!`;
    SpellsUI.init();
    showToast(`✨ ${normalized.length} API-Spells geladen!`);
  } catch (e) {
    if (status) status.textContent = '❌ API nicht erreichbar – offline Daten werden genutzt';
  }
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
function showModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

window.showModal = showModal;
window.closeModal = closeModal;

// ---------------------------------------------------------------------------
// Online-Status
// ---------------------------------------------------------------------------
function initOnlineStatus() {
  const badge = document.createElement('div');
  badge.className = 'online-status';
  document.body.appendChild(badge);

  const update = () => {
    badge.className = `online-status ${navigator.onLine ? 'online' : 'offline'}`;
    badge.textContent = navigator.onLine ? '🟢 Online' : '🔴 Offline';
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ---------------------------------------------------------------------------
// App Bootstrap
// ---------------------------------------------------------------------------
async function bootstrap() {
  // Daten laden
  await DnDData.init();

  // Charakter aus LocalStorage laden
  Character.load();

  // UI initialisieren
  initTabs();
  CharUI.init();
  ClassesUI.init();
  SpellsUI.init();
  ItemsUI.init();
  DiceUI.init();

  // Gespeicherte Zustände wiederherstellen
  ClassesUI.restoreFromSave();
  SpellsUI.updateCharSummary();
  ItemsUI.updateCharSummary();

  // Persistence & Modal
  initPersistence();
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  initOnlineStatus();
  console.log('[App] Bereit ⚔');
}

document.addEventListener('DOMContentLoaded', bootstrap);
