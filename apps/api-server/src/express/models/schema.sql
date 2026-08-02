-- Database schema for Team Soju backend
-- Creates extensions (if necessary) and core tables used by the app

-- Use uuid generation function
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ign TEXT NOT NULL UNIQUE,
  discord_id TEXT UNIQUE,
  rank TEXT DEFAULT 'Trainer',
  notes TEXT,
  join_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true
);

-- Team shinies table
CREATE TABLE IF NOT EXISTS team_shinies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pokemon TEXT NOT NULL,
  variants TEXT NOT NULL DEFAULT '',
  national_number INTEGER NOT NULL,
  original_trainer UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  catch_date DATE DEFAULT CURRENT_DATE,
  total_encounters INTEGER DEFAULT 0,
  species_encounters INTEGER DEFAULT 0,
  encounter_type TEXT,
  location TEXT,
  nature TEXT,
  iv_hp INTEGER,
  iv_attack INTEGER,
  iv_defense INTEGER,
  iv_sp_attack INTEGER,
  iv_sp_defense INTEGER,
  iv_speed INTEGER,
  is_secret BOOLEAN DEFAULT false,
  is_alpha BOOLEAN DEFAULT false,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'Owned' CHECK (status IN ('Owned', 'Sold', 'Fled', 'Died', 'Bred')),
  notes TEXT,
  caught_at_utc TIMESTAMPTZ,
  catch_timezone TEXT,
  war_eligibility_override BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now());

ALTER TABLE team_shinies
  ADD COLUMN IF NOT EXISTS caught_at_utc TIMESTAMPTZ;

ALTER TABLE team_shinies
  ADD COLUMN IF NOT EXISTS catch_timezone TEXT;

ALTER TABLE team_shinies
  ADD COLUMN IF NOT EXISTS war_eligibility_override BOOLEAN;

ALTER TABLE team_shinies
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE team_shinies
SET status = CASE
  WHEN status IS NOT NULL THEN status
  WHEN LOWER(TRIM(COALESCE(notes, ''))) = 'failed' THEN 'Fled'
  ELSE 'Owned'
END;

ALTER TABLE team_shinies
  ALTER COLUMN status SET DEFAULT 'Owned';

ALTER TABLE team_shinies
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE team_shinies
  DROP CONSTRAINT IF EXISTS team_shinies_status_check;

ALTER TABLE team_shinies
  ADD CONSTRAINT team_shinies_status_check
  CHECK (status IN ('Owned', 'Sold', 'Fled', 'Died', 'Bred'));

ALTER TABLE team_shinies
  ADD COLUMN IF NOT EXISTS variants TEXT;

ALTER TABLE team_shinies
  ADD COLUMN IF NOT EXISTS is_alpha BOOLEAN DEFAULT false;

UPDATE team_shinies
SET is_alpha = false
WHERE is_alpha IS NULL;

ALTER TABLE team_shinies
  ALTER COLUMN is_alpha SET DEFAULT false;

ALTER TABLE team_shinies
  ALTER COLUMN is_alpha SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'team_shinies'
      AND column_name = 'variants'
      AND udt_name = '_text'
  ) THEN
    ALTER TABLE team_shinies
      ALTER COLUMN variants DROP DEFAULT;

    ALTER TABLE team_shinies
      ALTER COLUMN variants TYPE TEXT
      USING (
        CASE
          WHEN variants IS NULL OR cardinality(variants) = 0 THEN LOWER(TRIM(pokemon))
          ELSE LOWER(TRIM(variants[1]))
        END
      );
  END IF;
END $$;

UPDATE team_shinies
SET variants = LOWER(TRIM(pokemon))
WHERE variants IS NULL OR TRIM(variants) = '';

ALTER TABLE team_shinies
  ALTER COLUMN variants SET DEFAULT '';

ALTER TABLE team_shinies
  ALTER COLUMN variants SET NOT NULL;

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_team_shinies_trainer ON team_shinies(original_trainer);
CREATE INDEX IF NOT EXISTS idx_team_shinies_natno ON team_shinies(national_number);

-- Web app users
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  password_reset_expires_at TIMESTAMPTZ,
  password_reset_requested_at TIMESTAMPTZ,
  email_verification_token_hash TEXT,
  email_verification_expires_at TIMESTAMPTZ,
  email_verification_sent_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ,
  CONSTRAINT app_users_email_not_blank CHECK (btrim(email) <> ''),
  CONSTRAINT app_users_ign_not_blank CHECK (btrim(ign) <> '')
);

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS discord_username TEXT;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS discord_global_name TEXT;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS discord_avatar TEXT;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS auth_provider TEXT;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS password_reset_token_hash TEXT;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS password_reset_requested_at TIMESTAMPTZ;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE app_users
  ALTER COLUMN auth_provider SET DEFAULT 'password';

UPDATE app_users
SET auth_provider = CASE
  WHEN password_hash IS NOT NULL AND discord_id IS NOT NULL THEN 'password_discord'
  WHEN discord_id IS NOT NULL THEN 'discord'
  ELSE 'password'
END
WHERE auth_provider IS NULL
   OR auth_provider NOT IN ('password', 'discord', 'password_discord');

UPDATE app_users
SET email_verified_at = COALESCE(email_verified_at, created_at, now()),
    updated_at = now()
WHERE email_verified_at IS NULL
  AND email_verification_sent_at IS NULL;

ALTER TABLE app_users
  ALTER COLUMN auth_provider SET NOT NULL;

ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS app_users_auth_provider_check;

ALTER TABLE app_users
  ADD CONSTRAINT app_users_auth_provider_check
  CHECK (auth_provider IN ('password', 'discord', 'password_discord'));

ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS app_users_email_not_blank;

ALTER TABLE app_users
  ADD CONSTRAINT app_users_email_not_blank CHECK (btrim(email) <> '');

ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS app_users_ign_not_blank;

ALTER TABLE app_users
  ADD CONSTRAINT app_users_ign_not_blank CHECK (btrim(ign) <> '');

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

-- Feebas tile coordination cycles
CREATE TABLE IF NOT EXISTS feebas_cycles (
  id BIGSERIAL PRIMARY KEY,
  location TEXT NOT NULL,
  cycle_start TIMESTAMPTZ NOT NULL,
  cycle_end TIMESTAMPTZ NOT NULL,
  confirmed_tile_id TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location, cycle_start)
);

CREATE TABLE IF NOT EXISTS feebas_tile_states (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES feebas_cycles(id) ON DELETE CASCADE,
  tile_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unchecked'
    CHECK (status IN ('unchecked', 'checked', 'pending', 'confirmed')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by_name TEXT,
  updated_by_fingerprint TEXT,
  pending_reported_by_name TEXT,
  pending_reported_by_fingerprint TEXT,
  confirmed_by_name TEXT,
  confirmed_by_fingerprint TEXT,
  confirmed_at TIMESTAMPTZ,
  UNIQUE(cycle_id, tile_id)
);

CREATE INDEX IF NOT EXISTS idx_feebas_cycles_location_cycle_start
  ON feebas_cycles(location, cycle_start DESC);

CREATE INDEX IF NOT EXISTS idx_feebas_tile_states_cycle_id
  ON feebas_tile_states(cycle_id);

CREATE TABLE IF NOT EXISTS feebas_tile_votes (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES feebas_cycles(id) ON DELETE CASCADE,
  tile_id TEXT NOT NULL,
  actor_fingerprint TEXT NOT NULL,
  actor_name TEXT,
  status TEXT NOT NULL
    CHECK (status IN ('checked', 'pending', 'confirmed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cycle_id, tile_id, actor_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_feebas_tile_votes_cycle_id_tile_id
  ON feebas_tile_votes(cycle_id, tile_id);

CREATE TABLE IF NOT EXISTS feebas_activity_logs (
  id BIGSERIAL PRIMARY KEY,
  cycle_id BIGINT NOT NULL REFERENCES feebas_cycles(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  tile_id TEXT NOT NULL,
  tile_label TEXT NOT NULL,
  action_type TEXT NOT NULL,
  previous_status TEXT,
  next_status TEXT NOT NULL,
  actor_name TEXT,
  actor_fingerprint TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feebas_activity_logs_cycle_id_created_at
  ON feebas_activity_logs(cycle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feebas_activity_logs_actor_created_at
  ON feebas_activity_logs(actor_fingerprint, created_at DESC)
  WHERE actor_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_feebas_activity_logs_location_status_created_at
  ON feebas_activity_logs(location, next_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feebas_activity_logs_location_created_at_id
  ON feebas_activity_logs(location, created_at ASC, id ASC);

CREATE TABLE IF NOT EXISTS pokedex_species (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  family_key TEXT NOT NULL,
  tier TEXT NOT NULL,
  points INTEGER NOT NULL,
  catch_rate INTEGER
);

CREATE TABLE IF NOT EXISTS pokedex_locations (
  id TEXT PRIMARY KEY,
  region_id INTEGER NOT NULL,
  region TEXT NOT NULL,
  location_id INTEGER NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pokedex_encounters (
  id TEXT PRIMARY KEY,
  species_id INTEGER NOT NULL REFERENCES pokedex_species(id) ON DELETE CASCADE,
  form TEXT NOT NULL DEFAULT '',
  location_id TEXT NOT NULL REFERENCES pokedex_locations(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  season TEXT NOT NULL,
  min_level INTEGER NOT NULL,
  max_level INTEGER NOT NULL,
  horde_size INTEGER NOT NULL DEFAULT 0 CHECK (horde_size IN (0, 3, 5)),
  is_lure BOOLEAN NOT NULL DEFAULT false,
  is_special BOOLEAN NOT NULL DEFAULT false,
  morning_rate DOUBLE PRECISION,
  day_rate DOUBLE PRECISION,
  night_rate DOUBLE PRECISION
);

ALTER TABLE pokedex_encounters ADD COLUMN IF NOT EXISTS is_lure BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pokedex_encounters ADD COLUMN IF NOT EXISTS is_special BOOLEAN NOT NULL DEFAULT false;

UPDATE pokedex_encounters
SET is_lure = true,
    morning_rate = 5,
    day_rate = 5,
    night_rate = 5
WHERE morning_rate IS NULL
  AND day_rate IS NULL
  AND night_rate IS NULL;

UPDATE pokedex_encounters e
SET is_special = true,
    is_lure = false,
    morning_rate = NULL,
    day_rate = NULL,
    night_rate = NULL
FROM pokedex_locations l
WHERE l.id = e.location_id
  AND (
    (e.is_lure = true AND l.region = 'Unova' AND e.season <> 'Any')
    OR e.method IN ('Dust Cloud', 'Shadow')
    OR EXISTS (
      SELECT 1 FROM pokedex_species s
      WHERE s.id = e.species_id AND LOWER(s.name) = 'feebas'
    )
    OR (
      l.region = 'Unova'
      AND l.name = 'Marvelous Bridge'
      AND EXISTS (
        SELECT 1 FROM pokedex_species s
        WHERE s.id = e.species_id AND LOWER(s.name) = 'swanna'
      )
    )
  );

CREATE TABLE IF NOT EXISTS shiny_war_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  seasons_json TEXT NOT NULL,
  season_days INTEGER NOT NULL DEFAULT 7,
  roster_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO shiny_war_events (
  id, name, starts_at, ends_at, seasons_json, season_days
) VALUES (
  '2026', 'PokeMMO Shiny Wars 2026',
  '2026-08-01T00:00:00.000Z', '2026-08-29T00:00:00.000Z',
  '["Summer","Autumn","Winter","Spring"]', 7
) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS shiny_war_participants (
  event_id TEXT NOT NULL REFERENCES shiny_war_events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  added_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  team TEXT NOT NULL DEFAULT 'bidoof' CHECK (team IN ('bidoof', 'arceus')),
  is_official BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, member_id)
);

ALTER TABLE shiny_war_participants
  ADD COLUMN IF NOT EXISTS team TEXT NOT NULL DEFAULT 'bidoof'
  CHECK (team IN ('bidoof', 'arceus'));
ALTER TABLE shiny_war_participants
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS shiny_war_hunts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL REFERENCES shiny_war_events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  spot_key TEXT NOT NULL,
  target_family_key TEXT,
  label TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, member_id, position)
);

CREATE TABLE IF NOT EXISTS feebas_confirmed_tile_snapshots (
  id BIGSERIAL PRIMARY KEY,
  location TEXT NOT NULL,
  source_cycle_id BIGINT NOT NULL,
  cycle_start TIMESTAMPTZ NOT NULL,
  cycle_end TIMESTAMPTZ NOT NULL,
  tile_id TEXT NOT NULL,
  tile_label TEXT NOT NULL,
  confirmed_vote_count INTEGER NOT NULL,
  archived_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source_cycle_id, tile_id)
);

CREATE INDEX IF NOT EXISTS idx_feebas_confirmed_tile_snapshots_location_cycle_start
  ON feebas_confirmed_tile_snapshots(location, cycle_start DESC);
