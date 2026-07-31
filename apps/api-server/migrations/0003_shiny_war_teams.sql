ALTER TABLE shiny_war_participants ADD COLUMN team TEXT NOT NULL DEFAULT 'bidoof'
  CHECK (team IN ('bidoof', 'arceus'));

ALTER TABLE shiny_war_participants ADD COLUMN is_official INTEGER NOT NULL DEFAULT 1
  CHECK (is_official IN (0, 1));
