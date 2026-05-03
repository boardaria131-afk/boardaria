/**
 * data.js — Zentrales Daten-Modul
 * Lädt alle JSON-Daten und stellt sie global bereit.
 * Kompatibel mit dnd5eapi Datenstruktur.
 */

const DnDData = (() => {
  let _classes = [];
  let _spells  = [];
  let _items   = [];

  /**
   * Lädt eine lokale JSON-Datei.
   * @param {string} path  Pfad zur Datei
   * @returns {Promise<Object>}
   */
  async function loadJSON(path) {
    const resp = await fetch(path);
    if (!resp.ok) throw new Error(`Fehler beim Laden: ${path}`);
    return resp.json();
  }

  /**
   * Initialisiert alle Daten. Zuerst lokal, dann optional API.
   */
  async function init() {
    try {
      const [classData, spellData, itemData] = await Promise.all([
        loadJSON('data/classes.json'),
        loadJSON('data/spells.json'),
        loadJSON('data/items.json'),
      ]);
      _classes = classData.classes || [];
      _spells  = spellData.spells  || [];
      _items   = itemData.items    || [];
      console.log(`[DnDData] Geladen: ${_classes.length} Klassen, ${_spells.length} Spells, ${_items.length} Items`);
    } catch (err) {
      console.error('[DnDData] Fehler beim Laden der lokalen Daten:', err);
    }
  }

  /**
   * Importiert externe JSON-Daten (Homebrew / API).
   * Merge-Strategie: vorhandene IDs werden überschrieben.
   * @param {Object} json  Rohdaten { classes?, spells?, items? }
   */
  function importExternal(json) {
    let count = 0;
    if (json.classes) {
      json.classes.forEach(c => {
        const idx = _classes.findIndex(x => x.id === c.id);
        if (idx >= 0) _classes[idx] = c; else _classes.push(c);
        count++;
      });
    }
    if (json.spells) {
      json.spells.forEach(s => {
        const idx = _spells.findIndex(x => x.id === s.id);
        if (idx >= 0) _spells[idx] = s; else _spells.push(s);
        count++;
      });
    }
    if (json.items) {
      json.items.forEach(i => {
        const idx = _items.findIndex(x => x.id === i.id);
        if (idx >= 0) _items[idx] = i; else _items.push(i);
        count++;
      });
    }
    console.log(`[DnDData] ${count} externe Einträge importiert`);
    return count;
  }

  /**
   * Konvertiert dnd5eapi Antwort in internes Format.
   * https://www.dnd5eapi.co/api
   */
  function normalizeApiSpell(apiSpell) {
    return {
      id: apiSpell.index,
      name: apiSpell.name,
      level: apiSpell.level,
      school: apiSpell.school?.name || 'Unknown',
      casting_time: apiSpell.casting_time || '1 action',
      range: apiSpell.range || 'Self',
      components: apiSpell.components || [],
      duration: apiSpell.duration || 'Instantaneous',
      classes: (apiSpell.classes || []).map(c => c.index),
      description: (apiSpell.desc || []).join('\n'),
    };
  }

  return {
    init,
    importExternal,
    normalizeApiSpell,
    get classes() { return _classes; },
    get spells()  { return _spells; },
    get items()   { return _items; },
    getClassById(id) { return _classes.find(c => c.id === id); },
    getSpellById(id) { return _spells.find(s => s.id === id); },
    getItemById(id)  { return _items.find(i => i.id === id); },
  };
})();

window.DnDData = DnDData;
