# HexForge Multiplayer — Architekturplan

## Analyseergebnisse

### Game Engine (engine_raw.js — 345 KB, pure logic)
- **Vollständig DOM-frei** — kann direkt auf dem Server laufen
- 60 reine Funktionen, 18 Konstanten
- Zentraler GameState (`S`) als einfaches JS-Objekt
- Alle Aktionen gehen durch: `doPlay`, `doAtk`, `doGift`, `doMulligan`, `doCleanup`

### UI (ui_raw.js — 115 KB, DOM-abhängig)
- `class Engine` mit DOM-Rendering
- `clickCell()` → übersetzt UI-Klicks in Engine-Aufrufe
- Muss vollständig ersetzt/neu gebaut werden für den Client

### Action-Typen (aus clickCell extrahiert)
```
MULLIGAN         → doMulligan(S, player, selectedCards)
PLACE_LAND       → S.cells[key] = { type:'LAND', ... }
PLACE_UNIT       → doPlay(S, player, cardId, q, r, s)
PLAY_INSTANT     → doPlay(S, player, cardId, q, r, s)
MOVE_UNIT        → unit.q=q; unit.r=r; harvestMana()
ATTACK_UNIT      → doAtk(S, unitId, 'unit', targetId)
ATTACK_BASE      → doAtk(S, unitId, 'base', player)
USE_GIFT         → doGift / resolvePendingGift
HARVEST          → harvestMana(S, player)
END_TURN         → phase → CLEANUP → DRAW
BOOST_MANA       → S.players[p].boostUsed=true; S.players[p].mana+=3
DISCOVER_PICK    → _discoverQueue resolution
CHOOSE_ONE       → _pendingChoice resolution
SHIFTING_TIDE    → land move sequence
```

---

## Projektstruktur

```
hexforge-mp/
├── server/
│   ├── engine/
│   │   ├── game-engine.js      ← engine_raw.js als CommonJS-Modul
│   │   ├── action-validator.js ← validateAction(S, action, player)
│   │   └── action-handler.js   ← applyAction(S, action) → newState
│   ├── matchmaking/
│   │   ├── queue.js            ← ELO-basiertes Matchmaking
│   │   └── room-manager.js     ← Raum-Erstellung & Verwaltung
│   ├── rooms/
│   │   └── game-room.js        ← Einzelnes Match, State + WebSocket
│   ├── ladder/
│   │   └── elo.js              ← ELO-Berechnung + Leaderboard
│   ├── auth/
│   │   ├── jwt.js              ← Token-Generierung & Validierung
│   │   └── guest.js            ← Gast-Session-System
│   ├── db/
│   │   ├── schema.sql          ← PostgreSQL-Schema
│   │   └── queries.js          ← DB-Abfragen
│   └── index.js                ← Express + Socket.IO Server
├── client/
│   ├── index.html              ← Single Page App Shell
│   ├── game.js                 ← Spielfeld-Rendering (portiert aus ui_raw.js)
│   ├── lobby.js                ← Lobby, Matchmaking UI
│   └── socket-client.js        ← WebSocket-Kommunikation
├── shared/
│   ├── protocol.js             ← Event-Namen & Payload-Typen
│   └── constants.js            ← Geteilte Konstanten
└── package.json
```

---

## WebSocket-Protokoll

### Client → Server
| Event | Payload | Beschreibung |
|-------|---------|--------------|
| `auth` | `{ token }` | JWT-Authentifizierung |
| `queue_join` | `{ deckId }` | Ranked-Queue betreten |
| `queue_leave` | — | Queue verlassen |
| `room_create` | `{ deckId }` | Privaten Raum erstellen |
| `room_join` | `{ code, deckId }` | Raum beitreten |
| `player_action` | `{ type, payload }` | Spielzug ausführen |
| `spectate` | `{ matchId }` | Match zuschauen |

### Server → Client
| Event | Payload | Beschreibung |
|-------|---------|--------------|
| `auth_ok` | `{ user }` | Login erfolgreich |
| `match_found` | `{ matchId, opponent }` | Match gefunden |
| `game_start` | `{ state, yourPlayer }` | Spiel beginnt |
| `state_update` | `{ state, lastAction }` | Neuer Zustand |
| `action_invalid` | `{ reason }` | Ungültige Aktion |
| `game_over` | `{ winner, eloChange }` | Spiel beendet |
| `room_created` | `{ code }` | Raum-Code |

---

## Datenbank-Schema

```sql
-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rating INTEGER DEFAULT 1000,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Matches (für Replays + Leaderboard)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a INTEGER REFERENCES users(id),
  player_b INTEGER REFERENCES users(id),
  winner CHAR(1),
  rating_change_a INTEGER,
  rating_change_b INTEGER,
  deck_a JSONB,
  deck_b JSONB,
  actions JSONB,  -- kompletter Action-Log
  initial_state JSONB,
  duration_seconds INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Decks
CREATE TABLE decks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(64),
  cards JSONB,
  archetype VARCHAR(32),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## ELO-Formel
```
K = 32
expectedA = 1 / (1 + 10^((ratingB - ratingA) / 400))
newRatingA = ratingA + K * (score - expectedA)
score = 1 (win), 0 (loss)
```

---

## Implementierungsreihenfolge

1. **[HEUTE] Engine-Extraktion** — engine_raw.js → CommonJS-Modul
2. **[HEUTE] Action-Validator** — Server-seitige Validierung aller Aktionen
3. **[HEUTE] WebSocket-Server** — Express + Socket.IO Grundgerüst
4. **[HEUTE] Game-Room** — Ein Match verwalten, State broadcasten
5. **Auth + JWT** — Login, Register, Gast-Login
6. **Matchmaking-Queue** — ELO-basiertes Pairing
7. **Client-Refactor** — UI aus engine_raw.js trennen
8. **Leaderboard + Replays** — PostgreSQL-Integration
9. **Spectator-Mode** — Read-only State-Stream
