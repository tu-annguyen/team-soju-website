ALTER TABLE team_shinies ADD COLUMN caught_at_utc TEXT;
ALTER TABLE team_shinies ADD COLUMN war_eligibility_override INTEGER
  CHECK (war_eligibility_override IN (0, 1));

CREATE TABLE pokedex_species (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  family_key TEXT NOT NULL,
  tier TEXT NOT NULL,
  points INTEGER NOT NULL,
  catch_rate INTEGER
) STRICT;
CREATE INDEX idx_pokedex_species_family ON pokedex_species(family_key);

CREATE TABLE pokedex_locations (
  id TEXT PRIMARY KEY,
  region_id INTEGER NOT NULL,
  region TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  name TEXT NOT NULL
) STRICT;
CREATE INDEX idx_pokedex_locations_region_name ON pokedex_locations(region, name);

CREATE TABLE pokedex_encounters (
  id TEXT PRIMARY KEY,
  species_id INTEGER NOT NULL REFERENCES pokedex_species(id) ON DELETE CASCADE,
  form TEXT NOT NULL DEFAULT '',
  location_id TEXT NOT NULL REFERENCES pokedex_locations(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  season TEXT NOT NULL,
  min_level INTEGER NOT NULL,
  max_level INTEGER NOT NULL,
  horde_size INTEGER NOT NULL DEFAULT 0 CHECK (horde_size IN (0, 3, 5)),
  morning_rate REAL,
  day_rate REAL,
  night_rate REAL
) STRICT;
CREATE INDEX idx_pokedex_encounters_horde
  ON pokedex_encounters(horde_size, season, method, location_id);

CREATE TABLE shiny_war_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  seasons_json TEXT NOT NULL,
  season_days INTEGER NOT NULL DEFAULT 7,
  roster_locked INTEGER NOT NULL DEFAULT 0 CHECK (roster_locked IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;

INSERT INTO shiny_war_events (
  id, name, starts_at, ends_at, seasons_json, season_days
) VALUES (
  '2026', 'PokeMMO Shiny Wars 2026',
  '2026-08-01T00:00:00.000Z', '2026-08-29T00:00:00.000Z',
  '["Summer","Autumn","Winter","Spring"]', 7
);

CREATE TABLE shiny_war_participants (
  event_id TEXT NOT NULL REFERENCES shiny_war_events(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  added_by_user_id TEXT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (event_id, member_id)
) STRICT;

CREATE TABLE shiny_war_hunts (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES shiny_war_events(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  spot_key TEXT NOT NULL,
  target_family_key TEXT,
  label TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, member_id, position)
) STRICT;
CREATE INDEX idx_shiny_war_hunts_event_position
  ON shiny_war_hunts(event_id, position, member_id);
