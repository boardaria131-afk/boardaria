/**
 * homebrew.js — Custom/Homebrew Einträge für alle Bereiche
 * Spieler können eigene Spells, Items, Rassen, Subklassen, Hintergründe, Feats hinzufügen
 */

const HomebrewUI = (() => {

  const STORE_KEY = 'dnd_homebrew';

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
    catch { return {}; }
  }

  function save(data) {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  }

  function getAll(type) {
    return load()[type] || [];
  }

  function add(type, entry) {
    const data = load();
    if (!data[type]) data[type] = [];
    data[type].push({ ...entry, _homebrew: true, id: entry.id || type + '_hb_' + Date.now() });
    save(data);
    // Ins globale DnDData einpflegen
    injectIntoDnDData(type, data[type]);
  }

  function remove(type, id) {
    const data = load();
    if (!data[type]) return;
    data[type] = data[type].filter(e => e.id !== id);
    save(data);
  }

  function injectIntoDnDData(type, entries) {
    if (!window.DnDData) return;
    switch(type) {
      case 'spells':
        entries.forEach(e => {
          if (!DnDData.spells.find(s => s.id === e.id)) DnDData.spells.push(e);
        });
        break;
      case 'items':
        entries.forEach(e => {
          if (!DnDData.items.find(i => i.id === e.id)) DnDData.items.push(e);
        });
        break;
      case 'feats':
        entries.forEach(e => {
          if (!DnDData.feats.find(f => f.id === e.id)) DnDData.feats.push(e);
        });
        break;
      case 'backgrounds':
        entries.forEach(e => {
          if (!DnDData.backgrounds.find(b => b.id === e.id)) DnDData.backgrounds.push(e);
        });
        break;
    }
  }

  function injectAll() {
    const data = load();
    Object.entries(data).forEach(([type, entries]) => injectIntoDnDData(type, entries));
  }

  // ── Haupt-Dialog ──────────────────────────────────────────────────────────
  function showCreator(type) {
    const configs = {
      spell: {
        title: '✨ Homebrew Spell',
        fields: [
          { id: 'name',         label: 'Name *',           type: 'text',   placeholder: 'z.B. Flammenwirbel' },
          { id: 'level',        label: 'Level',            type: 'select', options: ['0 (Cantrip)','1','2','3','4','5','6','7','8','9'] },
          { id: 'school',       label: 'Schule',           type: 'select', options: ['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation','Homebrew'] },
          { id: 'casting_time', label: 'Zauberzeit',       type: 'text',   placeholder: '1 action' },
          { id: 'range',        label: 'Reichweite',       type: 'text',   placeholder: '60 feet' },
          { id: 'components',   label: 'Komponenten',      type: 'text',   placeholder: 'V, S, M' },
          { id: 'duration',     label: 'Dauer',            type: 'text',   placeholder: 'Instantaneous' },
          { id: 'classes',      label: 'Klassen',          type: 'text',   placeholder: 'wizard, sorcerer' },
          { id: 'description',  label: 'Beschreibung *',   type: 'textarea' },
        ],
        build: f => ({
          id:           'hb_spell_' + Date.now(),
          name:         f.name,
          level:        parseInt(f.level) || 0,
          school:       f.school || 'Homebrew',
          casting_time: f.casting_time || '1 action',
          range:        f.range || '30 feet',
          components:   (f.components || 'V').split(',').map(s => s.trim()),
          duration:     f.duration || 'Instantaneous',
          classes:      (f.classes || '').split(',').map(s => s.trim()).filter(Boolean),
          description:  f.description,
          _homebrew:    true,
        }),
      },
      item: {
        title: '🗡️ Homebrew Item',
        fields: [
          { id: 'name',        label: 'Name *',         type: 'text',   placeholder: 'z.B. Schwert der Ahnen' },
          { id: 'type',        label: 'Typ',            type: 'select', options: ['Weapon','Armor','Wondrous Item','Potion','Ring','Staff','Wand','Homebrew'] },
          { id: 'rarity',      label: 'Seltenheit',     type: 'select', options: ['Common','Uncommon','Rare','Very Rare','Legendary','Artifact'] },
          { id: 'damage',      label: 'Schaden/Effekt', type: 'text',   placeholder: '1d8+2 slashing' },
          { id: 'properties',  label: 'Eigenschaften',  type: 'text',   placeholder: 'Requires Attunement, Magical' },
          { id: 'description', label: 'Beschreibung *', type: 'textarea' },
        ],
        build: f => ({
          id:          'hb_item_' + Date.now(),
          name:        f.name,
          type:        f.type || 'Homebrew',
          rarity:      f.rarity || 'Uncommon',
          damage:      f.damage || '',
          properties:  (f.properties || '').split(',').map(s=>s.trim()).filter(Boolean),
          description: f.description,
          _homebrew:   true,
        }),
      },
      feat: {
        title: '⭐ Homebrew Feat',
        fields: [
          { id: 'name',          label: 'Name *',            type: 'text',     placeholder: 'z.B. Magiebegabter' },
          { id: 'prerequisites', label: 'Voraussetzungen',   type: 'text',     placeholder: 'z.B. INT 13+' },
          { id: 'category',      label: 'Kategorie',         type: 'select',   options: ['Combat','Spellcasting','Utility','Defense','Support','Homebrew'] },
          { id: 'description',   label: 'Beschreibung *',    type: 'textarea' },
          { id: 'benefits',      label: 'Vorteile (je Zeile)', type: 'textarea', placeholder: '+1 Intelligenz\nNeue Fähigkeit...' },
        ],
        build: f => ({
          id:            'hb_feat_' + Date.now(),
          name:          f.name,
          prerequisites: f.prerequisites || '',
          category:      f.category || 'Homebrew',
          tier:          'HB',
          description:   f.description,
          benefits:      (f.benefits || '').split('\n').map(s=>s.trim()).filter(Boolean),
          _homebrew:     true,
        }),
      },
      background: {
        title: '📜 Homebrew Hintergrund',
        fields: [
          { id: 'name',        label: 'Name *',              type: 'text',     placeholder: 'z.B. Straßenmusiker' },
          { id: 'icon',        label: 'Icon (Emoji)',         type: 'text',     placeholder: '🎵' },
          { id: 'skill_proficiencies', label: 'Fertigkeiten', type: 'text',    placeholder: 'performance, deception' },
          { id: 'feature',     label: 'Merkmal-Name',         type: 'text',     placeholder: 'z.B. Straßenruf' },
          { id: 'feature_desc',label: 'Merkmal-Beschreibung', type: 'textarea', placeholder: 'Was gibt dieses Merkmal?' },
          { id: 'description', label: 'Allgemeine Beschreibung *', type: 'textarea' },
        ],
        build: f => ({
          id:                 'hb_bg_' + Date.now(),
          name:               f.name,
          icon:               f.icon || '📜',
          skill_proficiencies:(f.skill_proficiencies||'').split(',').map(s=>s.trim()).filter(Boolean),
          feature:            f.feature || '',
          feature_desc:       f.feature_desc || '',
          description:        f.description,
          _homebrew:          true,
        }),
      },
      race: {
        title: '🧬 Homebrew Rasse',
        fields: [
          { id: 'name',        label: 'Name *',          type: 'text',     placeholder: 'z.B. Halbdrache' },
          { id: 'icon',        label: 'Icon (Emoji)',     type: 'text',     placeholder: '🐉' },
          { id: 'size',        label: 'Größe',           type: 'select',   options: ['Tiny','Small','Medium','Large'] },
          { id: 'speed',       label: 'Geschwindigkeit', type: 'text',     placeholder: '30' },
          { id: 'asi',         label: 'Attributboni',    type: 'text',     placeholder: 'STR+2, CON+1' },
          { id: 'traits',      label: 'Rassenmerkmale (je Zeile)', type: 'textarea', placeholder: 'Darkvision 60 ft\nDrachen-Widerstand' },
          { id: 'description', label: 'Beschreibung *',  type: 'textarea' },
        ],
        build: f => ({
          id:          'hb_race_' + Date.now(),
          name:        f.name,
          icon:        f.icon || '🧬',
          size:        f.size || 'Medium',
          speed:       parseInt(f.speed) || 30,
          asi:         f.asi || '',
          traits:      (f.traits||'').split('\n').map(s=>s.trim()).filter(Boolean),
          description: f.description,
          _homebrew:   true,
        }),
      },
      subclass: {
        title: '🎓 Homebrew Subklasse',
        fields: [
          { id: 'name',        label: 'Name *',                   type: 'text',     placeholder: 'z.B. Weg des Sturmkriegers' },
          { id: 'class',       label: 'Basisklasse',              type: 'select',   options: ['barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard','artificer'] },
          { id: 'role',        label: 'Rolle',                    type: 'text',     placeholder: 'z.B. Tank/Support' },
          { id: 'features',    label: 'Features (je Zeile)',      type: 'textarea', placeholder: 'Sturmschlag\nDonneraura' },
          { id: 'description', label: 'Beschreibung *',           type: 'textarea' },
        ],
        build: f => ({
          id:          'hb_sc_' + Date.now(),
          name:        f.name,
          classId:     f.class || 'fighter',
          role:        f.role || 'Homebrew',
          features:    (f.features||'').split('\n').map(s=>s.trim()).filter(Boolean),
          description: f.description,
          _homebrew:   true,
          tier:        'HB',
        }),
      },
    };

    const cfg = configs[type];
    if (!cfg) return;

    showModal(cfg.title, `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${cfg.fields.map(field => `
          <div class="form-group" style="margin:0;">
            <label>${field.label}</label>
            ${field.type === 'textarea'
              ? `<textarea id="hb-${field.id}" placeholder="${field.placeholder||''}"
                  style="min-height:80px;resize:vertical;"></textarea>`
              : field.type === 'select'
              ? `<select id="hb-${field.id}">
                  ${(field.options||[]).map(o=>`<option value="${o.toLowerCase().split(' ')[0]}">${o}</option>`).join('')}
                </select>`
              : `<input type="text" id="hb-${field.id}" placeholder="${field.placeholder||''}" />`
            }
          </div>
        `).join('')}

        <div style="display:flex;gap:8px;margin-top:4px;">
          <button class="btn-primary" id="hb-save" style="flex:1;">✅ Erstellen</button>
          <button class="btn-secondary" id="hb-cancel">Abbrechen</button>
        </div>
        <div id="hb-error" style="color:var(--blood);font-size:12px;"></div>
      </div>
    `);

    document.getElementById('hb-save')?.addEventListener('click', () => {
      const fields = {};
      cfg.fields.forEach(f => {
        fields[f.id] = document.getElementById('hb-' + f.id)?.value?.trim() || '';
      });

      // Pflichtfelder prüfen
      const requiredField = cfg.fields.find(f => f.label.includes('*') && !fields[f.id]);
      if (requiredField) {
        document.getElementById('hb-error').textContent = '❌ ' + requiredField.label.replace(' *','') + ' ist erforderlich';
        return;
      }

      const entry = cfg.build(fields);
      add(type, entry);

      closeModal();
      showToast(`✅ "${fields.name}" als Homebrew gespeichert!`);

      // Relevante UI aktualisieren
      setTimeout(() => {
        if (type === 'spell'      && window.SpellsUI)   SpellsUI.init?.();
        if (type === 'item'       && window.ItemsUI)    ItemsUI.init?.();
        if (type === 'feat'       && window.FeatsUI)    FeatsUI.init?.();
        if (type === 'background' && window.ClassesUI)  ClassesUI.renderBackgroundList?.();
      }, 100);
    });

    document.getElementById('hb-cancel')?.addEventListener('click', closeModal);
    setTimeout(() => document.getElementById('hb-name')?.focus(), 100);
  }

  // ── Übersicht aller Homebrew-Einträge ────────────────────────────────────
  function showOverview() {
    const data = load();
    const types = {
      spell: { label: 'Spells', icon: '✨' },
      item:  { label: 'Items',  icon: '🗡️' },
      feat:  { label: 'Feats',  icon: '⭐' },
      background: { label: 'Hintergründe', icon: '📜' },
      race:  { label: 'Rassen', icon: '🧬' },
      subclass: { label: 'Subklassen', icon: '🎓' },
    };

    const total = Object.values(data).reduce((s, arr) => s + arr.length, 0);

    showModal('🏠 Homebrew Sammlung', `
      <div style="font-size:13px;color:#8a7060;margin-bottom:12px;">
        ${total} eigene Einträge gespeichert
      </div>
      ${Object.entries(types).map(([type, cfg]) => {
        const entries = data[type] || [];
        return `
          <div style="margin-bottom:12px;">
            <div style="font-family:var(--font-title);font-size:11px;color:var(--blood);
              text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
              ${cfg.icon} ${cfg.label} (${entries.length})
            </div>
            ${entries.length === 0
              ? `<div style="font-size:12px;color:#8a7060;font-style:italic;">Keine eigenen ${cfg.label}</div>`
              : entries.map(e => `
                <div style="display:flex;align-items:center;gap:8px;padding:5px 8px;
                  background:rgba(255,255,255,0.4);border:1px solid rgba(200,165,90,0.2);
                  border-radius:4px;margin-bottom:3px;">
                  <span style="flex:1;font-size:13px;">${e.name}</span>
                  <span class="detail-tag" style="font-size:10px;background:rgba(201,150,42,0.1);">HB</span>
                  <button onclick="HomebrewUI.remove('${type}','${e.id}');HomebrewUI.showOverview();"
                    style="background:none;border:none;color:rgba(139,26,26,0.5);cursor:pointer;font-size:14px;">✕</button>
                </div>`
              ).join('')}
            <button onclick="HomebrewUI.showCreator('${type}')"
              class="btn-secondary" style="font-size:11px;margin-top:4px;">
              ➕ ${cfg.label.slice(0,-1)} hinzufügen
            </button>
          </div>`;
      }).join('')}
    `);
  }

  function init() {
    // Alle gespeicherten Homebrew-Einträge in DnDData einpflegen
    injectAll();
  }

  return { init, showCreator, showOverview, add, remove, getAll };
})();

window.HomebrewUI = HomebrewUI;
