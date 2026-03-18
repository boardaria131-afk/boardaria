'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge DB Adapter  —  server/db/adapter.js
//
//  Bridges the PostgreSQL queries.js API to the exact same
//  interface as the in-memory UserStore + MatchStore in
//  auth.js and elo.js, so index.js can swap stores with
//  a single env var change:
//
//    USE_DB=true  → PostgreSQL
//    (default)    → in-memory (original behaviour)
//
//  Usage in server/index.js:
//    const { userStore, matchStore } = require('./db/adapter');
// ═══════════════════════════════════════════════════════════

const db = require('./queries');

// ════════════════════════════════════════════════════════════
//  UserStore adapter (matches in-memory UserStore interface)
// ════════════════════════════════════════════════════════════
const pgUserStore = {
  // auth.js calls these -----------------------------------
  async create({ username, passwordHash, isGuest = false }) {
    return db.createUser({ username, passwordHash, isGuest });
  },

  async findById(id) {
    return db.findUserById(id);
  },

  async findByName(username) {
    return db.findUserByName(username);
  },

  // elo.js calls this -------------------------------------
  async updateRating(id, newRating, outcome = null) {
    return db.updateUserRating(id, newRating, outcome);
  },

  // REST API endpoint calls this --------------------------
  async leaderboard(limit = 100) {
    return db.getLeaderboard(limit);
  },

  // Session refresh ---------------------------------------
  async touch(id) {
    return db.touchUser(id);
  },
};

// ════════════════════════════════════════════════════════════
//  MatchStore adapter (matches in-memory MatchStore interface)
// ════════════════════════════════════════════════════════════
const pgMatchStore = {
  async save(record) {
    return db.saveMatch(record);
  },

  async get(matchId) {
    return db.getMatch(matchId);
  },

  async recent(limit = 20) {
    return db.recentMatches(limit);
  },

  async forUser(userId, limit = 50) {
    return db.matchesForUser(userId, limit);
  },
};

// ════════════════════════════════════════════════════════════
//  Export the right store depending on USE_DB env var
// ════════════════════════════════════════════════════════════
const USE_DB = process.env.USE_DB === 'true' || process.env.USE_DB === '1';

if (USE_DB) {
  // Verify DB connection and run migrations on startup
  db.healthCheck()
    .then(row => {
      console.log(`[DB] Connected ✓  PostgreSQL ${row.pg_version.split(' ')[1]}  time=${row.now}`);
      return db.migrate();
    })
    .catch(err => {
      console.error('[DB] Startup error:', err.message);
      console.error('[DB] Set DATABASE_URL or individual PG* env vars, or unset USE_DB to use in-memory stores.');
      process.exit(1);
    });
}

module.exports = {
  userStore:  USE_DB ? pgUserStore : null,   // null → caller falls back to in-memory
  matchStore: USE_DB ? pgMatchStore : null,
  isUsingDB:  USE_DB,
  db,   // direct access for deck queries etc.
};
