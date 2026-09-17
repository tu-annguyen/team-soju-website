CREATE TABLE IF NOT EXISTS hunt_spots (
  spot_key TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  location TEXT NOT NULL,
  method TEXT NOT NULL,
  season TEXT NOT NULL,
  time TEXT NOT NULL,
  horde_size INTEGER NOT NULL,
  is_lure INTEGER NOT NULL CHECK (is_lure IN (0, 1)),
  is_special INTEGER NOT NULL CHECK (is_special IN (0, 1)),
  average_points REAL NOT NULL,
  points_per_hour REAL,
  exp_per_hour REAL,
  spot_json TEXT NOT NULL CHECK (json_valid(spot_json))
) STRICT;

CREATE TABLE IF NOT EXISTS hunt_spot_species (
  spot_key TEXT NOT NULL REFERENCES hunt_spots(spot_key) ON DELETE CASCADE,
  species_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  family_key TEXT NOT NULL,
  tier_number INTEGER,
  min_level INTEGER NOT NULL,
  split REAL NOT NULL,
  ev_hp INTEGER NOT NULL,
  ev_attack INTEGER NOT NULL,
  ev_defense INTEGER NOT NULL,
  ev_sp_attack INTEGER NOT NULL,
  ev_sp_defense INTEGER NOT NULL,
  ev_speed INTEGER NOT NULL,
  egg_groups_json TEXT NOT NULL CHECK (json_valid(egg_groups_json)),
  PRIMARY KEY (spot_key, species_id)
) STRICT;

CREATE TABLE IF NOT EXISTS hunt_spot_egg_groups (
  spot_key TEXT NOT NULL REFERENCES hunt_spots(spot_key) ON DELETE CASCADE,
  egg_group TEXT NOT NULL,
  PRIMARY KEY (spot_key, egg_group)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_hunt_spots_common
  ON hunt_spots(method, season, region, horde_size, time);
CREATE INDEX IF NOT EXISTS idx_hunt_spots_points
  ON hunt_spots(points_per_hour DESC, average_points DESC);
CREATE INDEX IF NOT EXISTS idx_hunt_spots_exp
  ON hunt_spots(exp_per_hour DESC);
CREATE INDEX IF NOT EXISTS idx_hunt_spot_species_name
  ON hunt_spot_species(name, spot_key);
CREATE INDEX IF NOT EXISTS idx_hunt_spot_species_family
  ON hunt_spot_species(family_key, spot_key);
CREATE INDEX IF NOT EXISTS idx_hunt_spot_species_tier_level
  ON hunt_spot_species(tier_number, min_level, spot_key);
CREATE INDEX IF NOT EXISTS idx_hunt_spot_egg_groups_group
  ON hunt_spot_egg_groups(egg_group, spot_key);
