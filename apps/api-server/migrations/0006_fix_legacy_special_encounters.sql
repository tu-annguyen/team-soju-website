UPDATE pokedex_encounters
SET is_special = 1,
    is_lure = 0,
    morning_rate = NULL,
    day_rate = NULL,
    night_rate = NULL
WHERE id IN (
  SELECT e.id
  FROM pokedex_encounters e
  JOIN pokedex_locations l ON l.id = e.location_id
  JOIN pokedex_species s ON s.id = e.species_id
  WHERE (e.is_lure = 1 AND l.region = 'Unova' AND e.season <> 'Any')
     OR e.method IN ('Dust Cloud', 'Shadow')
     OR LOWER(s.name) = 'feebas'
     OR (l.region = 'Unova' AND l.name = 'Marvelous Bridge' AND LOWER(s.name) = 'swanna')
);
