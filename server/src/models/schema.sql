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
  join_date TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Team shinies table
CREATE TABLE IF NOT EXISTS team_shinies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  national_number INTEGER NOT NULL,
  original_trainer UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  catch_date TIMESTAMPTZ DEFAULT now(),
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
  is_safari BOOLEAN DEFAULT false,
  screenshot_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_team_shinies_trainer ON team_shinies(original_trainer);
CREATE INDEX IF NOT EXISTS idx_team_shinies_natno ON team_shinies(national_number);