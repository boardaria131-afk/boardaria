# HexForge Online — Multiplayer Server

## Architecture Overview

```
hexforge-mp/
├── server/
│   ├── index.js                ← Express + Socket.IO entry point
│   ├── engine/
│   │   ├── game-engine.js      ← Pure game logic (auto-extracted from HTML, 345KB)
│   │   ├── action-validator.js ← Anti-cheat: validates every client action
│   │   ├── action-handler.js   ← Applies validated actions to game state
│   │   └── engine-test.js      ← Smoke tests (node server/engine/engine-test.js)
│   ├── auth/
│   │   └── auth.js             ← Register, login, guest, JWT (no dependencies)
│   ├── matchmaking/
│   │   ├── queue.js            ← ELO-based matchmaking queue
│   │   └── room-manager.js     ← Active match registry + private rooms
│   ├── rooms/
│   │   └── game-room.js        ← Single match: state + broadcast + game-over
│   └── ladder/
│       └── elo.js              ← ELO calculation + match recording
├── client/
│   └── public/
│       └── index.html          ← Full single-page multiplayer client
├── shared/
│   └── protocol.js             ← WebSocket event names + action types (shared)
├── database/
│   └── schema.sql              ← PostgreSQL schema
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Key Design Decisions

### Server-Authoritative
- Clients send **intentions** (`player_action` events)
- Server **validates** every action via `action-validator.js`
- Server **applies** the action via `action-handler.js`
- Server **broadcasts** updated state to both players
- Clients never compute game rules — they only render

### State Privacy
- Each player receives a **personalised state** with the opponent's hand hidden
- Deck contents are hidden from both players (size only)
- Spectators see both hands

### Engine Extraction
The game engine (`game-engine.js`) is the original `hexforge.html` engine, extracted as a CommonJS module with:
- `_devEnabled = false` (dev mode disabled)
- `loadGameParams(overrideParams)` — accepts server-provided params instead of `localStorage`
- Full `module.exports` of all 60 functions + 15 constants

### ELO System
- Starting rating: **1000**
- K-factor: **32**
- Guests: no persistent rating change
- Formula: `Δ = K × (score - expected)` where `expected = 1 / (1 + 10^((oppRating - myRating) / 400))`

## Quick Start (Development)

```bash
# 1. Install
npm install

# 2. Run tests
npm test

# 3. Start server
npm start
# → http://localhost:3000
```

## Production (Docker)

```bash
# Set a real JWT secret
export JWT_SECRET="your-secret-here"

# Start everything (server + PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f server
```

## Deployment Options

### Option A: Fly.io (recommended)
```bash
fly launch
fly secrets set JWT_SECRET=your-secret
fly postgres create --name hexforge-db
fly postgres attach hexforge-db
fly deploy
```

### Option B: Railway
```bash
railway init
railway add postgresql
railway up
```

### Option C: VPS (nginx reverse proxy)
```nginx
server {
  listen 80;
  server_name hexforge.yourdomain.com;
  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

## WebSocket Protocol

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `register` | `{username, password}` | Create account |
| `login` | `{username, password}` | Login |
| `guest_login` | — | Play as Guest1234 |
| `auth_token` | `{token}` | Reconnect with JWT |
| `queue_join` | `{deck?}` | Enter ranked queue |
| `queue_leave` | — | Leave queue |
| `room_create` | `{deck?}` | Create private room |
| `room_join` | `{code, deck?}` | Join private room |
| `spectate` | `{matchId}` | Watch a match |
| `player_action` | `{type, payload}` | In-game action |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `auth_ok` | `{user, token}` | Login success |
| `auth_err` | `{reason}` | Login failed |
| `queue_status` | `{position, queueSize}` | Queue update |
| `match_found` | `{matchId, opponent}` | Match found |
| `game_start` | `{matchId, yourPlayer, state}` | Game begins |
| `state_update` | `{state, lastAction, seq, pendingInput?}` | State changed |
| `action_invalid` | `{reason}` | Rejected action |
| `game_over` | `{winner, youWon, eloChange}` | Match ended |
| `room_created` | `{code}` | Private room code |

### Action Types
| Type | Payload |
|------|---------|
| `mulligan_confirm` | `{replaceIds: string[]}` |
| `place_land` | `{cardId, q, r, s}` |
| `wheel_draw` | — |
| `wheel_boost` | — |
| `play_unit` | `{cardId, q, r, s}` |
| `play_instant` | `{cardId, targetQ, targetR, targetS}` |
| `move_unit` | `{unitId, q, r, s}` |
| `attack_unit` | `{unitId, targetId}` |
| `attack_base` | `{unitId}` |
| `use_gift` | `{unitId, q, r, s}` |
| `discover_pick` | `{chosenId}` |
| `choose_one` | `{choiceIndex}` |
| `end_turn` | — |

## Connecting the Existing Single-Player HTML

The original `hexforge.html` can still be used for local pass-and-play.
The server version uses the **same engine**, just server-side.

To use a custom deck, pass it as `deck: string[]` in `queue_join` / `room_create` / `room_join`.

## Scaling

- **Horizontal scaling**: Use Redis adapter for Socket.IO (`socket.io-redis`)
- **State persistence**: Replace in-memory `UserStore` / `MatchStore` with PostgreSQL queries in `server/db/queries.js`
- **Rate limiting**: Add `express-rate-limit` to auth endpoints
- **Thousands of concurrent matches**: Each `GameRoom` is ~100KB of in-memory state. 10,000 concurrent matches ≈ 1GB RAM.
