-- ═══════════════════════════════════════════════════════════
--  HexForge Database Schema
--  PostgreSQL 15+
--  Run: psql -d hexforge -f schema.sql
-- ═══════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(32)  UNIQUE NOT NULL,
  password_hash VARCHAR(255),                 -- NULL for guests
  is_guest      BOOLEAN      DEFAULT FALSE,
  rating        INTEGER      DEFAULT 1000,
  wins          INTEGER      DEFAULT 0,
  losses        INTEGER      DEFAULT 0,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_rating ON users(rating DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(LOWER(username));

-- ── Matches ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  player_b_id     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  player_a_name   VARCHAR(32)  NOT NULL,
  player_b_name   VARCHAR(32)  NOT NULL,
  winner          CHAR(1),                   -- 'A' | 'B' | NULL (abandoned)
  rating_a_before INTEGER,
  rating_b_before INTEGER,
  elo_delta_a     INTEGER      DEFAULT 0,
  elo_delta_b     INTEGER      DEFAULT 0,
  ranked          BOOLEAN      DEFAULT TRUE,
  actions         JSONB        NOT NULL DEFAULT '[]',  -- full replay log
  duration_secs   INTEGER,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_player_a ON matches(player_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_player_b ON matches(player_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_created  ON matches(created_at DESC);

-- ── Decks ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decks (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(64) NOT NULL,
  cards      JSONB       NOT NULL,           -- string[]
  archetype  VARCHAR(32),
  is_default BOOLEAN     DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);

-- ── Leaderboard view ─────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  id, username, rating, wins, losses,
  CASE WHEN wins + losses > 0
    THEN ROUND(100.0 * wins / (wins + losses), 1)
    ELSE 0
  END AS winrate,
  RANK() OVER (ORDER BY rating DESC) AS rank
FROM users
WHERE is_guest = FALSE
ORDER BY rating DESC;

-- ── Recent matches view ───────────────────────────────────
CREATE OR REPLACE VIEW recent_matches AS
SELECT
  m.id,
  m.player_a_name, m.player_b_name,
  m.winner,
  m.elo_delta_a, m.elo_delta_b,
  m.ranked,
  m.duration_secs,
  m.created_at
FROM matches m
ORDER BY m.created_at DESC;
