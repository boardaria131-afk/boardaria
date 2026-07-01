/**
 * dndb_import.js — D&D Beyond JSON Import
 * Format: character-service.dndbeyond.com/character/v5/character/{id}
 */

const DnDBImport = (() => {

  const ABILITY_MAP = { 1:'str', 2:'dex', 3:'con', 4:'int', 5:'wis', 6:'cha' };

  const CLASS_MAP = {
    1:'barbarian', 2:'bard', 3:'cleric', 4:'druid', 5:'fighter',
    6:'monk', 7:'paladin', 8:'ranger', 9:'rogue', 10:'sorcerer',
    11:'warlock', 12:'wizard', 14:'artificer',
  };

  const SKILL_MAP_DNDB = {
    'acrobatics':'acrobatics', 'animal-handling':'animal_handling',
    'arcana':'arcana', 'athletics':'athletics', 'deception':'deception',
    'history':'history', 'insight':'insight', 'intimidation':'intimidation',
    'investigation':'investigation', 'medicine':'medicine', 'nature':'nature',
    'perception':'perception', 'performance':'performance', 'persuasion':'persuasion',
    'religion':'religion', 'sleight-of-hand':'sleight_of_hand',
    'stealth':'stealth', 'survival':'survival',
  };

  const SAVE_SUBTYPES = {
    'strength-saving-throws':'str', 'dexterity-saving-throws':'dex',
    'constitution-saving-throws':'con', 'intelligence-saving-throws':'int',
    'wisdom-saving-throws':'wis', 'charisma-saving-throws':'cha',
  };

  function parse(raw) {
    const d = raw.data || raw;
    // Basis-Charakter aus aktuellem Stand
    const char = JSON.parse(JSON.stringify(Character.data));

    // Name
    char.name = d.name || char.name;

    // Rasse
    if (d.race) {
      char.race = d.race.fullName || d.race.baseName || '';
    }

    // Klassen
    const classes = d.classes || [];
    if (classes.length) {
      char.classes = classes.map(c => ({
        classId:    CLASS_MAP[c.definition?.id] ||
                    (c.definition?.name || '').toLowerCase() ||
                    'fighter',
        level:      c.level || 1,
        subclassId: c.subclassDefinition?.name
          ? c.subclassDefinition.name.toLowerCase().replace(/[^a-z0-9]+/g,'_')
          : null,
      }));
      char.classId    = char.classes[0]?.classId;
      char.level      = char.classes.reduce((s, c) => s + (c.level||1), 0);
      char.subclassId = char.classes[0]?.subclassId || null;
    }

    // Attribute
    const abilities = { str:10, dex:10, con:10, int:10, wis:10, cha:10 };
    (d.stats || []).forEach(s => {
      const ab = ABILITY_MAP[s.id];
      if (ab && s.value != null) abilities[ab] = s.value;
    });
    // Override hat Vorrang
    (d.overrideStats || []).forEach(s => {
      const ab = ABILITY_MAP[s.id];
      if (ab && s.value != null) abilities[ab] = s.value;
    });
    // Bonus-Stats (ASI etc.)
    (d.bonusStats || []).forEach(s => {
      const ab = ABILITY_MAP[s.id];
      if (ab && s.value) abilities[ab] = (abilities[ab] || 10) + s.value;
    });
    char.abilities = abilities;

    // HP
    const baseHP = d.overrideHitPoints || d.baseHitPoints || char.hp_max;
    char.hp_max     = baseHP;
    char.hp_current = d.removedHitPoints != null
      ? Math.max(0, baseHP - d.removedHitPoints)
      : baseHP;
    char.hp_temp = d.temporaryHitPoints || 0;

    // Speed aus Rasse
    const walkSpeed = d.race?.weightSpeeds?.normal?.walk;
    if (walkSpeed) char.speed = walkSpeed;

    // Hintergrund
    if (d.background?.definition?.name) {
      char.background = d.background.definition.name;
    }

    // XP
    if (d.currentXp != null) char.xp = d.currentXp;

    // Proficiencies aus allen Modifier-Gruppen
    const allMods = Object.values(d.modifiers || {}).flat();
    const skillProfs = new Set(char.proficiencies?.skills || []);
    const saveProfs  = new Set(char.proficiencies?.saving_throws || []);

    allMods.forEach(mod => {
      if (mod.type !== 'proficiency') return;
      const sub = (mod.subType || '').toLowerCase();
      // Skills
      if (SKILL_MAP_DNDB[sub]) skillProfs.add(SKILL_MAP_DNDB[sub]);
      // Saves
      if (SAVE_SUBTYPES[sub]) saveProfs.add(SAVE_SUBTYPES[sub]);
    });

    char.proficiencies = {
      skills:        [...skillProfs],
      saving_throws: [...saveProfs],
    };

    // Notizen
    const notes = d.notes || {};
    const parts = [];
    if (notes.backstory)     parts.push('📖 Hintergrund:\n' + notes.backstory.replace(/<[^>]+>/g,'').trim());
    if (notes.allies)        parts.push('🤝 Verbündete: ' + notes.allies);
    if (notes.enemies)       parts.push('⚔ Feinde: ' + notes.enemies);
    if (notes.otherNotes)    parts.push('📝 ' + notes.otherNotes);
    if (parts.length) char.notes = parts.join('\n\n');

    // Persönlichkeitsmerkmale
    const traits = d.traits || {};
    const tparts = [];
    if (traits.personalityTraits) tparts.push('🎭 Persönlichkeit: ' + traits.personalityTraits);
    if (traits.ideals)            tparts.push('💡 Ideale: ' + traits.ideals);
    if (traits.bonds)             tparts.push('❤ Bindungen: ' + traits.bonds);
    if (traits.flaws)             tparts.push('⚠ Schwächen: ' + traits.flaws);
    if (tparts.length) char.notes = (char.notes ? char.notes + '\n\n' : '') + tparts.join('\n');

    // Spells — über Namen matchen
    const spellIds = new Set();
    (d.classSpells || []).forEach(cls => {
      (cls.spells || []).forEach(sp => {
        const name = (sp.definition?.name || '').toLowerCase();
        const match = window.DnDData?.spells?.find(s => s.name.toLowerCase() === name);
        if (match) spellIds.add(match.id);
      });
    });
    if (spellIds.size) char.spellIds = [...spellIds];

    // Items — über Namen matchen
    const itemIds = new Set();
    (d.inventory || []).forEach(inv => {
      const name = (inv.definition?.name || '').toLowerCase();
      const match = window.DnDData?.items?.find(i => i.name.toLowerCase() === name);
      if (match) itemIds.add(match.id);
    });
    if (itemIds.size) char.itemIds = [...itemIds];

    // Avatar
    if (d.avatarUrl) char.avatarUrl = d.avatarUrl;

    // Spielbereit auf Entwurf setzen
    char.readyStatus = 'not_ready';
    char.readyNotes  = 'Aus D&D Beyond importiert — bitte prüfen und ggf. ergänzen';

    return char;
  }

  // ── Import-Dialog ─────────────────────────────────────────────────────────
  function showImportDialog() {
    showModal('📥 D&D Beyond Import', `
      <div style="margin-bottom:12px;padding:10px;background:rgba(201,150,42,0.06);
        border:1px solid rgba(201,150,42,0.2);border-radius:6px;
        font-size:12px;color:#8a7060;line-height:1.6;">
        <strong style="color:var(--ink);">So holst du dein Charakter-JSON:</strong><br>
        1. Öffne deinen Charakter auf <strong>dndbeyond.com</strong><br>
        2. Füge <code style="background:rgba(0,0,0,0.1);padding:1px 4px;border-radius:3px;">/json</code>
           ans Ende der URL an — oder öffne:<br>
        <code style="font-size:11px;word-break:break-all;">
          character-service.dndbeyond.com/character/v5/character/<strong>DEINE-ID</strong>
        </code><br>
        3. Kopiere den <strong>gesamten Text</strong> und füge ihn unten ein
      </div>

      <textarea id="dndb-json-input"
        placeholder='Hier JSON einfügen — z.B. {"data":{"id":167734925,"name":"Aragorn",...}}'
        style="width:100%;min-height:130px;font-size:11px;font-family:monospace;
        background:rgba(255,255,255,0.7);border:1px solid rgba(200,165,90,0.35);
        border-radius:6px;padding:8px;resize:vertical;color:var(--ink);
        line-height:1.4;"></textarea>

      <div id="dndb-preview" style="display:none;margin-top:8px;padding:8px 12px;
        background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.35);
        border-radius:6px;font-size:13px;color:#4ade80;line-height:1.5;"></div>

      <div id="dndb-error" style="display:none;margin-top:6px;
        font-size:12px;color:var(--blood);"></div>

      <div style="display:flex;gap:8px;margin-top:10px;">
        <button id="btn-dndb-import" class="btn-primary" style="flex:1;">
          ✅ Charakter importieren
        </button>
        <button class="btn-secondary" onclick="closeModal()">Abbrechen</button>
      </div>
    `);

    // Live-Vorschau
    document.getElementById('dndb-json-input')?.addEventListener('input', e => {
      const raw = e.target.value.trim();
      if (raw.length < 10) return;
      try {
        const json = JSON.parse(raw);
        showPreview(json);
        document.getElementById('dndb-error').style.display = 'none';
      } catch { /* tippen noch nicht fertig */ }
    });

    // Import
    document.getElementById('btn-dndb-import')?.addEventListener('click', () => {
      const raw = document.getElementById('dndb-json-input')?.value.trim();
      if (!raw) {
        showError('Bitte JSON einfügen'); return;
      }
      let json;
      try { json = JSON.parse(raw); }
      catch { showError('Ungültiges JSON — bitte vollständigen Text einfügen'); return; }

      try {
        const imported = parse(json);
        // Neuen Charakter anlegen (nicht überschreiben)
        imported.id = Date.now().toString(36);
        Object.assign(Character.data, imported);
        Character.save();

        // UI aktualisieren
        if (typeof CharUI !== 'undefined')          CharUI.init?.();
        if (typeof SummaryUI !== 'undefined')        SummaryUI.init?.();
        if (typeof SpellsUI !== 'undefined')         SpellsUI.init?.();
        if (typeof LevelUpUI !== 'undefined')        LevelUpUI.renderLevelUpPanel?.();
        if (typeof updatePassiveStats === 'function') updatePassiveStats();
        if (typeof CombatUI !== 'undefined')         CombatUI.update?.();

        closeModal();
        showToast(`✅ "${imported.name}" importiert! Bitte Werte prüfen.`);
      } catch(e) {
        showError('Import fehlgeschlagen: ' + e.message);
        console.error('[DnDB Import]', e);
      }
    });
  }

  function showPreview(json) {
    const d = json.data || json;
    const el = document.getElementById('dndb-preview');
    if (!el) return;
    const classes = (d.classes || [])
      .map(c => (c.definition?.name || '?') + ' ' + (c.level||1))
      .join(' / ');
    const hp = d.overrideHitPoints || d.baseHitPoints || '?';
    el.style.display = 'block';
    el.innerHTML = `
      ✅ <strong>${d.name || '?'}</strong> erkannt<br>
      <span style="color:var(--ink-d);">
        Rasse: ${d.race?.fullName || d.race?.baseName || '?'} ·
        Klasse: ${classes || '?'} ·
        HP: ${hp} ·
        Hintergrund: ${d.background?.definition?.name || '?'}
      </span>
    `;
  }

  function showError(msg) {
    const el = document.getElementById('dndb-error');
    if (el) { el.textContent = '❌ ' + msg; el.style.display = 'block'; }
  }

  return { showImportDialog, parse };
})();

window.DnDBImport = DnDBImport;
