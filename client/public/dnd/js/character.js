/**
 * character.js — Charakter-Datenmodell & Persistenz
 * Verwaltet den aktiven Charakter, Speicherung & Laden.
 */

const Character = (() => {
  const STORAGE_KEY = 'dnd5e_character';

  /** Datenmodell — alle Felder des Charakters */
  function createDefault() {
    return {
      name: '',
      race: '',
      background: '',
      level: 1,
      xp: 0,
      classId: null,
      subclassId: null,
      hp_current: 10,
      hp_max: 10,
      ac: 10,
      abilities: {
        str: 10, dex: 10, con: 10,
        int: 10, wis: 10, cha: 10,
      },
      proficiencies: {
        saving_throws: [],   // ['str', 'con', ...]
        skills: [],          // ['athletics', 'stealth', ...]
      },
      spellIds: [],   // gespeicherte Spell-IDs
      itemIds:  [],   // gespeicherte Item-IDs
      notes: '',
    };
  }

  let _char = createDefault();

  // ---------------------------------------------------------------------------
  // Persistenz
  // ---------------------------------------------------------------------------

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_char));
      return true;
    } catch (e) {
      console.error('[Character] Speichern fehlgeschlagen:', e);
      return false;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      _char = { ...createDefault(), ...JSON.parse(raw) };
      return true;
    } catch (e) {
      console.error('[Character] Laden fehlgeschlagen:', e);
      return false;
    }
  }

  function exportJSON() {
    return JSON.stringify(_char, null, 2);
  }

  function importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      _char = { ...createDefault(), ...data };
      save();
      return true;
    } catch (e) {
      console.error('[Character] Import fehlgeschlagen:', e);
      return false;
    }
  }

  function reset() {
    _char = createDefault();
    save();
  }

  // ---------------------------------------------------------------------------
  // Berechnungen
  // ---------------------------------------------------------------------------

  /** Modifier aus Attributswert (D&D Formel: floor((val - 10) / 2)) */
  function getMod(score) {
    return Math.floor((score - 10) / 2);
  }

  /** Bonus aus Proficiency (Level-basiert) */
  function getProficiencyBonus() {
    return Math.ceil(_char.level / 4) + 1;
  }

  /** Rettungswurf-Bonus für Attribut */
  function getSavingThrowBonus(ability) {
    const base = getMod(_char.abilities[ability]);
    const prof = _char.proficiencies.saving_throws.includes(ability)
      ? getProficiencyBonus() : 0;
    return base + prof;
  }

  // Skill → Attribut-Mapping
  const SKILL_MAP = {
    acrobatics:      'dex',
    animal_handling: 'wis',
    arcana:          'int',
    athletics:       'str',
    deception:       'cha',
    history:         'int',
    insight:         'wis',
    intimidation:    'cha',
    investigation:   'int',
    medicine:        'wis',
    nature:          'int',
    perception:      'wis',
    performance:     'cha',
    persuasion:      'cha',
    religion:        'int',
    sleight_of_hand: 'dex',
    stealth:         'dex',
    survival:        'wis',
  };

  function getSkillBonus(skill) {
    const ability = SKILL_MAP[skill];
    const base = getMod(_char.abilities[ability]);
    const prof = _char.proficiencies.skills.includes(skill)
      ? getProficiencyBonus() : 0;
    return base + prof;
  }

  // ---------------------------------------------------------------------------
  // Spells & Items
  // ---------------------------------------------------------------------------

  function addSpell(id) {
    if (!_char.spellIds.includes(id)) {
      _char.spellIds.push(id);
      save();
      return true;
    }
    return false;
  }

  function removeSpell(id) {
    _char.spellIds = _char.spellIds.filter(s => s !== id);
    save();
  }

  function addItem(id) {
    _char.itemIds.push(id); // Mehrfach erlaubt (Anzahl)
    save();
    return true;
  }

  function removeItem(id) {
    const idx = _char.itemIds.indexOf(id);
    if (idx >= 0) _char.itemIds.splice(idx, 1);
    save();
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  function update(fields) {
    Object.assign(_char, fields);
    save();
  }

  function updateAbility(ability, score) {
    _char.abilities[ability] = parseInt(score) || 10;
    save();
  }

  function toggleSavingThrow(ability) {
    const arr = _char.proficiencies.saving_throws;
    const idx = arr.indexOf(ability);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(ability);
    save();
  }

  function toggleSkill(skill) {
    const arr = _char.proficiencies.skills;
    const idx = arr.indexOf(skill);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(skill);
    save();
  }

  return {
    get data() { return _char; },
    save, load, exportJSON, importJSON, reset,
    getMod, getProficiencyBonus,
    getSavingThrowBonus, getSkillBonus,
    SKILL_MAP,
    addSpell, removeSpell,
    addItem, removeItem,
    update, updateAbility,
    toggleSavingThrow, toggleSkill,
  };
})();

window.Character = Character;
