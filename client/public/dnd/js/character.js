/**
 * character.js — v2: Multi-Charakter, robustes Laden, Klassen-/Rassen-Properties
 */

const Character = (() => {
  // Keys sind an die User-ID gebunden → jeder Spieler hat eigene Charaktere
  // uid wird gecacht damit er sich nach Login nicht ändert
  let _cachedUid = null;

  function _uid() {
    if (_cachedUid) return _cachedUid;
    const u = window.Auth ? window.Auth.getUser() : null;
    if (u) {
      _cachedUid = u.isGuest ? 'guest_' + u.id : 'u_' + u.id;
      return _cachedUid;
    }
    return 'local'; // noch kein Login — temporär
  }

  // Wird von Auth nach erfolgreichem Login aufgerufen
  function setUserContext(user) {
    if (!user || !user.id) {
      _cachedUid = null; // Reset bei Logout
      return;
    }
    _cachedUid = user.isGuest ? 'guest_' + user.id : 'u_' + user.id;
    console.log('[Character] User-Kontext:', _cachedUid);

    // Migration: alte 'local' Chars in user-spezifischen Key verschieben
    try {
      const localRoster = JSON.parse(localStorage.getItem('dnd5e_roster_local') || '[]');
      const localActive = localStorage.getItem('dnd5e_active_local');
      if (localRoster.length > 0) {
        const userRoster = JSON.parse(localStorage.getItem(ROSTER_KEY()) || '[]');
        const userIds = new Set(userRoster.map(c => c.id));
        localRoster.forEach(c => { if (!userIds.has(c.id)) userRoster.push(c); });
        localStorage.setItem(ROSTER_KEY(), JSON.stringify(userRoster));
        if (localActive && !localStorage.getItem(STORAGE_KEY())) {
          localStorage.setItem(STORAGE_KEY(), localActive);
        }
        // Alte 'local' Keys löschen
        localStorage.removeItem('dnd5e_roster_local');
        localStorage.removeItem('dnd5e_active_local');
        console.log('[Character] Lokale Chars migriert:', localRoster.length);
      }
    } catch(e) { console.warn('[Character] Migration fehlgeschlagen:', e.message); }
  }

  const STORAGE_KEY = () => 'dnd5e_active_' + _uid();
  const ROSTER_KEY  = () => 'dnd5e_roster_' + _uid();

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
      spellIds:         [],
      preparedSpellIds: [],
      itemIds:          [],
      notes:     '',
      rulesetId: '5e',
      created:   new Date().toISOString(),
    };
  }

  let _char = createDefault();

  /* ── Roster ─────────────────────────────────────────────────────────── */
  function getRoster() {
    try { return JSON.parse(localStorage.getItem(ROSTER_KEY()) || '[]'); }
    catch { return []; }
  }

  function saveToRoster() {
    const roster = getRoster().filter(c => c.id !== _char.id);
    roster.unshift({ ..._char });
    localStorage.setItem(ROSTER_KEY(), JSON.stringify(roster));
    localStorage.setItem(STORAGE_KEY(), _char.id);
    // Server-Sync (non-blocking, nach kurzem Delay damit Auth fertig ist)
    setTimeout(() => syncToServer().catch(() => {}), 500);
  }

  function loadFromRoster(id) {
    const found = getRoster().find(c => c.id === id);
    if (!found) return false;
    _char = { ...createDefault(), ...found };
    localStorage.setItem(STORAGE_KEY(), _char.id);
    return true;
  }

  function deleteFromRoster(id) {
    const roster = getRoster().filter(c => c.id !== id);
    localStorage.setItem(ROSTER_KEY(), JSON.stringify(roster));
    if (_char.id === id) { _char = createDefault(); localStorage.removeItem(STORAGE_KEY()); }
  }

  /* ── Persistenz ─────────────────────────────────────────────────────── */
  function save() {
    try { saveToRoster(); return true; }
    catch(e) { console.error('[Character] Speichern:', e); return false; }
  }

  function load() {
    try {
      const activeId = localStorage.getItem(STORAGE_KEY());
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

  // ── Server-Sync ──────────────────────────────────────────────────────────────
  async function syncToServer() {
    const token = window.Auth?.getToken();
    if (!token || _char.id?.startsWith('guest')) return false;
    try {
      const resp = await fetch('/api/dnd/characters', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body:    JSON.stringify(_char),
      });
      return resp.ok;
    } catch { return false; }
  }

  async function loadFromServer() {
    const auth = window.Auth;
    const token = auth ? auth.getToken() : null;
    if (!token) {
      console.log('[Char] loadFromServer: kein Token');
      return [];
    }
    try {
      const resp = await fetch('/api/dnd/characters', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!resp.ok) {
        console.warn('[Char] loadFromServer fehlgeschlagen:', resp.status);
        return [];
      }
      const data = await resp.json();
      const chars = data.characters || [];
      console.log('[Char] Server: ' + chars.length + ' Charaktere geladen');

      // Merge: Server-Chars in lokalen Roster einpflegen (Server hat Vorrang)
      if (chars.length > 0) {
        const roster = getRoster();
        const localIds = new Set(roster.map(c => c.id));
        let added = 0;
        chars.forEach(serverChar => {
          const localIdx = roster.findIndex(c => c.id === serverChar.id);
          if (localIdx >= 0) {
            // Server-Version ist neuer? Überschreiben
            const serverTime = new Date(serverChar._updatedAt || 0).getTime();
            const localTime  = new Date(roster[localIdx]._updatedAt || 0).getTime();
            if (serverTime > localTime) {
              roster[localIdx] = serverChar;
              added++;
            }
          } else {
            roster.unshift(serverChar);
            added++;
          }
        });
        if (added > 0) {
          localStorage.setItem(ROSTER_KEY(), JSON.stringify(roster));
          console.log('[Char] ' + added + ' Charaktere vom Server in localStorage gemergt');
        }
      }
      return chars;
    } catch(e) {
      console.warn('[Char] loadFromServer Fehler:', e.message);
      return [];
    }
  }

  async function deleteFromServer(id) {
    const token = window.Auth?.getToken();
    if (!token) return;
    try {
      await fetch('/api/dnd/characters/' + id, {
        method:  'DELETE',
        headers: { 'Authorization': 'Bearer ' + token },
      });
    } catch {}
  }

  async function shareToServer(char) {
    const token = window.Auth?.getToken();
    if (!token) return false;
    try {
      const resp = await fetch('/api/dnd/shared', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body:    JSON.stringify(char),
      });
      return resp.ok;
    } catch { return false; }
  }

  async function unshareFromServer(id) {
    const token = window.Auth?.getToken();
    if (!token) return;
    try {
      await fetch('/api/dnd/shared/' + id, {
        method:  'DELETE',
        headers: { 'Authorization': 'Bearer ' + token },
      });
    } catch {}
  }

  async function getSharedFromServer() {
    const token = window.Auth?.getToken();
    if (!token) return [];
    try {
      const resp = await fetch('/api/dnd/shared', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.characters || [];
    } catch { return []; }
  }

  return {
    get data()   { return _char; },
    get roster() { return getRoster(); },
    getProficiencyBonus: () => Math.ceil((parseInt(Character.data.level)||1)/4)+1,
    getMod: score => Math.floor(((score||10)-10)/2),
    save, load, exportJSON, importJSON, reset, setUserContext,
    loadFromRoster, deleteFromRoster,
    syncToServer, loadFromServer, deleteFromServer,
    shareToServer, unshareFromServer, getSharedFromServer,
    getMod, getProficiencyBonus, getSavingThrowBonus, getSkillBonus,
    applyClass, applyRace, SKILL_MAP,
    addSpell, removeSpell, addItem, removeItem,
    update, updateAbility, toggleSavingThrow, toggleSkill,
  };
})();

window.Character = Character;

// ── Teilen-Funktion ───────────────────────────────────────────────────────────
// Geteilte Charaktere: öffentlich lesbar für alle Spieler der Kampagne

const SHARED_KEY = 'dnd5e_shared_chars'; // alle geteilten Charaktere aller User

Character.share = function() {
  const char = { ..._char, _sharedBy: _char.name, _sharedAt: new Date().toISOString() };
  const user = window.Auth ? window.Auth.getUser() : null;
  char._ownerName = user ? user.username : 'Unbekannt';
  char._ownerId   = user ? user.id : null;

  try {
    const existing = JSON.parse(localStorage.getItem(SHARED_KEY) || '[]');
    // Alten Eintrag dieses Charakters ersetzen
    const filtered = existing.filter(c => c.id !== char.id);
    filtered.unshift(char);
    // Max 50 geteilte Charaktere speichern
    localStorage.setItem(SHARED_KEY, JSON.stringify(filtered.slice(0, 50)));
    return true;
  } catch(e) {
    console.error('[Character] Teilen fehlgeschlagen:', e);
    return false;
  }
};

Character.unshare = function() {
  try {
    const existing = JSON.parse(localStorage.getItem(SHARED_KEY) || '[]');
    localStorage.setItem(SHARED_KEY, JSON.stringify(existing.filter(c => c.id !== _char.id)));
    return true;
  } catch { return false; }
};

Character.isShared = function() {
  try {
    const existing = JSON.parse(localStorage.getItem(SHARED_KEY) || '[]');
    return existing.some(c => c.id === _char.id);
  } catch { return false; }
};

Character.getSharedChars = function() {
  try {
    return JSON.parse(localStorage.getItem(SHARED_KEY) || '[]');
  } catch { return []; }
};

Character.loadShared = function(charId) {
  const chars = Character.getSharedChars();
  return chars.find(c => c.id === charId) || null;
};
