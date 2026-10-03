PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS codebase_reviews (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'needs_changes',
  risk TEXT NOT NULL DEFAULT 'unknown',
  summary TEXT NOT NULL DEFAULT '',
  findings_json TEXT NOT NULL DEFAULT '[]',
  checks_json TEXT NOT NULL DEFAULT '[]',
  diff_hash TEXT NOT NULL DEFAULT '',
  base_sha TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  commit_sha TEXT,
  deployment_status TEXT NOT NULL DEFAULT 'not_started'
);
CREATE INDEX IF NOT EXISTS idx_codebase_reviews_updated ON codebase_reviews(updated_at DESC);

CREATE TABLE IF NOT EXISTS codebase_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

ALTER TABLE codebase_files ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO codebase_settings (key,value,updated_at)
VALUES ('auto_review','1',strftime('%s','now'));
INSERT OR IGNORE INTO codebase_settings (key,value,updated_at)
VALUES ('auto_commit','0',strftime('%s','now'));
