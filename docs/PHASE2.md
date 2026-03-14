# HexForge MP — Phase 2 Changes

## What's new in Phase 2

### 1. PostgreSQL Integration (`server/db/`)

Two new files replace the in-memory stores when `USE_DB=true`:

| File | Purpose |
|------|---------|
| `server/db/queries.js` | Raw PostgreSQL queries (pg pool) |
| `server/db/adapter.js` | Drop-in adapter matching the in-memory store API |

**To enable:**
```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/hexforge
export USE_DB=true
npm run migrate   # runs database/schema.sql
npm start
```

With `docker-compose up` it's automatic — PostgreSQL is wired in by default.

**New REST endpoints (require Bearer token):**
- `GET  /api/decks`         — list your saved decks
- `POST /api/decks`         — create a deck `{ name, cards[], archetype }`
- `PUT  /api/decks/:id`     — update a deck
- `DELETE /api/decks/:id`   — delete a deck

**Health endpoint:**
- `GET /api/health`         — server uptime + DB connection info

### 2. Reconnect Support

Players who disconnect during a match now get a **30-second grace window** to reconnect before their opponent is awarded the win.

**Flow:**
1. Player disconnects → opponent sees "⚡ [name] disconnected. They have 30s to reconnect…"
2. Player reconnects → sends `AUTH_TOKEN` with their JWT
3. Server auto-detects the pending reconnect slot and calls `roomManager.handleReconnect()`
4. Full game state is resent to the rejoined player
5. Opponent sees "✓ [name] reconnected."

**Guest accounts** (no userId) are forfeit immediately on disconnect, since they can't authenticate to reconnect.

**New socket events:**
| Event | Direction | Payload |
|-------|-----------|---------|
| `match_rejoined` | S→C | `{ matchId }` |
| `opponent_disconnected` | S→C | `{ username, graceSecs }` |
| `opponent_reconnected` | S→C | `{ username }` |

### 3. Rate Limiting

Simple in-memory IP-based rate limiting on auth operations:
- **Register:** 5 attempts / 60s per IP
- **Login:** 10 attempts / 60s per IP

Returns `AUTH_ERR` with reason `"Too many attempts. Try again in a minute."` when exceeded.

### 4. Bug Fixes
- Schema typo fixed: `m.rated` → `m.ranked` in recent_matches view
- Private room codes now auto-expire after 10 minutes
- `engine-test.js` script name corrected in package.json

## Architecture

```
In-memory (default, zero setup):
  auth.js UserStore ──────────────────────→ sessions
  elo.js  MatchStore ─────────────────────→ match log

PostgreSQL (USE_DB=true):
  db/queries.js ──→ db/adapter.js ──→ same interface
```

The adapter layer means you can develop locally without a database and deploy to production with PostgreSQL by just setting `USE_DB=true`.
