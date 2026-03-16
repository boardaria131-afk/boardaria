# HexForge Multiplayer

Vollständiger Online-Multiplayer-Server für HexForge — ein rundenbasiertes Hex-Grid-Kartenspiel mit 488 Karten.

## Schnellstart

```bash
npm install
npm start
# → http://localhost:3000
```

Zwei Browser-Tabs öffnen, bei beiden einloggen (oder als Gast), Match suchen — fertig.

## Features

### Spielmodi
- **Ranked Match** — ELO-basiertes Matchmaking (±100 MMR, expandiert alle 5s)
- **Gegen KI** — regelbasierter Bot-Gegner
- **Privates Spiel** — 6-stelligen Code erstellen, Freund einladen

### Während des Spiels
- **Simultanes Mulligan** — beide Spieler tauschen gleichzeitig
- **90-Sekunden-Zugtimer** — automatisches Zugbeenden bei Timeout
- **In-Game Chat** — Textnachrichten zwischen Spielern
- **Disconnect-Grace** — 30s Reconnect-Zeit (Gäste: sofort Forfeit)

### Community
- **Rangliste** `/leaderboard.html` — Top-100, Win%, Live-Matches
- **Spielerprofil** — klick auf Spielernamen in der Rangliste
- **Replay API** — alle Züge gespeichert unter `/api/replay/:matchId`

## Architektur

```
hexforge-mp/
├── server/
│   ├── index.js              # Express + Socket.IO
│   ├── auth/auth.js          # Register/Login/Guest, JWT
│   ├── engine/               # Spiellogik (488 Karten)
│   ├── rooms/game-room.js    # Match, Timer, Chat
│   ├── matchmaking/          # ELO-Queue, Reconnect
│   ├── ladder/elo.js         # ELO K=32
│   └── bot/bot-player.js     # KI-Gegner
├── client/public/
│   ├── index.html            # Game-Client
│   ├── leaderboard.html      # Rangliste
│   └── deckbuilder.html      # Deck Builder
└── shared/protocol.js        # Protokoll-Konstanten
```

## REST API

| Endpoint | Beschreibung |
|---|---|
| `GET /api/health` | Server-Status |
| `GET /api/leaderboard` | Top-100 Spieler |
| `GET /api/matches` | Aktive Matches |
| `GET /api/replay/:matchId` | Match-Replay |
| `GET /api/user/:id` | Spielerprofil |

## Tests

```bash
node server/engine/engine-test.js
# → 41 Tests: State, Mulligan, Turn-Lifecycle, Timer, Chat, Bot
```

## Mit PostgreSQL (optional)

```bash
DATABASE_URL=postgresql://... USE_DB=true npm start
npm run migrate  # Schema anlegen
```

## Deployment (fly.io)

```bash
fly launch --name hexforge-mp
fly secrets set JWT_SECRET=$(openssl rand -hex 32)
fly deploy
```
