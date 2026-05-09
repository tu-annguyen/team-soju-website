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
