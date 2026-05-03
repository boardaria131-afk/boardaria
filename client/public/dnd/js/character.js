/**
 * character.js — v2: Multi-Charakter, robustes Laden, Klassen-/Rassen-Properties
 */

const Character = (() => {
  const STORAGE_KEY = 'dnd5e_character_active';
  const ROSTER_KEY  = 'dnd5e_roster';

  function createDefault() {
    return {
      id:           Date.now().toString(36),
      name:         '',
      race:         '',
      raceId:       null,
      subraceId:    null,
      background:   '',
      level:        1,
      xp:           0,
      classId:      null,
      subclassId:   null,
      hp_current:   10,
      hp_max:       10,
      ac:           10,
      speed:        30,
      abilities:    { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
      proficiencies:{ saving_throws:[], skills:[] },
      class_features: [],
      race_traits:    [],
      spellIds: [],
      itemIds:  [],
      notes:    '',
      created:  new Date().toISOString(),
    };
  }

  let _char = createDefault();

  /* ── Roster ─────────────────────────────────────────────────────────── */
  function getRoster() {
    try { return JSON.parse(localStorage.getItem(ROSTER_KEY) || '[]'); }
    catch { return []; }
  }

  function saveToRoster() {
    const roster = getRoster().filter(c => c.id !== _char.id);
    roster.unshift({ ..._char });
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
    localStorage.setItem(STORAGE_KEY, _char.id);
  }

  function loadFromRoster(id) {
    const found = getRoster().find(c => c.id === id);
    if (!found) return false;
    _char = { ...createDefault(), ...found };
    localStorage.setItem(STORAGE_KEY, _char.id);
    return true;
  }

  function deleteFromRoster(id) {
    const roster = getRoster().filter(c => c.id !== id);
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
    if (_char.id === id) { _char = createDefault(); localStorage.removeItem(STORAGE_KEY); }
  }

  /* ── Persistenz ─────────────────────────────────────────────────────── */
  function save() {
    try { saveToRoster(); return true; }
    catch(e) { console.error('[Character] Speichern:', e); return false; }
  }

  function load() {
    try {
      const activeId = localStorage.getItem(STORAGE_KEY);
      if (!activeId) return false;
      return loadFromRoster(activeId);
    } catch(e) { return false; }
  }

  function exportJSON() { return JSON.stringify(_char, null, 2); }

  function importJSON(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.id) data.id = Date.now().toString(36);
      _char = { ...createDefault(), ...data };
      saveToRoster();
      return true;
    } catch(e) { return false; }
  }

  function reset() { _char = createDefault(); saveToRoster(); }

  /* ── Berechnungen ───────────────────────────────────────────────────── */
  function getMod(score) { return Math.floor((score - 10) / 2); }
  function getProficiencyBonus() { return Math.ceil(_char.level / 4) + 1; }

  function getSavingThrowBonus(ability) {
    const base = getMod(_char.abilities[ability]);
    const prof = _char.proficiencies.saving_throws.includes(ability) ? getProficiencyBonus() : 0;
    return base + prof;
  }

  const SKILL_MAP = {
    acrobatics:'dex', animal_handling:'wis', arcana:'int', athletics:'str',
    deception:'cha', history:'int', insight:'wis', intimidation:'cha',
    investigation:'int', medicine:'wis', nature:'int', perception:'wis',
    performance:'cha', persuasion:'cha', religion:'int', sleight_of_hand:'dex',
    stealth:'dex', survival:'wis',
  };

  function getSkillBonus(skill) {
    const ability = SKILL_MAP[skill];
    const base    = getMod(_char.abilities[ability]);
    const prof    = _char.proficiencies.skills.includes(skill) ? getProficiencyBonus() : 0;
    return base + prof;
  }

  /* ── Klasse & Rasse anwenden ────────────────────────────────────────── */
  function applyClass(cls, subclassId) {
    const hpMap    = { d6:6, d8:8, d10:10, d12:12 };
    const hpPerDie = hpMap[cls.hit_dice] || 8;
    const conMod   = getMod(_char.abilities.con);
    const newMaxHP = hpPerDie + conMod + (_char.level - 1) * (Math.ceil(hpPerDie/2) + conMod);

    _char.classId    = cls.id;
    _char.subclassId = subclassId || null;
    _char.hp_max     = Math.max(1, newMaxHP);
    _char.hp_current = Math.min(_char.hp_current, _char.hp_max);
    _char.class_features = [...(cls.features || [])];
    _char.proficiencies.saving_throws = [...cls.saving_throws];
    saveToRoster();
  }

  function applyRace(race, subraceId) {
    _char.raceId    = race.id;
    _char.subraceId = subraceId || null;
    _char.race      = race.name;
    _char.speed     = race.speed || 30;
    _char.race_traits = [...(race.traits || [])];

    // Attribut-Boni
    const bonuses = { ...(race.ability_bonuses || {}) };
    if (subraceId) {
      const sub = (race.subraces || []).find(s => s.id === subraceId);
      if (sub?.ability_bonuses) {
        Object.entries(sub.ability_bonuses).forEach(([k,v]) => bonuses[k] = (bonuses[k]||0)+v);
      }
      if (sub?.traits) _char.race_traits = [..._char.race_traits, ...sub.traits];
    }
    Object.entries(bonuses).forEach(([ab, bonus]) => {
      _char.abilities[ab] = Math.min(30, (_char.abilities[ab] || 10) + bonus);
    });
    saveToRoster();
  }

  /* ── Spells & Items ─────────────────────────────────────────────────── */
  function addSpell(id)  { if(!_char.spellIds.includes(id)){ _char.spellIds.push(id); saveToRoster(); return true; } return false; }
  function removeSpell(id){ _char.spellIds=_char.spellIds.filter(s=>s!==id); saveToRoster(); }
  function addItem(id)   { _char.itemIds.push(id); saveToRoster(); return true; }
  function removeItem(id){ const i=_char.itemIds.indexOf(id); if(i>=0)_char.itemIds.splice(i,1); saveToRoster(); }

  /* ── Update ─────────────────────────────────────────────────────────── */
  function update(fields)           { Object.assign(_char, fields); saveToRoster(); }
  function updateAbility(ab, score) { _char.abilities[ab]=parseInt(score)||10; saveToRoster(); }
  function toggleSavingThrow(ab)    { const a=_char.proficiencies.saving_throws,i=a.indexOf(ab); i>=0?a.splice(i,1):a.push(ab); saveToRoster(); }
  function toggleSkill(sk)          { const a=_char.proficiencies.skills,i=a.indexOf(sk); i>=0?a.splice(i,1):a.push(sk); saveToRoster(); }

  return {
    get data()   { return _char; },
    get roster() { return getRoster(); },
    save, load, exportJSON, importJSON, reset,
    loadFromRoster, deleteFromRoster,
    getMod, getProficiencyBonus, getSavingThrowBonus, getSkillBonus,
    applyClass, applyRace, SKILL_MAP,
    addSpell, removeSpell, addItem, removeItem,
    update, updateAbility, toggleSavingThrow, toggleSkill,
  };
})();

window.Character = Character;
