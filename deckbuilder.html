'use strict';
// ═══════════════════════════════════════════════════════════
//  HexForge DB Queries  —  server/db/queries.js
//
//  Drop-in replacement for the in-memory UserStore + MatchStore.
//  Uses `pg` (node-postgres) with a connection pool.
//
//  Required env vars:
//    DATABASE_URL   postgresql://user:pass@host:5432/hexforge
//  OR individual:
//    PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
//
//  Run database/schema.sql first to create tables.
// ═══════════════════════════════════════════════════════════

const { Pool } = require('pg');

// ── Connection pool ───────────────────────────────────────
let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // fallback to individual env vars (pg reads them automatically)
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

async function query(sql, params = []) {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// ════════════════════════════════════════════════════════════
//  USER QUERIES
//  Mirrors the in-memory UserStore API used by auth.js
// ════════════════════════════════════════════════════════════

/**
 * Create a new user row.
 * @param {{ username, passwordHash, isGuest }} opts
 * @returns {Promise<object>} user row
 */
async function createUser({ username, passwordHash, isGuest = false }) {
  const sql = `
    INSERT INTO users (username, password_hash, is_guest)
    VALUES ($1, $2, $3)
    RETURNING id, username, password_hash AS "passwordHash",
              is_guest AS "isGuest", rating, wins, losses, created_at AS "createdAt"
  `;
  const { rows } = await query(sql, [username, passwordHash || null, isGuest]);
  return rows[0];
}

/**
 * Find user by id.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
async function findUserById(id) {
  const { rows } = await query(
    `SELECT id, username, password_hash AS "passwordHash",
            is_guest AS "isGuest", rating, wins, losses
     FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Find user by username (case-insensitive).
 * @param {string} username
 * @returns {Promise<object|null>}
 */
async function findUserByName(username) {
  const { rows } = await query(
    `SELECT id, username, password_hash AS "passwordHash",
            is_guest AS "isGuest", rating, wins, losses
     FROM users WHERE LOWER(username) = LOWER($1)`,
    [username]
  );
  return rows[0] || null;
}

/**
 * Update a user's ELO rating and win/loss record.
 * @param {number} id
 * @param {number} newRating
 * @param {'win'|'loss'|null} outcome
 * @returns {Promise<object>} updated user row
 */
async function updateUserRating(id, newRating, outcome = null) {
  let sql;
  if (outcome === 'win') {
    sql = `UPDATE users SET rating=$1, wins=wins+1, last_seen_at=NOW()
           WHERE id=$2 RETURNING id, username, rating, wins, losses`;
  } else if (outcome === 'loss') {
    sql = `UPDATE users SET rating=$1, losses=losses+1, last_seen_at=NOW()
           WHERE id=$2 RETURNING id, username, rating, wins, losses`;
  } else {
    sql = `UPDATE users SET rating=$1, last_seen_at=NOW()
           WHERE id=$2 RETURNING id, username, rating, wins, losses`;
  }
  const { rows } = await query(sql, [newRating, id]);
  return rows[0];
}

/**
 * Touch last_seen_at for a user.
 * @param {number} id
 */
async function touchUser(id) {
  await query(`UPDATE users SET last_seen_at=NOW() WHERE id=$1`, [id]);
}

/**
 * Top N ranked players.
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
async function getLeaderboard(limit = 100) {
  const { rows } = await query(
    `SELECT id, username, rating, wins, losses,
            CASE WHEN wins+losses > 0
              THEN ROUND(100.0*wins/(wins+losses), 1)
              ELSE 0
            END AS winrate,
            RANK() OVER (ORDER BY rating DESC) AS rank
     FROM users
     WHERE is_guest = FALSE
     ORDER BY rating DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

// ════════════════════════════════════════════════════════════
//  MATCH QUERIES
//  Mirrors the in-memory MatchStore API used by elo.js
// ════════════════════════════════════════════════════════════

/**
 * Save a completed match record (with full action log for replay).
 * @param {object} record   — shaped like processMatchResult output
 * @returns {Promise<object>} saved match row
 */
async function saveMatch(record) {
  const sql = `
    INSERT INTO matches (
      id, player_a_id, player_b_id,
      player_a_name, player_b_name,
      winner, rating_a_before, rating_b_before,
      elo_delta_a, elo_delta_b, ranked,
      actions, duration_secs
    ) VALUES (
      $1, $2, $3,
      $4, $5,
      $6, $7, $8,
      $9, $10, $11,
      $12::jsonb, $13
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING *
  `;
  const { rows } = await query(sql, [
    record.matchId,
    record.playerAId   || null,
    record.playerBId   || null,
    record.playerAName,
    record.playerBName,
    record.winner      || null,
    record.ratingABefore,
    record.ratingBBefore,
    record.eloDeltaA   || 0,
    record.eloDeltaB   || 0,
    record.ranked      !== false,
    JSON.stringify(record.actions || []),
    record.durationSecs || null,
  ]);
  return rows[0];
}

/**
 * Get a match by id (for replay).
 * @param {string} matchId  UUID
 * @returns {Promise<object|null>}
 */
async function getMatch(matchId) {
  const { rows } = await query(
    `SELECT *, actions AS "actions"
     FROM matches WHERE id = $1`,
    [matchId]
  );
  if (!rows[0]) return null;
  const m = rows[0];
  // actions stored as JSONB — already parsed by pg driver
  return m;
}

/**
 * Recent matches (for lobby feed).
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
async function recentMatches(limit = 20) {
  const { rows } = await query(
    `SELECT id, player_a_name AS "playerAName", player_b_name AS "playerBName",
            winner, elo_delta_a AS "eloDeltaA", elo_delta_b AS "eloDeltaB",
            duration_secs AS "durationSecs", created_at AS "createdAt"
     FROM matches
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

/**
 * Match history for a specific user.
 * @param {number} userId
 * @param {number} limit
 * @returns {Promise<object[]>}
 */
async function matchesForUser(userId, limit = 50) {
  const { rows } = await query(
    `SELECT id, player_a_name AS "playerAName", player_b_name AS "playerBName",
            winner, elo_delta_a AS "eloDeltaA", elo_delta_b AS "eloDeltaB",
            ranked, duration_secs AS "durationSecs", created_at AS "createdAt"
     FROM matches
     WHERE player_a_id = $1 OR player_b_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows;
}

// ════════════════════════════════════════════════════════════
//  DECK QUERIES
// ════════════════════════════════════════════════════════════

/**
 * Get all decks for a user.
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
async function getDecksForUser(userId) {
  const { rows } = await query(
    `SELECT id, name, cards, archetype, is_default AS "isDefault", updated_at AS "updatedAt"
     FROM decks WHERE user_id = $1 ORDER BY is_default DESC, updated_at DESC`,
    [userId]
  );
  return rows;
}

/**
 * Save or update a deck.
 * @param {{ userId, deckId?, name, cards, archetype, isDefault }} opts
 * @returns {Promise<object>}
 */
async function saveDeck({ userId, deckId, name, cards, archetype, isDefault = false }) {
  if (deckId) {
    // Update existing
    const { rows } = await query(
      `UPDATE decks SET name=$1, cards=$2::jsonb, archetype=$3, is_default=$4, updated_at=NOW()
       WHERE id=$5 AND user_id=$6
       RETURNING id, name, cards, archetype, is_default AS "isDefault"`,
      [name, JSON.stringify(cards), archetype || null, isDefault, deckId, userId]
    );
    return rows[0];
  } else {
    // Insert new
    const { rows } = await query(
      `INSERT INTO decks (user_id, name, cards, archetype, is_default)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING id, name, cards, archetype, is_default AS "isDefault"`,
      [userId, name, JSON.stringify(cards), archetype || null, isDefault]
    );
    return rows[0];
  }
}

/**
 * Delete a deck.
 * @param {number} deckId
 * @param {number} userId   (ensures ownership)
 */
async function deleteDeck(deckId, userId) {
  await query(`DELETE FROM decks WHERE id=$1 AND user_id=$2`, [deckId, userId]);
}

/**
 * Get a user's default deck cards array.
 * Returns null if none saved.
 * @param {number} userId
 * @returns {Promise<string[]|null>}
 */
async function getDefaultDeck(userId) {
  const { rows } = await query(
    `SELECT cards FROM decks WHERE user_id=$1 AND is_default=TRUE LIMIT 1`,
    [userId]
  );
  return rows[0] ? rows[0].cards : null;
}

// ════════════════════════════════════════════════════════════
//  HEALTH CHECK
// ════════════════════════════════════════════════════════════

async function healthCheck() {
  const { rows } = await query(`SELECT NOW() AS now, version() AS pg_version`);
  return rows[0];
}

// ── Graceful shutdown ─────────────────────────────────────
process.on('SIGTERM', async () => {
  if (pool) await pool.end();
});

// ═══════════════════════════════════════════════════════════
module.exports = {
  // Users
  createUser,
  findUserById,
  findUserByName,
  updateUserRating,
  touchUser,
  getLeaderboard,
  // Matches
  saveMatch,
  getMatch,
  recentMatches,
  matchesForUser,
  // Decks
  getDecksForUser,
  saveDeck,
  deleteDeck,
  getDefaultDeck,
  // Util
  healthCheck,
  query, // escape hatch for custom queries
};
