-- D&D Charakterbogen: Datenbank-Migration
-- Einmalig ausführen: psql $DATABASE_URL -f SERVER_DB_MIGRATION.sql

CREATE TABLE IF NOT EXISTS dnd_characters (
  id          TEXT        NOT NULL,
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,
  is_shared   BOOLEAN     DEFAULT false,
  shared_at   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dnd_chars_user    ON dnd_characters (user_id);
CREATE INDEX IF NOT EXISTS idx_dnd_chars_shared  ON dnd_characters (is_shared) WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_dnd_chars_updated ON dnd_characters (updated_at DESC);
