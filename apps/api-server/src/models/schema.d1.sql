PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  ign TEXT NOT NULL UNIQUE,
  discord_id TEXT UNIQUE,
  rank TEXT NOT NULL DEFAULT 'Trainer',
  notes TEXT,
  join_date TEXT NOT NULL DEFAULT (date('now')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
) STRICT;

CREATE TABLE IF NOT EXISTS team_shinies (
  id TEXT PRIMARY KEY,
  pokemon TEXT NOT NULL,
  variants TEXT NOT NULL DEFAULT '',
  national_number INTEGER NOT NULL,
  original_trainer TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  catch_date TEXT NOT NULL DEFAULT (date('now')),
  total_encounters INTEGER NOT NULL DEFAULT 0,
  species_encounters INTEGER NOT NULL DEFAULT 0,
  encounter_type TEXT,
  location TEXT,
  nature TEXT,
  iv_hp INTEGER,
  iv_attack INTEGER,
  iv_defense INTEGER,
  iv_sp_attack INTEGER,
  iv_sp_defense INTEGER,
  iv_speed INTEGER,
  is_secret INTEGER NOT NULL DEFAULT 0 CHECK (is_secret IN (0, 1)),
  is_alpha INTEGER NOT NULL DEFAULT 0 CHECK (is_alpha IN (0, 1)),
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'Owned' CHECK (status IN ('Owned', 'Sold', 'Fled', 'Died', 'Bred')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_team_shinies_trainer ON team_shinies(original_trainer);
CREATE INDEX IF NOT EXISTS idx_team_shinies_natno ON team_shinies(national_number);

CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT,
  ign TEXT NOT NULL,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  discord_global_name TEXT,
  discord_avatar TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'password'
    CHECK (auth_provider IN ('password', 'discord', 'password_discord')),
  password_reset_token_hash TEXT,
  password_reset_expires_at TEXT,
  password_reset_requested_at TEXT,
  email_verification_token_hash TEXT,
  email_verification_expires_at TEXT,
  email_verification_sent_at TEXT,
  email_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  CHECK (trim(email) <> ''),
  CHECK (trim(ign) <> '')
) STRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_lower
  ON app_users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_ign_lower
  ON app_users (LOWER(ign));

CREATE INDEX IF NOT EXISTS idx_app_users_discord_id
  ON app_users(discord_id);

CREATE INDEX IF NOT EXISTS idx_app_users_password_reset_token_hash
  ON app_users(password_reset_token_hash)
  WHERE password_reset_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_email_verification_token_hash
  ON app_users(email_verification_token_hash)
  WHERE email_verification_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS feebas_cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location TEXT NOT NULL,
  cycle_start TEXT NOT NULL,
  cycle_end TEXT NOT NULL,
  confirmed_tile_id TEXT,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(location, cycle_start)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_feebas_cycles_location_cycle_start
  ON feebas_cycles(location, cycle_start DESC);

CREATE TABLE IF NOT EXISTS feebas_tile_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES feebas_cycles(id) ON DELETE CASCADE,
  tile_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unchecked'
    CHECK (status IN ('unchecked', 'checked', 'pending', 'confirmed')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by_name TEXT,
  updated_by_fingerprint TEXT,
  pending_reported_by_name TEXT,
  pending_reported_by_fingerprint TEXT,
  confirmed_by_name TEXT,
  confirmed_by_fingerprint TEXT,
  confirmed_at TEXT,
  UNIQUE(cycle_id, tile_id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_feebas_tile_states_cycle_id
  ON feebas_tile_states(cycle_id);

CREATE TABLE IF NOT EXISTS feebas_tile_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES feebas_cycles(id) ON DELETE CASCADE,
  tile_id TEXT NOT NULL,
  actor_fingerprint TEXT NOT NULL,
  actor_name TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('checked', 'pending', 'confirmed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cycle_id, tile_id, actor_fingerprint)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_feebas_tile_votes_cycle_id_tile_id
  ON feebas_tile_votes(cycle_id, tile_id);

CREATE TABLE IF NOT EXISTS feebas_activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES feebas_cycles(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  tile_id TEXT NOT NULL,
  tile_label TEXT NOT NULL,
  action_type TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  actor_name TEXT,
  actor_fingerprint TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_feebas_activity_logs_cycle_id_created_at
  ON feebas_activity_logs(cycle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feebas_activity_logs_actor_created_at
  ON feebas_activity_logs(actor_fingerprint, created_at DESC)
  WHERE actor_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feebas_activity_logs_location_status_created_at
  ON feebas_activity_logs(location, next_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feebas_activity_logs_location_created_at_id
  ON feebas_activity_logs(location, created_at ASC, id ASC);

CREATE TABLE IF NOT EXISTS feebas_confirmed_tile_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  location TEXT NOT NULL,
  source_cycle_id INTEGER NOT NULL,
  cycle_start TEXT NOT NULL,
  cycle_end TEXT NOT NULL,
  tile_id TEXT NOT NULL,
  tile_label TEXT NOT NULL,
  confirmed_vote_count INTEGER NOT NULL,
  archived_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_cycle_id, tile_id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_feebas_confirmed_tile_snapshots_location_cycle_start
  ON feebas_confirmed_tile_snapshots(location, cycle_start DESC);

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
  is_private INTEGER NOT NULL DEFAULT 1 CHECK (is_private IN (0, 1)),
  submissions_closed INTEGER NOT NULL DEFAULT 0 CHECK (submissions_closed IN (0, 1)),
  auto_check_enabled INTEGER NOT NULL DEFAULT 0 CHECK (auto_check_enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (trim(name) <> ''),
  CHECK (trim(route) <> '')
) STRICT;

CREATE INDEX IF NOT EXISTS idx_catch_events_owner_created_at
  ON catch_events(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catch_events_published_created_at
  ON catch_events(is_leaderboard_published, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_catch_events_private_created_at
  ON catch_events(is_private, created_at DESC);

CREATE TABLE IF NOT EXISTS catch_event_collaborators (
  event_id TEXT NOT NULL REFERENCES catch_events(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'co-host' CHECK (role IN ('co-host')),
  created_by_user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, user_id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_catch_event_collaborators_user_created_at
  ON catch_event_collaborators(user_id, created_at DESC);

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
  status TEXT NOT NULL DEFAULT 'pending-verification'
    CHECK (status IN ('pending-verification', 'auto-checked', 'needs-review', 'verified', 'rejected', 'disqualified')),
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
