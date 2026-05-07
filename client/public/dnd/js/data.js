/**
 * data.js — v2: lädt Klassen, Spells, Items UND Rassen
 */

const DnDData = (() => {
  let _classes = [];
  let _spells  = [];
  let _items   = [];
  let _races   = [];
  let _feats   = [];
  let _backgrounds = [];
  let _spellSlots  = {};
  let _rulesets    = [];

  async function loadJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`Fehler beim Laden: ${path}`);
    return resp.json();
  }

  async function init() {
    try {
      const [classData, spellData, itemData, raceData, featData, bgData, slotData, rulesetData] = await Promise.all([
        loadJSON('data/classes.json'),
        loadJSON('data/spells.json'),
        loadJSON('data/items.json'),
        loadJSON('data/races.json'),
        loadJSON('data/feats.json'),
        loadJSON('data/backgrounds.json'),
        loadJSON('data/spell_slots.json'),
        loadJSON('data/rulesets.json'),
      ]);
      _classes = classData.classes || [];
      _spells  = spellData.spells  || [];
      _items   = itemData.items    || [];
      _races   = raceData.races    || [];
      _feats       = featData.feats       || [];
      _backgrounds = bgData.backgrounds  || [];
      _spellSlots  = slotData || {};
      _rulesets    = rulesetData.rulesets || [];
      console.log(`[DnDData] ${_classes.length} Klassen, ${_races.length} Rassen, ${_spells.length} Spells, ${_items.length} Items, ${_feats.length} Feats, ${_backgrounds.length} Hintergründe`);
    } catch (err) {
      console.error('[DnDData] Ladefehler:', err);
    }
  }

  function importExternal(json) {
    let count = 0;
    const merge = (arr, list, key='id') => {
      (list||[]).forEach(item => {
        item._custom = true; // Markierung: manuell importiert → löschbar
        const idx = arr.findIndex(x => x[key] === item[key]);
        idx >= 0 ? arr[idx] = item : arr.push(item);
        count++;
      });
    };
    merge(_classes, json.classes);
    merge(_spells,  json.spells);
    merge(_items,   json.items);
    merge(_races,   json.races);
    merge(_feats,   json.feats);
    console.log(`[DnDData] ${count} externe Einträge importiert`);
    return count;
  }

  function deleteEntry(type, id) {
    const map = { class: _classes, spell: _spells, item: _items, race: _races, feat: _feats };
    const arr = map[type];
    if (!arr) return false;
    const idx = arr.findIndex(x => x.id === id);
    if (idx < 0) return false;
    arr.splice(idx, 1);
    console.log(`[DnDData] ${type} "${id}" gelöscht`);
    return true;
  }

  function normalizeApiSpell(s) {
    return {
      id:           s.index,
      name:         s.name,
      level:        s.level,
      school:       s.school?.name || 'Unknown',
      casting_time: s.casting_time || '1 action',
      range:        s.range || 'Self',
      components:   s.components || [],
      duration:     s.duration || 'Instantaneous',
      classes:      (s.classes||[]).map(c => c.index),
      description:  (s.desc||[]).join('\n'),
    };
  }

  return {
    init, importExternal, normalizeApiSpell, deleteEntry,
    get classes() { return _classes; },
    get spells()  { return _spells;  },
    get items()   { return _items;   },
    get races()   { return _races;   },
    get feats()        { return _feats;       },
    get backgrounds()  { return _backgrounds; },
    get spellSlots()   { return _spellSlots;  },
    get rulesets()     { return _rulesets;    },
    getClassById: id => _classes.find(c => c.id === id),
    getSpellById: id => _spells.find(s  => s.id === id),
    getItemById:  id => _items.find(i   => i.id === id),
    getRaceById:  id => _races.find(r   => r.id === id),
    getFeatById:       id => _feats.find(f => f.id === id),
    getBackgroundById: id => _backgrounds.find(b => b.id === id),
    getRulesetById:    id => _rulesets.find(r => r.id === id),
  };
})();

window.DnDData = DnDData;
