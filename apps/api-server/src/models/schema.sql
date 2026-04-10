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
  created_at TIMESTAMPTZ DEFAULT now());

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
