PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS catch_events (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  owner_ign TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  event_date TEXT NOT NULL,
  start_local TEXT NOT NULL,
  end_local TEXT NOT NULL,
  timezone TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova')),
  route TEXT NOT NULL,
  winner_count INTEGER NOT NULL DEFAULT 4 CHECK (winner_count BETWEEN 1 AND 10),
  targets_json TEXT NOT NULL DEFAULT '[]',
  species_bonuses_json TEXT NOT NULL DEFAULT '[]',
  species_penalties_json TEXT NOT NULL DEFAULT '[]',
  nature_bonuses_json TEXT NOT NULL DEFAULT '[]',
  nature_penalties_json TEXT NOT NULL DEFAULT '[]',
  use_lowest_score_final_place INTEGER NOT NULL DEFAULT 1 CHECK (use_lowest_score_final_place IN (0, 1)),
  is_leaderboard_published INTEGER NOT NULL DEFAULT 0 CHECK (is_leaderboard_published IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (trim(name) <> ''),
  CHECK (trim(route) <> '')
) STRICT;

CREATE INDEX IF NOT EXISTS idx_catch_events_owner_created_at
  ON catch_events(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catch_events_published_created_at
  ON catch_events(is_leaderboard_published, created_at DESC);

CREATE TABLE IF NOT EXISTS catch_event_submissions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES catch_events(id) ON DELETE CASCADE,
  player_ign TEXT NOT NULL,
  species TEXT NOT NULL,
  nature TEXT NOT NULL,
  total_iv INTEGER NOT NULL CHECK (total_iv BETWEEN 0 AND 186),
  catch_local TEXT NOT NULL,
  timezone TEXT NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova')),
  route TEXT NOT NULL,
  catch_utc TEXT NOT NULL,
  score INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs-review'
    CHECK (status IN ('valid', 'needs-review', 'invalid', 'disqualified')),
  flags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (trim(player_ign) <> ''),
  CHECK (trim(route) <> ''),
  UNIQUE(event_id, player_ign COLLATE NOCASE)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_catch_event_submissions_event_score
  ON catch_event_submissions(event_id, score DESC, catch_utc ASC);

CREATE TABLE IF NOT EXISTS catch_event_submission_screenshots (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES catch_event_submissions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  public_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (trim(file_name) <> ''),
  CHECK (trim(storage_key) <> '')
) STRICT;

CREATE INDEX IF NOT EXISTS idx_catch_event_submission_screenshots_submission
  ON catch_event_submission_screenshots(submission_id, created_at ASC);
