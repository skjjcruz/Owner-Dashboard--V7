-- ============================================================
-- Migration 001: Draft board state + mock draft prospects
-- Run this in your Supabase project via SQL Editor or CLI
-- ============================================================

-- ----------------------------------------------------------------
-- Table: mock_draft_prospects
-- Mirrors data/mock_draft_db.csv
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mock_draft_prospects (
  id          SERIAL PRIMARY KEY,
  rank        INTEGER NOT NULL,
  player_name TEXT    NOT NULL,
  position    TEXT    NOT NULL,
  college     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint so we can upsert by rank
ALTER TABLE mock_draft_prospects
  ADD CONSTRAINT mock_draft_prospects_rank_unique UNIQUE (rank);

-- Index for quick position filtering
CREATE INDEX IF NOT EXISTS idx_mock_draft_position
  ON mock_draft_prospects (position);

-- ----------------------------------------------------------------
-- Table: draft_boards
-- Stores saved draft board state keyed by Sleeper draft_id
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS draft_boards (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sleeper_draft_id TEXT        UNIQUE,          -- Sleeper draft_id (null for custom boards)
  sleeper_username TEXT,
  league_id        TEXT,
  draft_year       TEXT,
  board_name       TEXT,                        -- optional user-defined label
  picks            JSONB       NOT NULL DEFAULT '{}',
  num_teams        INTEGER     NOT NULL DEFAULT 16,
  num_rounds       INTEGER     NOT NULL DEFAULT 7,
  draft_type       TEXT        NOT NULL DEFAULT 'linear',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for username-based lookups
CREATE INDEX IF NOT EXISTS idx_draft_boards_username
  ON draft_boards (sleeper_username);

CREATE INDEX IF NOT EXISTS idx_draft_boards_league
  ON draft_boards (league_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_draft_boards_updated_at ON draft_boards;
CREATE TRIGGER set_draft_boards_updated_at
  BEFORE UPDATE ON draft_boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------
-- Row-Level Security (RLS)
-- The anon key has read access to both tables.
-- Write access to draft_boards is unrestricted (anon can save/update)
-- since the app has no auth system yet.
-- Tighten these policies once you add Supabase Auth.
-- ----------------------------------------------------------------

ALTER TABLE mock_draft_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_boards         ENABLE ROW LEVEL SECURITY;

-- Anyone can read mock draft prospects
CREATE POLICY "Public read mock_draft_prospects"
  ON mock_draft_prospects FOR SELECT
  USING (true);

-- Anyone can read draft boards
CREATE POLICY "Public read draft_boards"
  ON draft_boards FOR SELECT
  USING (true);

-- Anyone can insert/update draft boards (no auth yet)
CREATE POLICY "Public write draft_boards"
  ON draft_boards FOR ALL
  USING (true)
  WITH CHECK (true);
