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
const { register, login, guestLogin, authFromToken, store: memUserStore } = require('./auth/auth');
const { MatchmakingQueue }  = require('./matchmaking/queue');
const { RoomManager }       = require('./matchmaking/room-manager');
const { processMatchResult, matchStore: memMatchStore } = require('./ladder/elo');
const { userStore: pgUserStore, matchStore: pgMatchStore, isUsingDB, db } = require('./db/adapter');

// Use PostgreSQL if USE_DB=true, else fall back to in-memory stores
const userStore  = pgUserStore  || memUserStore;
const matchStore = pgMatchStore || memMatchStore;

if (isUsingDB) {
  console.log('[Server] Using PostgreSQL stores');
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
  const info = { status: 'ok', uptime: process.uptime(), usingDB: isUsingDB };
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
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  const payload = authFromToken(token);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = payload.userId;
  next();
}

app.get('/api/decks', requireAuth, async (req, res) => {
  if (!isUsingDB) return res.json({ decks: [] });
  try {
    const decks = await db.getDecksForUser(req.userId);
    res.json({ decks });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/decks', requireAuth, async (req, res) => {
  if (!isUsingDB) return res.status(503).json({ error: 'DB not enabled' });
  const { name, cards, archetype, isDefault } = req.body;
  if (!name || !Array.isArray(cards)) return res.status(400).json({ error: 'name and cards required' });
  try {
    const deck = await db.saveDeck({ userId: req.userId, name, cards, archetype, isDefault });
    res.json({ deck });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/decks/:id', requireAuth, async (req, res) => {
  if (!isUsingDB) return res.status(503).json({ error: 'DB not enabled' });
  const { name, cards, archetype, isDefault } = req.body;
  try {
    const deck = await db.saveDeck({ userId: req.userId, deckId: parseInt(req.params.id), name, cards, archetype, isDefault });
    if (!deck) return res.status(404).json({ error: 'Deck not found' });
    res.json({ deck });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/decks/:id', requireAuth, async (req, res) => {
  if (!isUsingDB) return res.status(503).json({ error: 'DB not enabled' });
  try {
    await db.deleteDeck(parseInt(req.params.id), req.userId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Socket.IO ─────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout:  60000,
  pingInterval: 25000,
});

// Session data per socket (set after auth)
// sockId → { userId, username, rating, isGuest, deck }
const sessions = new Map();

// ── Matchmaking queue ─────────────────────────────────────
const queue = new MatchmakingQueue(({ playerA, playerB }) => {
  // Attach socket IDs from sessions
  const result = roomManager.createMatch(playerA, playerB);
  // Notify both players
  io.to(playerA.socketId).emit(S2C.MATCH_FOUND, {
    matchId:  result.id,
    opponent: { username: playerB.username, rating: playerB.rating },
  });
  io.to(playerB.socketId).emit(S2C.MATCH_FOUND, {
    matchId:  result.id,
    opponent: { username: playerA.username, rating: playerA.rating },
  });
});

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

  socket.on(C2S.REGISTER, ({ username, password } = {}) => {
    if (!rateLimiter(rlKey(socket, 'register'), 5, 60_000)) {
      return socket.emit(S2C.AUTH_ERR, { reason: 'Too many attempts. Try again in a minute.' });
    }
    const result = register(username, password);
    if (result.ok) {
      sessions.set(socket.id, { ...result.user, socketId: socket.id });
      socket.emit(S2C.AUTH_OK, { user: result.user, token: result.token });
    } else {
      socket.emit(S2C.AUTH_ERR, { reason: result.reason });
    }
  });

  socket.on(C2S.LOGIN, ({ username, password } = {}) => {
    if (!rateLimiter(rlKey(socket, 'login'), 10, 60_000)) {
      return socket.emit(S2C.AUTH_ERR, { reason: 'Too many attempts. Try again in a minute.' });
    }
    const result = login(username, password);
    if (result.ok) {
      sessions.set(socket.id, { ...result.user, socketId: socket.id });
      socket.emit(S2C.AUTH_OK, { user: result.user, token: result.token });
    } else {
      socket.emit(S2C.AUTH_ERR, { reason: result.reason });
    }
  });

  socket.on(C2S.GUEST_LOGIN, () => {
    const result = guestLogin();
    sessions.set(socket.id, { ...result.user, socketId: socket.id });
    socket.emit(S2C.AUTH_OK, { user: result.user, token: result.token });
  });

  socket.on(C2S.AUTH_TOKEN, async ({ token } = {}) => {
    const user = authFromToken(token);
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
          socket.emit(S2C.MATCH_REJOINED, { matchId: result.matchId });
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

  // ── In-game actions ──────────────────────────────────────

  socket.on(C2S.PLAYER_ACTION, (action) => {
    if (!action || typeof action !== 'object') return;
    roomManager.handleAction(socket.id, action);
  });

  // ── Spectator ────────────────────────────────────────────

  socket.on(C2S.SPECTATE, ({ matchId } = {}) => {
    if (!matchId) return;
    const result = roomManager.addSpectator(socket.id, matchId);
    if (!result.ok) socket.emit(S2C.ERROR, { reason: result.reason });
  });

  // ── Misc ─────────────────────────────────────────────────

  socket.on(C2S.PING, () => socket.emit(S2C.PONG));

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
