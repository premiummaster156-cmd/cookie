PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS codebase_members (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'developer',
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS codebase_files (
  path TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT 'text/plain',
  is_binary INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL DEFAULT 0,
  github_sha TEXT,
  updated_by TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_codebase_files_updated ON codebase_files(updated_at DESC);

CREATE TABLE IF NOT EXISTS codebase_revisions (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  mime TEXT NOT NULL DEFAULT 'text/plain',
  editor_email TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_codebase_revisions_path ON codebase_revisions(path, created_at DESC);

INSERT OR IGNORE INTO codebase_members (id,email,role,active,created_at,updated_at)
VALUES ('cookie-owner','cookie.ai.noreply@gmail.com','owner',1,strftime('%s','now'),strftime('%s','now'));