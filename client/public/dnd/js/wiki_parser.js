/**
 * wiki_parser.js — Parst kopierten Text von dnd5e.wikidot.com
 * Unterstützt: Klassen, Rassen (automatische Erkennung)
 */

const WikiParser = (() => {

  const ABILITY_MAP = {
    strength:'str', dexterity:'dex', constitution:'con',
    intelligence:'int', wisdom:'wis', charisma:'cha',
  };

  const ICON_MAP = {
    barbarian:'🪓', bard:'🎵', cleric:'✝️', druid:'🌿', fighter:'⚔️',
    monk:'🥋', paladin:'🛡️', ranger:'🏹', rogue:'🗡️',
    sorcerer:'🔮', warlock:'👁️', wizard:'📚',
    human:'👤', elf:'🧝', dwarf:'⛏️', halfling:'🌿',
    dragonborn:'🐉', gnome:'🔬', tiefling:'😈',
    'half-elf':'🌙', 'half-orc':'⚔️', aasimar:'😇', tabaxi:'🐱',
    genasi:'💨', goliath:'🏔️', firbolg:'🌲', kenku:'🦅',
  };

  // ── Hilfs-Funktionen ───────────────────────────────────────────────────

  function slugify(str) {
    return str.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
  }

  function guessIcon(name) {
    const key = name.toLowerCase();
    return Object.entries(ICON_MAP).find(([k]) => key.includes(k))?.[1] || '⚔️';
  }

  function parseSavingThrows(raw) {
    const m = raw.match(/Saving Throws:\s*([^\n]+)/i);
    if (!m) return [];
    return m[1].split(',').map(s => {
      const key = s.trim().toLowerCase();
      return Object.entries(ABILITY_MAP).find(([k]) => key.includes(k))?.[1] ?? null;
    }).filter(Boolean);
  }

  function parseHitDice(raw) {
    const m = raw.match(/Hit Dice:\s*(1d\d+)/i);
    return m ? m[1].replace('1','') : 'd8';
  }

  function parseDescription(lines, name) {
    // Erster längerer Absatz nach dem Namen, vor Tabellen/Headings
    let desc = '';
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.match(/^(Hit Points|Proficiencies|The \w|Level\s+Prof|1st\s+\+|\d+st\s+\+)/i)) break;
      if (l.match(/^(You must have|multiclass|ASI|table)/i)) continue;
      if (l.length > 30) desc += l + ' ';
      if (desc.length > 350) break;
    }
    return desc.trim().slice(0, 400);
  }

  function parseFeaturesFromTable(raw) {
    const featureSet = new Set();
    // Tab-separierte Levelzeilen: "1st\t+2\tFeature A, Feature B\t..."
    const re = /^(\d+(?:st|nd|rd|th))\t\+\d+\t([^\t\n]+)/gm;
    let m;
    while ((m = re.exec(raw)) !== null) {
      m[2].split(',').forEach(f => {
        const feat = f.replace(/\s*\(Optional\)/gi,'').trim();
        if (feat && feat !== '-' && feat !== '–' && feat.length > 2 && !feat.match(/^\d+$/)) {
          featureSet.add(feat);
        }
      });
    }
    // Fallback: Zeilen die mit Großbuchstabe+Text beginnen und nach "Features" kommen
    if (featureSet.size === 0) {
      const re2 = /^(\d+(?:st|nd|rd|th))\s+\+\d+\s+([A-Z][^\n\t]+)/gm;
      while ((m = re2.exec(raw)) !== null) {
        m[2].split(',').forEach(f => {
          const feat = f.replace(/\s*\(Optional\)/gi,'').trim();
          if (feat && feat.length > 2 && !feat.match(/^\d+$/)) featureSet.add(feat);
        });
      }
    }
    return [...featureSet];
  }

  function parseFeatureDescriptions(raw, featureSet) {
    const details = {};
    const featNames = new Set(featureSet);
    // Suche Abschnitte: "FeatureName\n<Beschreibungstext>"
    const lines = raw.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || !featNames.has(line)) continue;
      // Sammle Folgezeilen bis nächste Überschrift
      let desc = '';
      for (let j = i+1; j < lines.length && j < i+8; j++) {
        const next = lines[j].trim();
        if (!next) break;
        if (next.match(/^[A-Z][A-Za-z\s']+$/) && next.length < 50) break; // nächste Überschrift
        desc += next + ' ';
        if (desc.length > 280) break;
      }
      if (desc.length > 20) {
        details[line] = desc.trim().slice(0,280) + (desc.length>280?'…':'');
      }
    }
    return details;
  }

  function parseSubclasses(raw, className) {
    const subclasses = [];
    const seen = new Set();

    // Suche nach Oath/Archetype/etc-Tabelle (Name\tSource-Format)
    const re = /^([A-Z][A-Za-z\s]+)\t(Player's Handbook|Xanathar|Tasha|Sword Coast|Dungeon Master|Mythic|Unearthed)/gm;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const scName = m[1].trim();
      // Überspringe Kopfzeilen der Tabelle
      if (scName.match(/^(Oath|Archetype|Circle|Path|College|School|Domain|Patron|Way|Origin|Subclass|Source)/i)) continue;
      if (seen.has(scName)) continue;
      seen.add(scName);

      // Präfix je nach Klasse
      const prefixMap = {
        paladin: 'Oath of ', cleric: 'Domain', druid: 'Circle of the ',
        fighter: 'Martial Archetype: ', ranger: 'Conclave: ',
        rogue: 'Roguish Archetype: ', wizard: 'School of ',
        sorcerer: 'Origin: ', warlock: 'Patron: ',
        barbarian: 'Path of the ', bard: 'College of ', monk: 'Way of the ',
      };
      const clsKey = className.toLowerCase();
      const prefix = Object.entries(prefixMap).find(([k]) => clsKey.includes(k))?.[1] || '';
      const fullName = prefix ? `${prefix}${scName}` : scName;

      subclasses.push({
        id:          slugify(scName),
        name:        fullName,
        description: `${scName} ${Object.keys(prefixMap).find(k=>clsKey.includes(k))||'subclass'} for ${className}.`,
        features:    [],
      });
    }
    return subclasses;
  }

  // ── Rassen-Parser ────────────────────────────────────────────────────────

  function parseRace(raw, lines) {
    const name = lines[0];
    const id   = slugify(name);

    // Beschreibung
    const desc = parseDescription(lines, name);

    // Speed
    const speedM = raw.match(/speed(?:\s+is)?\s+(\d+)\s*feet/i);
    const speed  = speedM ? parseInt(speedM[1]) : 30;

    // Size
    const sizeM  = raw.match(/\b(Small|Medium|Large)\b/);
    const size   = sizeM ? sizeM[1] : 'Medium';

    // Ability Bonuses
    const ability_bonuses = {};
    const bonusRe = /([A-Z][a-z]+)\s+score\s+increases?\s+by\s+(\d+)/gi;
    let bm;
    while ((bm = bonusRe.exec(raw)) !== null) {
      const ab = ABILITY_MAP[bm[1].toLowerCase()];
      if (ab) ability_bonuses[ab] = parseInt(bm[2]);
    }
    // Fallback: "+2 to Strength" format
    if (Object.keys(ability_bonuses).length === 0) {
      const re2 = /\+(\d+)\s+(?:to\s+)?([A-Z][a-z]+)(?:\s+score)?/gi;
      while ((bm = re2.exec(raw)) !== null) {
        const ab = ABILITY_MAP[bm[2].toLowerCase()];
        if (ab) ability_bonuses[ab] = parseInt(bm[1]);
      }
    }

    // Traits (Zeilen die wie Feature-Überschriften aussehen)
    const traits = [];
    const traitRe = /^([A-Z][A-Za-z\s']+)\.\s/gm;
    let tm;
    while ((tm = traitRe.exec(raw)) !== null) {
      const t = tm[1].trim();
      if (t.length > 3 && t.length < 50 && !t.match(/^(You|As|When|If|The|This|Your)/)) {
        traits.push(t);
      }
    }
    // Fallback: suche "Darkvision. ..." Muster
    if (traits.length === 0) {
      const re2 = /^([A-Z][A-Za-z\s]+)\n[A-Z][a-z]/gm;
      while ((tm = re2.exec(raw)) !== null) {
        const t = tm[1].trim();
        if (t.length > 3 && t.length < 40) traits.push(t);
      }
    }

    // Languages
    const langM = raw.match(/Languages?[:\s]+([^\n.]+)/i);
    const languages = langM
      ? langM[1].split(/,\s*(?:and\s+)?/).map(l=>l.trim()).filter(l=>l.length>1)
      : ['Common'];

    // Unterrassen
    const subraces = [];
    const subRe = /^([\w\s]+)\nAbility Score/gm;
    while ((bm = subRe.exec(raw)) !== null) {
      const subName = bm[1].trim();
      if (subName.length > 2 && subName.length < 40) {
        subraces.push({
          id:              slugify(subName),
          name:            subName,
          ability_bonuses: {},
          traits:          [],
        });
      }
    }

    return { id, name, icon: guessIcon(name), speed, size, ability_bonuses, languages, traits, description: desc, subraces };
  }

  // ── Auto-Detect: Klasse oder Rasse? ─────────────────────────────────────

  function detect(raw) {
    if (raw.match(/Hit Dice:|Hit Points at 1st Level:|Saving Throws:/i)) return 'class';
    if (raw.match(/ability score increases? by|speed.*feet|darkvision|language/i)) return 'race';
    // Fallback: Klasse wenn Leveltabelle vorhanden
    if (raw.match(/1st\s+\+2|2nd\s+\+2/)) return 'class';
    return 'unknown';
  }

  // ── Haupt-Parse-Funktion ────────────────────────────────────────────────

  function parse(raw) {
    const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
    if (lines.length < 3) return { error: 'Text zu kurz' };

    const type = detect(raw);

    if (type === 'race') {
      const result = parseRace(raw, lines);
      return { type: 'race', data: result };
    }

    if (type === 'class') {
      const name         = lines[0];
      const id           = slugify(name);
      const hit_dice     = parseHitDice(raw);
      const saving_throws = parseSavingThrows(raw);
      const description  = parseDescription(lines, name);
      const features     = parseFeaturesFromTable(raw);
      const feature_details = parseFeatureDescriptions(raw, features);
      const subclasses   = parseSubclasses(raw, name);

      // Primary abilities: aus Saving Throws ableiten
      const primaryGuess = saving_throws.length >= 2
        ? saving_throws.map(s=>s.toUpperCase())
        : ['STR','CON'];

      return {
        type: 'class',
        data: {
          id, name,
          icon:             guessIcon(name),
          hit_dice,
          primary_abilities: primaryGuess,
          saving_throws,
          description:       description.slice(0,400),
          features,
          feature_details,
          subclasses,
        }
      };
    }

    return { error: 'Typ nicht erkannt – bitte Klassen- oder Rassen-Text einfügen.' };
  }

  return { parse, detect };
})();

window.WikiParser = WikiParser;
