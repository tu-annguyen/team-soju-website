ALTER TABLE pokedex_encounters ADD COLUMN is_special INTEGER NOT NULL DEFAULT 0
  CHECK (is_special IN (0, 1));

UPDATE pokedex_encounters
SET is_special = 1,
    is_lure = 0,
    morning_rate = NULL,
    day_rate = NULL,
    night_rate = NULL
WHERE method IN ('Dust Cloud', 'Shadow')
   OR species_id IN (
     SELECT id FROM pokedex_species WHERE LOWER(name) = 'feebas'
   );
