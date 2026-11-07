ALTER TABLE team_members ADD COLUMN timezone TEXT;

UPDATE team_members
SET timezone = (
  SELECT ts.catch_timezone
  FROM team_shinies ts
  WHERE ts.original_trainer = team_members.id
    AND ts.catch_timezone IS NOT NULL
    AND TRIM(ts.catch_timezone) <> ''
  ORDER BY ts.created_at DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM team_shinies ts
  WHERE ts.original_trainer = team_members.id
    AND ts.catch_timezone IS NOT NULL
    AND TRIM(ts.catch_timezone) <> ''
);
