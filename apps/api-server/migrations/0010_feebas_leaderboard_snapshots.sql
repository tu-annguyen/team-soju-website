CREATE TABLE IF NOT EXISTS feebas_leaderboard_snapshots (
  scope TEXT PRIMARY KEY,
  locations_json TEXT NOT NULL,
  generated_at TEXT,
  weekly_since TEXT,
  next_weekly_expiration TEXT,
  source_activity_id INTEGER,
  dirty INTEGER NOT NULL DEFAULT 1 CHECK (dirty IN (0, 1)),
  refresh_lease_until TEXT,
  entries_json TEXT CHECK (entries_json IS NULL OR json_valid(entries_json))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_feebas_leaderboard_snapshots_refresh
  ON feebas_leaderboard_snapshots(dirty, next_weekly_expiration, refresh_lease_until);
