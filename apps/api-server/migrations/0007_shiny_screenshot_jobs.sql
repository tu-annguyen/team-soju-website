CREATE TABLE IF NOT EXISTS shiny_screenshot_jobs (
  id TEXT PRIMARY KEY,
  interaction_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'callback_pending', 'completed', 'failed')),
  storage_key TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  request_payload TEXT NOT NULL,
  callback_payload TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS idx_shiny_screenshot_jobs_status
  ON shiny_screenshot_jobs(status, updated_at);
