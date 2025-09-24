-- Team Soju Database Schema

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Team Members table
CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ign VARCHAR(50) NOT NULL UNIQUE, -- In-game name
    discord_id VARCHAR(20) UNIQUE, -- Discord user ID
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    rank VARCHAR(20) NOT NULL DEFAULT 'Member',
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pokemon species reference table
CREATE TABLE IF NOT EXISTS pokemon_species (
    pokedex_number INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    sprite_url VARCHAR(255),
    shiny_sprite_url VARCHAR(255),
    generation INTEGER,
    type1 VARCHAR(20),
    type2 VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Team shinies table
CREATE TABLE IF NOT EXISTS team_shinies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pokedex_number INTEGER NOT NULL REFERENCES pokemon_species(pokedex_number),
    original_trainer UUID NOT NULL REFERENCES team_members(id),
    catch_date DATE NOT NULL,
    total_encounters INTEGER DEFAULT 0,
    species_encounters INTEGER DEFAULT 0,
    encounter_type VARCHAR(30) NOT NULL, -- 'wild', 'horde', 'safari', 'fishing', 'egg', 'gift', etc.
    location VARCHAR(100),
    
    -- Pokemon stats
    level_caught INTEGER,
    nature VARCHAR(20),
    ability VARCHAR(30),
    
    -- IVs (Individual Values)
    iv_hp INTEGER CHECK (iv_hp >= 0 AND iv_hp <= 31),
    iv_attack INTEGER CHECK (iv_attack >= 0 AND iv_attack <= 31),
    iv_defense INTEGER CHECK (iv_defense >= 0 AND iv_defense <= 31),
    iv_sp_attack INTEGER CHECK (iv_sp_attack >= 0 AND iv_sp_attack <= 31),
    iv_sp_defense INTEGER CHECK (iv_sp_defense >= 0 AND iv_sp_defense <= 31),
    iv_speed INTEGER CHECK (iv_speed >= 0 AND iv_speed <= 31),
    
    -- Additional metadata
    is_secret BOOLEAN DEFAULT false, -- Secret shiny indicator
    is_safari BOOLEAN DEFAULT false, -- Safari shiny indicator
    screenshot_url VARCHAR(255),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Events table for tracking team events
CREATE TABLE IF NOT EXISTS team_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    event_type VARCHAR(30) NOT NULL, -- 'bingo', 'tournament', 'hunt', 'anniversary', etc.
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Event participants table
CREATE TABLE IF NOT EXISTS event_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES team_events(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    team_name VARCHAR(50), -- For team-based events
    score INTEGER DEFAULT 0,
    position INTEGER,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, member_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_team_shinies_ot ON team_shinies(original_trainer);
CREATE INDEX IF NOT EXISTS idx_team_shinies_pokemon ON team_shinies(pokedex_number);
CREATE INDEX IF NOT EXISTS idx_team_shinies_date ON team_shinies(catch_date);
CREATE INDEX IF NOT EXISTS idx_team_members_ign ON team_members(ign);
CREATE INDEX IF NOT EXISTS idx_team_members_discord ON team_members(discord_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);

-- Triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_team_members_updated_at 
    BEFORE UPDATE ON team_members 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_shinies_updated_at 
    BEFORE UPDATE ON team_shinies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();