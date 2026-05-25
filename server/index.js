'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge Multiplayer Server  —  server/index.js
//
//  Phase 2: DB adapter, reconnect, rate limiting
// ═══════════════════════════════════════════════════════════

const http    = require('http');
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const { Server } = require('socket.io');

const { C2S, S2C }          = require('../shared/protocol');
const { register, login, guestLogin, authFromToken, setStore, store: memUserStore } = require('./auth/auth');
const { BotPlayer }          = require('./bot/bot-player');
const { MatchmakingQueue }  = require('./matchmaking/queue');
const { RoomManager }       = require('./matchmaking/room-manager');
const { processMatchResult, matchStore: memMatchStore } = require('./ladder/elo');
const { userStore: pgUserStore, matchStore: pgMatchStore, isUsingDB, db } = require('./db/adapter');

// Use PostgreSQL if USE_DB=true, else fall back to in-memory stores
const userStore  = pgUserStore  || memUserStore;
const matchStore = pgMatchStore || memMatchStore;

if (isUsingDB) {
  console.log('[Server] Using PostgreSQL stores');
  setStore(pgUserStore); // Wire auth to DB store
} else {
  console.log('[Server] Using in-memory stores (set USE_DB=true for PostgreSQL)');
}

const PORT = process.env.PORT || 3000;

// ── Simple in-memory rate limiter ────────────────────────
// Limits expensive operations (auth, queue join) per IP
const rateLimiter = (() => {
  const windows = new Map(); // key → { count, resetAt }
  return function check(key, limit = 10, windowMs = 60_000) {
    const now = Date.now();
    let w = windows.get(key);
    if (!w || now > w.resetAt) {
      w = { count: 0, resetAt: now + windowMs };
      windows.set(key, w);
    }
    w.count++;
    return w.count <= limit;
  };
})();

function rlKey(socket, action) { return `${socket.handshake.address}:${action}`; }

// ── Express app ───────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public')));

// ── REST endpoints ────────────────────────────────────────

// Health
app.get('/api/health', async (req, res) => {
  const info = { status: 'ok', version: '5.48.0', uptime: process.uptime(), usingDB: isUsingDB };
  if (isUsingDB) {
    try { const r = await db.healthCheck(); info.db = r; } catch(e) { info.dbError = e.message; }
  }
  res.json(info);
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const leaderboard = await Promise.resolve(userStore.leaderboard(100));
    res.json({ leaderboard });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Active matches (for spectator lobby)
app.get('/api/matches', (req, res) => {
  const active = roomManager.listActive().map(r => ({
    matchId:    r.id,
    playerA:    r.playerInfo.A.username,
    playerB:    r.playerInfo.B.username,
    turn:       r.S.turn,
    spectators: r.spectators.size,
  }));
  res.json({ matches: active });
});

// Replay
app.get('/api/replay/:matchId', async (req, res) => {
  try {
    const record = await Promise.resolve(matchStore.get(req.params.matchId));
    if (!record) return res.status(404).json({ error: 'Match not found' });
    res.json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// User profile
app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await Promise.resolve(userStore.findById(parseInt(req.params.id)));
    if (!user) return res.status(404).json({ error: 'User not found' });
    const matches = await Promise.resolve(matchStore.forUser(user.id, 20));
    res.json({
      user: { id: user.id, username: user.username, rating: user.rating, wins: user.wins, losses: user.losses },
      recentMatches: matches,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Deck endpoints (require auth header: Bearer <token>) ──
async function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  const payload = await authFromToken(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = payload.id;
  next();
}

// ── In-memory deck store (works without PostgreSQL) ──────
class InMemoryDeckStore {
  constructor() { this._data = new Map(); this._nextId = 1; }
  getForUser(userId) { return this._data.get(userId) || []; }
  save({ userId, deckId, name, cards, archetype }) {
    const decks = this._data.get(userId) ? [...this._data.get(userId)] : [];
    if (deckId) {
      const idx = decks.findIndex(d => d.id === deckId);
      if (idx < 0) return null;
      decks[idx] = { ...decks[idx], name, cards, archetype };
      this._data.set(userId, decks);
      return decks[idx];
    }
    const deck = { id: this._nextId++, userId, name, cards: cards || [], archetype: archetype || null };
    decks.push(deck);
    this._data.set(userId, decks);
    return deck;
  }
  delete(deckId, userId) {
    this._data.set(userId, (this._data.get(userId) || []).filter(d => d.id !== deckId));
  }
}
const memDeckStore = new InMemoryDeckStore();

app.get('/api/decks', requireAuth, async (req, res) => {
  if (isUsingDB) {
    try { return res.json({ decks: await db.getDecksForUser(req.userId) }); }
    catch(e) { return res.status(500).json({ error: e.message }); }
  }
  res.json({ decks: memDeckStore.getForUser(req.userId) });
});

app.post('/api/decks', requireAuth, async (req, res) => {
  const { name, cards, archetype, isDefault } = req.body;
  if (!name || !Array.isArray(cards)) return res.status(400).json({ error: 'name and cards required' });
  // Validate: name max 64 chars, cards max 60
  if (name.length > 64) return res.status(400).json({ error: 'Deck name too long (max 64 chars)' });
  if (cards.length > 60) return res.status(400).json({ error: 'Too many cards (max 60)' });
  if (isUsingDB) {
    try { return res.json({ deck: await db.saveDeck({ userId: req.userId, name, cards, archetype, isDefault }) }); }
    catch(e) {
      console.error('[API] POST /api/decks error:', e.message, 'userId:', req.userId, 'name:', name);
      return res.status(500).json({ error: e.message });
    }
  }
  res.json({ deck: memDeckStore.save({ userId: req.userId, name, cards, archetype }) });
});

app.put('/api/decks/:id', requireAuth, async (req, res) => {
  const { name, cards, archetype, isDefault } = req.body;
  if (name && name.length > 64) return res.status(400).json({ error: 'Deck name too long (max 64 chars)' });
  if (isUsingDB) {
    try {
      const deck = await db.saveDeck({ userId: req.userId, deckId: parseInt(req.params.id), name, cards, archetype, isDefault });
      if (!deck) return res.status(404).json({ error: 'Deck not found' });
      return res.json({ deck });
    } catch(e) {
      console.error('[API] PUT /api/decks error:', e.message, 'deckId:', req.params.id);
      return res.status(500).json({ error: e.message });
    }
  }
  const deck = memDeckStore.save({ userId: req.userId, deckId: parseInt(req.params.id), name, cards, archetype });
  if (!deck) return res.status(404).json({ error: 'Deck not found' });
  res.json({ deck });
});

app.delete('/api/decks/:id', requireAuth, async (req, res) => {
  if (isUsingDB) {
    try { await db.deleteDeck(parseInt(req.params.id), req.userId); return res.json({ ok: true }); }
    catch(e) { return res.status(500).json({ error: e.message }); }
  }
  memDeckStore.delete(parseInt(req.params.id), req.userId);
  res.json({ ok: true });
});
// ── D&D Charakterbogen Auth ───────────────────────────────
// Nutzt dieselben register/login/authFromToken wie HexForge.
// hf_token ist kompatibel — D&D-App muss nichts extra speichern.

app.get('/api/dnd/verify', async (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Kein Token' });
  const user = await authFromToken(token);
  if (!user) return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  res.json({ user: { id: user.id, username: user.username, isGuest: !!user.isGuest } });
});

app.post('/api/dnd/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  if (!rateLimiter(`${req.ip}:dnd_login`, 10, 60_000))
    return res.status(429).json({ error: 'Zu viele Versuche. Bitte warte eine Minute.' });
  const result = await login(username, password);
  if (!result.ok) return res.status(401).json({ error: result.reason || 'Falsche Anmeldedaten' });
  res.json({ user: { id: result.user.id, username: result.user.username, isGuest: false }, token: result.token });
});

app.post('/api/dnd/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: 'Username und Passwort erforderlich' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Passwort mind. 6 Zeichen' });
  if (!rateLimiter(`${req.ip}:dnd_register`, 5, 60_000))
    return res.status(429).json({ error: 'Zu viele Versuche. Bitte warte eine Minute.' });
  const result = await register(username, password);
  if (!result.ok) return res.status(400).json({ error: result.reason || 'Registrierung fehlgeschlagen' });
  res.json({ user: { id: result.user.id, username: result.user.username, isGuest: false }, token: result.token });
});
// ── Ende D&D Auth ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
// D&D Character CRUD — Cross-Device Sync
// Eigener pg.Pool aus DATABASE_URL — Tabelle wird automatisch angelegt.
// Fallback: In-Memory (nur für die laufende Server-Session).
// ════════════════════════════════════════════════════════════════════════════

let dndPool = null;
let dndDbReady = false;

(async () => {
  if (!process.env.DATABASE_URL) {
    console.log('[DnD] Kein DATABASE_URL — In-Memory Fallback aktiv');
    return;
  }
  try {
    const { Pool } = require('pg');
    dndPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await dndPool.query(`
      CREATE TABLE IF NOT EXISTS dnd_characters (
        id          TEXT        NOT NULL,
        user_id     INTEGER     NOT NULL,
        data        JSONB       NOT NULL,
        is_shared   BOOLEAN     DEFAULT false,
        shared_at   TIMESTAMPTZ,
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_dnd_chars_user
        ON dnd_characters (user_id);
      CREATE INDEX IF NOT EXISTS idx_dnd_chars_shared
        ON dnd_characters (is_shared) WHERE is_shared = true;
    `);
    dndDbReady = true;
    console.log('[DnD] Datenbank bereit ✅');
  } catch(e) {
    console.error('[DnD] DB-Init fehlgeschlagen, nutze In-Memory:', e.message);
  }
})();

const dndCharStore   = new Map(); // userId → [chars]  (Fallback)
const dndSharedStore = new Map(); // charId → char      (Fallback)

const JWT_SECRET_DND = process.env.JWT_SECRET || 'hexforge-dev-secret-CHANGE-IN-PROD';
const jwt = require('jsonwebtoken');

function requireDndAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });
  try {
    const d = jwt.verify(token, JWT_SECRET_DND);
    req.userId   = d.userId || d.id;
    req.username = d.username;
    next();
  } catch { res.status(401).json({ error: 'Token ungültig' }); }
}

// GET /api/dnd/characters — alle eigenen Charaktere
app.get('/api/dnd/characters', requireDndAuth, async (req, res) => {
  if (dndDbReady) {
    try {
      const r = await dndPool.query(
        'SELECT data FROM dnd_characters WHERE user_id=$1 ORDER BY updated_at DESC',
        [req.userId]
      );
      return res.json({ characters: r.rows.map(x => x.data) });
    } catch(e) { console.error('[DnD] GET characters:', e.message); }
  }
  res.json({ characters: dndCharStore.get(String(req.userId)) || [] });
});

// POST /api/dnd/characters — speichern / updaten
app.post('/api/dnd/characters', requireDndAuth, async (req, res) => {
  const char = req.body;
  if (!char?.id) return res.status(400).json({ error: 'Ungültige Daten' });
  char._userId    = req.userId;
  char._updatedAt = new Date().toISOString();
  if (dndDbReady) {
    try {
      await dndPool.query(`
        INSERT INTO dnd_characters (id, user_id, data, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id, user_id)
        DO UPDATE SET data = $3, updated_at = NOW()
      `, [char.id, req.userId, JSON.stringify(char)]);
      return res.json({ ok: true, storage: 'db' });
    } catch(e) { console.error('[DnD] POST characters:', e.message); }
  }
  const uid = String(req.userId);
  const roster = (dndCharStore.get(uid) || []).filter(c => c.id !== char.id);
  roster.unshift(char);
  dndCharStore.set(uid, roster.slice(0, 30));
  res.json({ ok: true, storage: 'memory' });
});

// DELETE /api/dnd/characters/:id
app.delete('/api/dnd/characters/:id', requireDndAuth, async (req, res) => {
  if (dndDbReady) {
    try {
      await dndPool.query(
        'DELETE FROM dnd_characters WHERE id=$1 AND user_id=$2',
        [req.params.id, req.userId]
      );
      return res.json({ ok: true });
    } catch(e) { console.error('[DnD] DELETE characters:', e.message); }
  }
  const uid = String(req.userId);
  dndCharStore.set(uid, (dndCharStore.get(uid) || []).filter(c => c.id !== req.params.id));
  res.json({ ok: true });
});

// GET /api/dnd/shared — geteilte Charaktere (Kampagne)
app.get('/api/dnd/shared', requireDndAuth, async (req, res) => {
  if (dndDbReady) {
    try {
      const r = await dndPool.query(
        'SELECT data FROM dnd_characters WHERE is_shared=true ORDER BY shared_at DESC LIMIT 50'
      );
      return res.json({ characters: r.rows.map(x => x.data) });
    } catch(e) { console.error('[DnD] GET shared:', e.message); }
  }
  res.json({ characters: [...dndSharedStore.values()] });
});

// POST /api/dnd/shared — Charakter teilen
app.post('/api/dnd/shared', requireDndAuth, async (req, res) => {
  const char = req.body;
  if (!char?.id) return res.status(400).json({ error: 'Ungültige Daten' });
  char._ownerId   = req.userId;
  char._ownerName = req.username;
  char._sharedAt  = new Date().toISOString();
  if (dndDbReady) {
    try {
      await dndPool.query(`
        INSERT INTO dnd_characters (id, user_id, data, is_shared, shared_at, updated_at)
        VALUES ($1, $2, $3, true, NOW(), NOW())
        ON CONFLICT (id, user_id)
        DO UPDATE SET data=$3, is_shared=true, shared_at=NOW(), updated_at=NOW()
      `, [char.id, req.userId, JSON.stringify(char)]);
      return res.json({ ok: true });
    } catch(e) { console.error('[DnD] POST shared:', e.message); }
  }
  dndSharedStore.set(char.id, char);
  res.json({ ok: true });
});

// DELETE /api/dnd/shared/:id — Teilen aufheben
app.delete('/api/dnd/shared/:id', requireDndAuth, async (req, res) => {
  if (dndDbReady) {
    try {
      await dndPool.query(
        'UPDATE dnd_characters SET is_shared=false WHERE id=$1 AND user_id=$2',
        [req.params.id, req.userId]
      );
      return res.json({ ok: true });
    } catch(e) { console.error('[DnD] DELETE shared:', e.message); }
  }
  dndSharedStore.delete(req.params.id);
  res.json({ ok: true });
});

// GET /api/dnd/status — Debug
app.get('/api/dnd/status', (req, res) => {
  res.json({ db: dndDbReady ? 'postgresql' : 'in-memory', version: '1.21.0' });
});
// ══ Ende D&D Character Sync ══════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
// D&D Kampagnen-System — Erstellen, Beitreten, Code-basiert
// ════════════════════════════════════════════════════════════════════════════

const dndCampaignStore = new Map(); // code → campaign (In-Memory Fallback)

// Auto-Migration: Kampagnen-Tabelle anlegen
(async () => {
  if (!dndDbReady) return;
  try {
    await dndPool.query(`
      CREATE TABLE IF NOT EXISTS dnd_campaigns (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        code        TEXT NOT NULL UNIQUE,
        owner_id    INTEGER NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS dnd_campaign_members (
        campaign_id INTEGER NOT NULL REFERENCES dnd_campaigns(id) ON DELETE CASCADE,
        user_id     INTEGER NOT NULL,
        joined_at   TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (campaign_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_dnd_camp_code ON dnd_campaigns (code);
      CREATE INDEX IF NOT EXISTS idx_dnd_camp_members ON dnd_campaign_members (campaign_id);
    `);
    console.log('[DnD] Kampagnen-Tabellen bereit ✅');
  } catch(e) { console.error('[DnD] Kampagnen-Migration:', e.message); }
})();

function generateCampCode() {
  const words = ['DRACH','MAGUS','ROGUE','BARDE','PALAD','KLERP','MONCH','JAGER'];
  return words[Math.floor(Math.random() * words.length)] + '-' + (Math.floor(Math.random() * 9000) + 1000);
}

// POST /api/dnd/campaigns — Kampagne erstellen
app.post('/api/dnd/campaigns', requireDndAuth, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });
  const code = generateCampCode();

  if (dndDbReady) {
    try {
      const r = await dndPool.query(
        'INSERT INTO dnd_campaigns (name, code, owner_id) VALUES ($1, $2, $3) RETURNING id, name, code',
        [name.trim(), code, req.userId]
      );
      await dndPool.query(
        'INSERT INTO dnd_campaign_members (campaign_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [r.rows[0].id, req.userId]
      );
      return res.json(r.rows[0]);
    } catch(e) { console.error('[DnD] Kampagne erstellen:', e.message); }
  }

  // In-Memory Fallback
  const camp = { id: Date.now(), name: name.trim(), code, owner_id: req.userId };
  dndCampaignStore.set(code, camp);
  res.json(camp);
});

// POST /api/dnd/campaigns/join — Kampagne beitreten
app.post('/api/dnd/campaigns/join', requireDndAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Code erforderlich' });

  if (dndDbReady) {
    try {
      const r = await dndPool.query('SELECT * FROM dnd_campaigns WHERE code=$1', [code.toUpperCase()]);
      if (!r.rows.length) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
      const camp = r.rows[0];
      await dndPool.query(
        'INSERT INTO dnd_campaign_members (campaign_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [camp.id, req.userId]
      );
      return res.json({ id: camp.id, name: camp.name, code: camp.code });
    } catch(e) { console.error('[DnD] Kampagne beitreten:', e.message); }
  }

  // In-Memory Fallback
  const camp = dndCampaignStore.get(code.toUpperCase());
  if (!camp) return res.status(404).json({ error: 'Kampagne nicht gefunden' });
  res.json(camp);
});

// GET /api/dnd/campaigns — eigene Kampagnen
app.get('/api/dnd/campaigns', requireDndAuth, async (req, res) => {
  if (dndDbReady) {
    try {
      const r = await dndPool.query(`
        SELECT c.id, c.name, c.code, c.owner_id,
               (c.owner_id = $1) AS is_owner
        FROM dnd_campaigns c
        JOIN dnd_campaign_members m ON m.campaign_id = c.id
        WHERE m.user_id = $1
        ORDER BY c.created_at DESC
      `, [req.userId]);
      return res.json({ campaigns: r.rows });
    } catch(e) { console.error('[DnD] Kampagnen laden:', e.message); }
  }
  res.json({ campaigns: [] });
});
// ══ Ende D&D Kampagnen ═══════════════════════════════════════════════════════
// ── D&D Journal Sync ─────────────────────────────────────────────────────────
(async () => {
  if (!dndDbReady) return;
  try {
    await dndPool.query(`
      CREATE TABLE IF NOT EXISTS dnd_journals (
        user_id    INTEGER NOT NULL PRIMARY KEY,
        data       JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DnD] Journal-Tabelle bereit ✅');
  } catch(e) { console.error('[DnD] Journal-Migration:', e.message); }
})();

app.get('/api/dnd/journal', requireDndAuth, async (req, res) => {
  if (dndDbReady) {
    try {
      const r = await dndPool.query('SELECT data FROM dnd_journals WHERE user_id=$1', [req.userId]);
      return res.json({ journal: r.rows[0]?.data || {} });
    } catch(e) { console.error('[DnD] Journal laden:', e.message); }
  }
  res.json({ journal: {} });
});

app.post('/api/dnd/journal', requireDndAuth, async (req, res) => {
  const { data } = req.body || {};
  if (!data) return res.status(400).json({ error: 'Keine Daten' });
  if (dndDbReady) {
    try {
      await dndPool.query(`
        INSERT INTO dnd_journals (user_id, data, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) DO UPDATE SET data=$2, updated_at=NOW()
      `, [req.userId, JSON.stringify(data)]);
      return res.json({ ok: true });
    } catch(e) { console.error('[DnD] Journal speichern:', e.message); }
  }
  res.json({ ok: true });
});
// ── Ende Journal Sync ─────────────────────────────────────────────────────────





// ── Socket.IO ─────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout:  60000,
  pingInterval: 25000,
  // Render (and most reverse proxies) can drop long-polling connections.
  // Prefer WebSocket transport for reliability on hosted platforms.
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

// Session data per socket (set after auth)
// sockId → { userId, username, rating, isGuest, deck }
const sessions = new Map();

// ── Matchmaking queue ─────────────────────────────────────
const queue = new MatchmakingQueue(
  ({ playerA, playerB }) => {
    const result = roomManager.createMatch(playerA, playerB);
    io.to(playerA.socketId).emit(S2C.MATCH_FOUND, {
      matchId:  result.id,
      opponent: { username: playerB.username, rating: playerB.rating },
    });
    io.to(playerB.socketId).emit(S2C.MATCH_FOUND, {
      matchId:  result.id,
      opponent: { username: playerA.username, rating: playerA.rating },
    });
  },
  (socketId, status) => {
    // Send live queue status to waiting player
    io.to(socketId).emit(S2C.QUEUE_STATUS, status);
  }
);

queue.start();

// ── Room manager ─────────────────────────────────────────
const roomManager = new RoomManager(io, (result) => {
  // Game over callback — calculate ELO
  const eloResult = processMatchResult(result, userStore, matchStore);

  // Send updated ELO to each player socket
  const room = roomManager.getRoom(result.matchId);
  if (room) {
    for (const [sockId, player] of Object.entries(room.socketToPlayer)) {
      const delta = player === 'A' ? eloResult.deltaA : eloResult.deltaB;
      const newRating = player === 'A' ? eloResult.newA : eloResult.newB;
      io.to(sockId).emit(S2C.GAME_OVER, {
        winner:    result.winner,
        youWon:    player === result.winner,
        eloChange: delta,
        newRating,
        matchId:   result.matchId,
      });
      // Update session rating
      const sess = sessions.get(sockId);
      if (sess) sess.rating = newRating;
    }
  }

  console.log(`[Ladder] Match ${result.matchId} recorded. ELO: A${eloResult.deltaA > 0 ? '+' : ''}${eloResult.deltaA}, B${eloResult.deltaB > 0 ? '+' : ''}${eloResult.deltaB}`);
});

// ── Socket.IO connection handler ──────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // ── Auth ────────────────────────────────────────────────

  socket.on(C2S.REGISTER, async ({ username, password } = {}) => {
    if (!rateLimiter(rlKey(socket, 'register'), 5, 60_000)) {
      return socket.emit(S2C.AUTH_ERR, { reason: 'Too many attempts. Try again in a minute.' });
    }
    const result = await register(username, password);
    if (result.ok) {
      sessions.set(socket.id, { ...result.user, socketId: socket.id });
      socket.emit(S2C.AUTH_OK, { user: result.user, token: result.token });
    } else {
      socket.emit(S2C.AUTH_ERR, { reason: result.reason });
    }
  });

  socket.on(C2S.LOGIN, async ({ username, password } = {}) => {
    if (!rateLimiter(rlKey(socket, 'login'), 10, 60_000)) {
      return socket.emit(S2C.AUTH_ERR, { reason: 'Too many attempts. Try again in a minute.' });
    }
    const result = await login(username, password);
    if (result.ok) {
      sessions.set(socket.id, { ...result.user, socketId: socket.id });
      socket.emit(S2C.AUTH_OK, { user: result.user, token: result.token });
    } else {
      socket.emit(S2C.AUTH_ERR, { reason: result.reason });
    }
  });

  socket.on(C2S.GUEST_LOGIN, async () => {
    const result = await guestLogin();
    sessions.set(socket.id, { ...result.user, socketId: socket.id });
    socket.emit(S2C.AUTH_OK, { user: result.user, token: result.token });
  });

  socket.on(C2S.AUTH_TOKEN, async ({ token } = {}) => {
    const user = await authFromToken(token);
    if (user) {
      // Refresh rating from live store (await handles both sync and async stores)
      const live = await Promise.resolve(userStore.findById(user.id));
      const sess = live ? { ...user, rating: live.rating, socketId: socket.id } : { ...user, socketId: socket.id };
      sessions.set(socket.id, sess);
      socket.emit(S2C.AUTH_OK, { user: sess });

      // Auto-rejoin if mid-match when disconnected
      if (user.id && roomManager.hasPendingReconnect(user.id)) {
        const result = roomManager.handleReconnect(socket.id, user.id);
        if (result.ok) {
          const room   = roomManager.getRoom(result.matchId);
          const player = room?.socketToPlayer[socket.id];
          socket.emit(S2C.MATCH_REJOINED, { matchId: result.matchId });
          if (room && player) {
            room.sendState(socket.id, player);
            room._emitTimer(); // resend current timer state
          }
          console.log(`[Auth] ${user.username} auto-rejoined match ${result.matchId}`);
        }
      }
    } else {
      socket.emit(S2C.AUTH_ERR, { reason: 'Invalid or expired token' });
    }
  });

  // ── Matchmaking ─────────────────────────────────────────

  socket.on(C2S.QUEUE_JOIN, ({ deck } = {}) => {
    const sess = sessions.get(socket.id);
    if (!sess) return socket.emit(S2C.AUTH_ERR, { reason: 'Not authenticated' });
    // Remove from any existing queue entry first
    queue.dequeue(socket.id);
    queue.enqueue({
      socketId: socket.id,
      userId:   sess.id,
      username: sess.username,
      rating:   sess.rating || 1000,
      isGuest:  sess.isGuest,
      deck:     Array.isArray(deck) ? deck : null,
    });
    socket.emit(S2C.QUEUE_STATUS, queue.getStatus(socket.id));
  });

  socket.on(C2S.QUEUE_LEAVE, () => {
    queue.dequeue(socket.id);
  });

  // ── Private rooms ────────────────────────────────────────

  socket.on(C2S.ROOM_CREATE, ({ deck } = {}) => {
    const sess = sessions.get(socket.id);
    if (!sess) return socket.emit(S2C.AUTH_ERR, { reason: 'Not authenticated' });
    const code = roomManager.createPrivateRoom({
      socketId: socket.id,
      userId:   sess.id,
      username: sess.username,
      rating:   sess.rating || 1000,
      isGuest:  sess.isGuest,
      deck:     Array.isArray(deck) ? deck : null,
    });
    socket.emit(S2C.ROOM_CREATED, { code });
  });

  socket.on(C2S.ROOM_JOIN, ({ code, deck } = {}) => {
    const sess = sessions.get(socket.id);
    if (!sess) return socket.emit(S2C.AUTH_ERR, { reason: 'Not authenticated' });
    if (!code)  return socket.emit(S2C.ROOM_ERROR, { reason: 'No room code provided' });
    const result = roomManager.joinPrivateRoom({
      socketId: socket.id,
      userId:   sess.id,
      username: sess.username,
      rating:   sess.rating || 1000,
      isGuest:  sess.isGuest,
      deck:     Array.isArray(deck) ? deck : null,
    }, code);
    if (!result.ok) socket.emit(S2C.ROOM_ERROR, { reason: result.reason });
  });

  // ── Play vs Bot ───────────────────────────────────────────

  socket.on(C2S.PLAY_VS_BOT, ({ deck, difficulty } = {}) => {
    const sess = sessions.get(socket.id);
    if (!sess) return socket.emit(S2C.AUTH_ERR, { reason: 'Not authenticated' });

    // Validate difficulty
    const diff = ['easy','medium','hard'].includes(difficulty) ? difficulty : 'medium';
    const botNames = { easy: 'HexBot (Leicht)', medium: 'HexBot (Mittel)', hard: 'HexBot (Schwer)' };
    const botRatings = { easy: 800, medium: 1200, hard: 1600 };

    // Create a fake bot socket ID
    const botSocketId = `bot:${require('crypto').randomUUID()}`;

    const humanPlayer = { socketId: socket.id, userId: sess.id, username: sess.username, rating: sess.rating || 1000, isGuest: sess.isGuest, deck: Array.isArray(deck) ? deck : null };
    const botPlayer   = { socketId: botSocketId, userId: null, username: botNames[diff], rating: botRatings[diff], isGuest: true, deck: null };

    // Randomly assign sides
    const [pA, pB] = Math.random() < 0.5 ? [humanPlayer, botPlayer] : [botPlayer, humanPlayer];
    const room = roomManager.createMatch(pA, pB);

    // Attach bot to room with chosen difficulty
    const botSide = room.socketToPlayer[botSocketId];
    const bot = new BotPlayer(botSide, room, botSocketId, diff);
    room._bot = bot;

    // Trigger bot mulligan
    bot.onStateUpdate(room.S, { type: 'mulligan' });

    console.log(`[Bot] Match ${room.id}: ${sess.username} vs ${botNames[diff]} (${diff})`);
  });

  // ── In-game actions ──────────────────────────────────────

  socket.on(C2S.PLAYER_ACTION, (action) => {
    if (!action || typeof action !== 'object') return;
    roomManager.handleAction(socket.id, action);
  });

  socket.on(C2S.CHAT_MSG, ({ text } = {}) => {
    const room = roomManager.getRoomBySocket(socket.id);
    if (room) room.handleChat(socket.id, text);
  });

  // ── Spectator ────────────────────────────────────────────

  socket.on(C2S.SPECTATE, ({ matchId } = {}) => {
    if (!matchId) return;
    const result = roomManager.addSpectator(socket.id, matchId);
    if (!result.ok) socket.emit(S2C.ERROR, { reason: result.reason });
  });

  // ── Misc ─────────────────────────────────────────────────

  socket.on(C2S.PING, () => socket.emit(S2C.PONG));

  socket.on(C2S.RESIGN, () => {
    const sess = sessions.get(socket.id);
    if (!sess) return;
    const room = roomManager.getRoomBySocket(socket.id);
    if (!room) return;
    const player = room.socketToPlayer[socket.id];
    if (!player) return;
    console.log(`[Resign] ${sess.username} (${player}) gibt auf in Match ${room.id}`);
    room.handleResign(socket.id, player);
  });

  // ── Disconnect ───────────────────────────────────────────

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
    queue.dequeue(socket.id);
    roomManager.handleDisconnect(socket.id);
    sessions.delete(socket.id);
  });
});

// ── Status broadcast (queue size) every 5s ───────────────
setInterval(() => {
  for (const [sockId] of sessions) {
    const status = queue.getStatus(sockId);
    if (status) io.to(sockId).emit(S2C.QUEUE_STATUS, status);
  }
}, 5000);

// ── Start ─────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n┌────────────────────────────────────────┐`);
  console.log(`│  HexForge Multiplayer Server           │`);
  console.log(`│  http://localhost:${PORT}                  │`);
  console.log(`└────────────────────────────────────────┘\n`);
});

module.exports = { app, io, server }; // for testing
