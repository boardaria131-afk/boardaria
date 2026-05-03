# D&D 5e Charakterbogen Web-App

Vollständig offline-fähige Web-App für D&D 5th Edition Charakterbögen.
Daten-getrieben, modular, erweiterbar – bereit für APK-Verpackung.

---

## Projektstruktur

```
dnd-app/
├── index.html              # Haupt-HTML (alle Tabs)
├── manifest.json           # PWA-Manifest
├── css/
│   └── main.css            # Gesamtes Styling (Dark Fantasy)
├── js/
│   ├── data.js             # Zentrales Datenmodul (lädt JSONs)
│   ├── character.js        # Charakter-Datenmodell & LocalStorage
│   ├── classes.js          # Klassen/Subklassen-UI
│   ├── spells.js           # Spells-UI
│   ├── items.js            # Items-UI
│   ├── dice.js             # Würfelsystem
│   └── app.js              # Bootstrap, Tabs, Modal, Toast
├── data/
│   ├── classes.json        # 12 Klassen + Subklassen (SRD)
│   ├── spells.json         # 23 SRD-Spells (Level 0–9)
│   └── items.json          # 20 SRD-Items (Waffen, Rüstungen, Tränke)
└── icons/                  # PWA-Icons (192x192, 512x512)
```

---

## Features

### Charakter-Tab
- Name, Rasse, Hintergrund, Level, EP
- HP (aktuell/max), Rüstungsklasse
- Alle 6 Attribute mit automatischen Modifikatoren
- Rettungswürfe (mit Proficiency-Checkbox)
- Alle 18 Fertigkeiten (mit Proficiency)
- Übersicht: bekannte Spells & Inventar
- Notizen

### Klassen-Tab
- Alle 12 Standard-5e-Klassen
- Hit Dice, Primärattribute, Klassenmerkmale
- Subklassen (dynamisch je Klasse)
- Klasse am Charakter setzen

### Spells-Tab
- 23+ SRD-Spells (Level 0–9)
- Suche + Filter nach Level & Schule
- Detailansicht: Wirkzeit, Reichweite, Dauer, Komponenten
- Spell zum Charakter hinzufügen/entfernen

### Items-Tab
- 20+ SRD-Items (Waffen, Rüstungen, Tränke, Wundergegenstände)
- Suche + Filter nach Typ
- Seltenheits-Farbkodierung
- Zum Inventar hinzufügen/entfernen

### Würfel-Tab
- Standard-Würfel: d4, d6, d8, d10, d12, d20, d100
- Eigene Formel: XdY+Z
- Kritischer Treffer / Patzer farbkodiert
- Würfelverlauf (letzte 30 Würfe)
- Attributswurf: 4d6, niedrigste streichen × 6

### Datenverwaltung
- Auto-Speicherung in LocalStorage
- JSON-Export / JSON-Import
- Optional: Live-Import von dnd5eapi.co

---

## Datenmodell

### Character
```json
{
  "name": "Aragorn",
  "race": "Mensch",
  "background": "Adliger",
  "level": 5,
  "xp": 6500,
  "classId": "ranger",
  "subclassId": "hunter",
  "hp_current": 45,
  "hp_max": 50,
  "ac": 16,
  "abilities": { "str": 16, "dex": 14, "con": 14, "int": 12, "wis": 14, "cha": 14 },
  "proficiencies": {
    "saving_throws": ["str", "dex"],
    "skills": ["athletics", "stealth", "survival", "perception"]
  },
  "spellIds": ["cure_wounds", "misty_step"],
  "itemIds": ["longsword", "shield", "potion_healing"],
  "notes": "Thronerbe von Gondor"
}
```

### Class (classes.json)
```json
{
  "id": "wizard",
  "name": "Wizard",
  "icon": "📚",
  "hit_dice": "d6",
  "primary_abilities": ["INT"],
  "saving_throws": ["int", "wis"],
  "description": "...",
  "features": ["Spellcasting", "Arcane Recovery"],
  "subclasses": [
    {
      "id": "evocation",
      "name": "School of Evocation",
      "description": "...",
      "features": ["Evocation Savant", "Sculpt Spells"]
    }
  ]
}
```

### Spell (spells.json)
```json
{
  "id": "fireball",
  "name": "Fireball",
  "level": 3,
  "school": "Evocation",
  "casting_time": "1 action",
  "range": "150 feet",
  "components": ["V", "S", "M"],
  "duration": "Instantaneous",
  "classes": ["sorcerer", "wizard"],
  "description": "..."
}
```

### Item (items.json)
```json
{
  "id": "longsword",
  "name": "Longsword",
  "type": "Weapon",
  "rarity": "Common",
  "weight": "3 lb.",
  "cost": "15 gp",
  "damage": "1d8 slashing",
  "properties": ["Versatile (1d10)"],
  "description": "..."
}
```

---

## Lokal starten

### Option A: Python (empfohlen, kein Setup)
```bash
cd dnd-app
python3 -m http.server 8080
# Browser: http://localhost:8080
```

### Option B: Node.js
```bash
npx serve dnd-app
```

### Option C: VS Code Live Server
Rechtsklick auf index.html → "Open with Live Server"

> ⚠️ **Wichtig:** Direkt `index.html` im Browser öffnen (`file://`) funktioniert
> aufgrund von CORS-Restriktionen beim JSON-Laden **nicht**. Immer einen
> lokalen Server verwenden.

---

## Als APK verpacken

### Methode 1: Capacitor (empfohlen)

```bash
# Voraussetzungen: Node.js, Android Studio, Java 17+

# 1. Capacitor installieren
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Initialisieren
npx cap init "DnD Charakterbogen" "de.dnd.charakterbogen" --web-dir .

# 3. Android-Plattform hinzufügen
npx cap add android

# 4. Sync
npx cap sync android

# 5. APK bauen
npx cap open android
# → In Android Studio: Build → Generate Signed Bundle / APK

# Für Debug-APK direkt:
cd android && ./gradlew assembleDebug
# APK liegt in: android/app/build/outputs/apk/debug/app-debug.apk
```

### Methode 2: PWABuilder (einfachste)

1. App lokal starten & im Browser öffnen
2. https://www.pwabuilder.com aufrufen
3. URL eingeben (ngrok oder lokaler Tunnel)
4. "Android" → APK generieren

### Methode 3: Bubblewrap (Google Trusted Web Activity)

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://deine-url.de/manifest.json
bubblewrap build
```

---

## Homebrew-Inhalte hinzufügen

Erstelle eine eigene JSON-Datei (z.B. `data/homebrew.json`):

```json
{
  "classes": [
    {
      "id": "artificer",
      "name": "Artificer",
      "icon": "⚙️",
      "hit_dice": "d8",
      "primary_abilities": ["INT"],
      "saving_throws": ["con", "int"],
      "description": "Master of artifice and magical invention.",
      "features": ["Magical Tinkering", "Infuse Item"],
      "subclasses": [
        {
          "id": "alchemist",
          "name": "Alchemist",
          "description": "An Alchemist is an expert at combining reagents.",
          "features": ["Experimental Elixir", "Alchemical Savant"]
        }
      ]
    }
  ],
  "spells": [],
  "items": []
}
```

Dann im Browser (Console):
```javascript
fetch('data/homebrew.json')
  .then(r => r.json())
  .then(data => {
    DnDData.importExternal(data);
    ClassesUI.init();
  });
```

Oder per UI: "🌐 Import"-Button → JSON einfügen.

---

## Rechtlicher Hinweis

Diese App verwendet ausschließlich Daten aus dem **System Reference Document (SRD) 5.1**,
das unter der [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/)
veröffentlicht wurde. Alle Texte sind paraphrasiert oder eigenständig formuliert.

Keine urheberrechtlich geschützten Inhalte (z.B. aus dem Player's Handbook) sind enthalten.

---

## Erweiterungen (Roadmap)

- [ ] Service Worker für echte Offline-Nutzung
- [ ] Mehrere Charaktere verwalten
- [ ] Conditions & Status-Effekte
- [ ] Initiative-Tracker
- [ ] Encounter-Builder
- [ ] QR-Code Charakter-Sharing
