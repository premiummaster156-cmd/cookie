PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS codebase_files (
  path TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT 'text/plain',
  is_binary INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  github_sha TEXT,
  updated_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS codebase_revisions (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT 'text/plain',
  editor_email TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS codebase_members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'frontend-developer',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0
);

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

-- Older deployments may already have codebase_files without the deleted flag.
-- Keep this migration compatible with those databases.
ALTER TABLE codebase_files ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO codebase_settings (key,value,updated_at)
VALUES ('auto_review','1',strftime('%s','now'));
INSERT OR IGNORE INTO codebase_settings (key,value,updated_at)
VALUES ('auto_commit','0',strftime('%s','now'));
