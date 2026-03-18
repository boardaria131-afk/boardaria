# HexForge Multiplayer — Übergabe-Dokument
**Stand: 2026-03-18 | Version: 5.33.0**

---

## Was ist HexForge?

Ein browserbasiertes Multiplayer-Kartenspiel, das Faeria nachempfunden ist. Gespielt wird auf einem Hexagon-Board (37 Zellen, Radius 3). Zwei Spieler platzieren Ländereien, setzen Kreaturen und Strukturen ein, nutzen Events und versuchen die gegnerische Basis (20 LP) auf 0 zu bringen. Live deployed auf **boardaria-1.onrender.com** (Render free tier).

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Server | Node.js, Express, Socket.IO |
| Datenbank | PostgreSQL (Render), in-memory Fallback |
| Auth | JWT (HS256, 30 Tage), bcrypt |
| Client | Vanilla JS, SVG Board, Single-Page |
| Deploy | Render (Web Service + PostgreSQL) |

## Dateistruktur

```
hexforge-fixed/
├── client/public/
│   ├── index.html          ← Komplettes Spiel + Lobby (eine Datei, ~13.000 Zeilen)
│   ├── deckbuilder.html    ← Deck-Editor
│   └── leaderboard.html    ← Rangliste
├── server/
│   ├── index.js            ← Express + Socket.IO Hauptserver
│   ├── auth/auth.js        ← JWT Auth (async, injectable store)
│   ├── engine/
│   │   ├── game-engine.js  ← Spiellogik + 490 Karten (Hauptdatei ~7.000 Zeilen)
│   │   ├── action-handler.js
│   │   ├── action-validator.js
│   │   └── engine-test.js  ← 53 Tests (node server/engine/engine-test.js)
│   ├── bot/bot-player.js   ← KI-Bot (v2, path-scoring)
│   ├── db/
│   │   ├── queries.js      ← PostgreSQL Queries + migrate()
│   │   └── adapter.js      ← DB-Adapter, ruft migrate() beim Start
│   ├── matchmaking/
│   │   ├── queue.js        ← ELO-Warteschlange
│   │   └── room-manager.js
│   └── rooms/game-room.js
├── shared/protocol.js      ← C2S/S2C/ACTION/PENDING Konstanten
├── database/schema.sql     ← Schema (wird auch per migrate() angelegt)
└── scripts/verify.js       ← Pre-build Check (40 Prüfungen)
```

## Build & Deploy

```bash
# Tests ausführen
node server/engine/engine-test.js        # 53 Tests

# Alle Fixes verifizieren (vor jedem ZIP!)
node scripts/verify.js                   # 40 Checks

# ZIP bauen
cd /home/claude && zip -r hexforge-mp-vX_Y.zip hexforge-fixed/ -x "*/node_modules/*" -q

# Render: ZIP hochladen über Dashboard → Deploy
# Env-Vars: DATABASE_URL, USE_DB=true, JWT_SECRET, NODE_ENV=production, PORT=3000
```

---

## Was seit Projektstart geändert wurde

### Session 1 (v5.2–v5.6) — Engine-Overhaul & Auth
- Socket.IO Verbindungsaufbau repariert (async socket.io.js laden)
- Login/Register komplett neu mit bcrypt + JWT
- Splash-Screen statt schwarzem Bildschirm beim Laden
- 53 Engine-Tests geschrieben und zum Laufen gebracht
- Zahlreiche Karteneffekte repariert (Production, onDeath, etc.)

### Session 2 (v5.6–v5.19) — Gameplay & UI
- Board-Perspektive geflippt: Spieler A sieht seine Basis unten (`_flipped()`)
- 10 falsche Land-Requirements korrigiert (mystic_beast, auroras_creation, etc.)
- `PENDING.GIFT` und `PENDING.DASH` zu `shared/protocol.js` hinzugefügt (alle Gift/Dash-Karten waren kaputt)
- Activate-Strukturen (Sunken Tower etc.) repariert — `onGift` Check war falsch
- `TARGET_NO_TARGET` auf 56 Karten erweitert
- Bug Reporter (Float-Button im Spiel)
- Resign-Button
- Dev Mode (5× auf "LOBBY" klicken, lokales Testspiel)
- Bot AI v2 (path-scoring, sinnvollere Land-Platzierung)
- Schwarzer Bildschirm beim Reload gefixt
- `doCleanup()` cleared jetzt `pendingGift` auf allen Einheiten

### Session 3 (v5.20–v5.33) — Multiplayer-Bugs & Features

**Board verschwindet (mehrfach repariert):**
- v5.21: Optimistisches `endTurn` triggerte async `_runPhase/_auto` Kette → Board verschwand. Fix: `endTurn` in MP macht nur `_clr() + _render() + sendAction()`, kein `orig()`
- v5.28: Render-Reconnect → `AUTH_OK` → `showLobby()` → `main` auf `display:none`. Fix: `showLobby()` nur wenn kein aktives Spiel (`window.G && matchId`)
- v5.33: Theme-Update machte Board unsichtbar (Schwarz auf Schwarz). Fix: `#bw` Background `#111`, Zellen `#1a1a1a`

**Auth-Bugs (v5.23/v5.26):**
- `authFromToken()` war async geworden aber beide Aufrufer hatten kein `await` → jeder request wurde als authentifiziert behandelt, User war `undefined`
- Fix: `await authFromToken()` in `requireAuth` Middleware + `AUTH_TOKEN` Socket-Handler
- `requireAuth` als `async function`

**Deck-System (v5.24–v5.31):**
- 10 Hub-Decks in Client eingebettet (`HUB_DECKS_CLIENT`) — für alle Spieler verfügbar
- Deck-Selector zeigt "📚 Hub Decks" und "🗂 Meine Decks" als Optgruppen
- Löschen-Button (nur für eigene Decks)
- API-first: eingeloggte Nutzer speichern Decks in PostgreSQL, Gäste in localStorage
- `_getSelectedDeck()` überall konsistent genutzt (auch in mpPlayVsBot, mpCreateRoom etc.)
- Deckbuilder: PUT für Updates, POST für neue Decks, Server-Error Logging
- Gast-Tokens werden nicht mehr automatisch wiederhergestellt

**DB-Auto-Migration (v5.31):**
- `migrate()` Funktion in `server/db/queries.js` — erstellt alle 3 Tabellen mit `IF NOT EXISTS`
- Wird automatisch beim Server-Start aufgerufen → kein manuelles Schema-Setup nötig

**UI-Redesign (v5.32–v5.33):**
- Komplett neues Schwarz-Weiß-Design (war dunkel-blau)
- Fonts: `Bebas Neue` (Headlines), `IBM Plex Mono` (Labels/Code), `IBM Plex Sans` (Body)
- Spieler A = Weiß, Spieler B = Grau auf schwarzem Board
- Alle Glow-Effekte entfernt, harte Kanten, brutalistisch

**Sonstiges:**
- Queue-Retry Timer (alle 4s bei Reconnect)
- Angemeldet-Label in Lobby ("Angemeldet: username · MMR")
- `scripts/verify.js` — 40 Checks vor jedem ZIP-Build
- CARD_DB im Deckbuilder aus Engine generiert (war veraltet mit falschen Requirements)

---

## Bekannte offene Punkte

1. **Optimistisches Rendering bei Discover-Karten** — wenn `orig()` für `PLAY_UNIT` aufgerufen wird und die Karte einen Discover-Effekt hat, erscheint das Discover-Overlay sofort lokal, bevor der Server bestätigt. Selten aber möglich.

2. **Kartenliste im Deckbuilder noch nicht bereinigt** — User wollte die 441 Karten durchschauen und bestimmte entfernen. Karten-Liste wurde als `hexforge-card-list.md` exportiert, aber der Bereinigungsprozess wurde noch nicht abgeschlossen.

3. **Leaderboard-Seite** (`leaderboard.html`) — existiert, wurde in dieser Session nicht überarbeitet.

4. **Mobile Layout** — grundlegend vorhanden, aber nicht intensiv getestet.

5. **Reconnect während Spiel** — der Reconnect-Flow funktioniert (`MATCH_REJOINED`), aber in seltenen Fällen kann der State nicht korrekt wiederhergestellt werden.

---

## Wichtige Code-Stellen

### Engine starten (lokal testen)
```bash
cd hexforge-fixed
npm install
USE_DB=false node server/index.js
# → http://localhost:3000
```

### Karten-Requirements prüfen
```js
const {cardData} = require('./server/engine/game-engine.js');
console.log(cardData('mystic_beast').req); // {lake:2, wild:1}
```

### State-Serialisierung (Server → Client)
`server/rooms/game-room.js → _stateForPlayer()` — gegnerische Karten werden durch `??`-Platzhalter ersetzt, Decks werden ausgeblendet.

### MP-Overrides (Client)
Am Ende von `client/public/index.html` (~Zeile 12.600+) befinden sich alle `Engine.prototype.X = (function(orig) {...})()` Overrides die das Solo-Spiel in den MP-Modus schalten.

### Auth-Flow
1. Client lädt → `socket.on('connect')` → prüft `localStorage.hf_token`
2. Wenn Token vorhanden und kein Gast-Token: `AUTH_TOKEN` senden
3. Server: `await authFromToken(token)` → `AUTH_OK` mit User-Objekt
4. `AUTH_OK` → `showLobby()` (außer aktives Spiel läuft)

---

## Render-Deployment

**Web Service:** `node server/index.js`
**Env-Vars:**
```
DATABASE_URL=postgresql://...
USE_DB=true
JWT_SECRET=<geheim>
NODE_ENV=production
PORT=3000
```
Das erste Deployment erstellt automatisch alle Tabellen (`migrate()` beim Start).

---

## Verify-Script Ausgabe (aktuell)

```
40 passed, 0 failed  ✅ All checks passed
53 engine tests passed ✅
```

Vor jedem neuen ZIP immer `node scripts/verify.js` ausführen. Das Script prüft alle kritischen Fixes und verhindert Regressions.
