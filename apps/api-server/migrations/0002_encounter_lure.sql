ALTER TABLE pokedex_encounters ADD COLUMN is_lure INTEGER NOT NULL DEFAULT 0
  CHECK (is_lure IN (0, 1));

UPDATE pokedex_encounters
SET is_lure = 1,
    morning_rate = 5,
    day_rate = 5,
    night_rate = 5
WHERE morning_rate IS NULL
  AND day_rate IS NULL
  AND night_rate IS NULL;
