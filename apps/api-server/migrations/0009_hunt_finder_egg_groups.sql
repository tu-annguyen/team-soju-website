ALTER TABLE pokedex_species ADD COLUMN egg_groups_json TEXT NOT NULL DEFAULT '[]'
  CHECK (json_valid(egg_groups_json));
