import { neon } from "@neondatabase/serverless";

const schemaPromises = new Map();

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL DEFAULT '',
    username TEXT NOT NULL UNIQUE,
    avatar_url TEXT NOT NULL DEFAULT '',
    password_hash TEXT,
    password_salt TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    credits_remaining INTEGER NOT NULL DEFAULT 100,
    login_failures INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    provider_email TEXT,
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0,
    UNIQUE(provider, provider_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at BIGINT NOT NULL DEFAULT 0,
    expires_at BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS email_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'signup',
    code_hash TEXT,
    token_hash TEXT UNIQUE,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at BIGINT NOT NULL DEFAULT 0,
    used_at BIGINT,
    created_at BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0,
    UNIQUE(user_id, key)
  )`,
  `CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New chat',
    model TEXT NOT NULL DEFAULT 'standard',
    temporary INTEGER NOT NULL DEFAULT 0,
    pinned INTEGER NOT NULL DEFAULT 0,
    archived INTEGER NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0,
    created_at BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user','assistant')),
    content TEXT NOT NULL,
    created_at BIGINT NOT NULL DEFAULT 0,
    position INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS project_files (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT 'text/plain',
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0,
    UNIQUE(project_id, path)
  )`,
  `CREATE TABLE IF NOT EXISTS usage_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT '',
    units INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS shared_chats (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Shared chat',
    payload TEXT NOT NULL DEFAULT '{}',
    created_at BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS codebase_members (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'developer',
    active INTEGER NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS codebase_files (
    path TEXT PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT 'text/plain',
    is_binary INTEGER NOT NULL DEFAULT 0,
    size INTEGER NOT NULL DEFAULT 0,
    github_sha TEXT,
    updated_by TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    dirty INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS codebase_revisions (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT 'text/plain',
    editor_email TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS codebase_reviews (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'needs_changes',
    risk TEXT NOT NULL DEFAULT 'unknown',
    summary TEXT NOT NULL DEFAULT '',
    findings_json TEXT NOT NULL DEFAULT '[]',
    checks_json TEXT NOT NULL DEFAULT '[]',
    diff_hash TEXT NOT NULL DEFAULT '',
    base_sha TEXT,
    created_at BIGINT NOT NULL DEFAULT 0,
    updated_at BIGINT NOT NULL DEFAULT 0,
    commit_sha TEXT,
    deployment_status TEXT NOT NULL DEFAULT 'not_started'
  )`,
  `CREATE TABLE IF NOT EXISTS codebase_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    updated_at BIGINT NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS codebase_audit (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    path TEXT NOT NULL,
    before_revision_id TEXT,
    meta_json TEXT NOT NULL DEFAULT '{}',
    editor_email TEXT NOT NULL DEFAULT '',
    created_at BIGINT NOT NULL DEFAULT 0,
    undone INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_email_tokens_lookup ON email_tokens(email, purpose, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, purpose, expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_chats_user_updated ON chats(user_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id, position)`,
  `CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id, updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_usage_user_created ON usage_events(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_codebase_files_updated ON codebase_files(updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_codebase_revisions_path ON codebase_revisions(path, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_codebase_audit_created ON codebase_audit(created_at DESC)`
];

function connectionString(env) {
  return String(env?.NEON_DATABASE_URL || env?.DATABASE_URL || "").trim();
}

function replaceQuestionMarks(query) {
  let output = "";
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < query.length; i += 1) {
    const char = query[i];
    const next = query[i + 1];
    if (char === "'" && !inDouble) {
      output += char;
      if (inSingle && next === "'") {
        output += next;
        i += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }
    if (char === '"' && !inSingle) {
      output += char;
      if (inDouble && next === '"') {
        output += next;
        i += 1;
      } else {
        inDouble = !inDouble;
      }
      continue;
    }
    if (char === "?" && !inSingle && !inDouble) {
      index += 1;
      output += "$" + index;
    } else {
      output += char;
    }
  }
  return output;
}

function compile(query) {
  const source = String(query || "").trim();
  const pragma = source.match(/^PRAGMA\s+table_info\s*\(\s*["']?([A-Za-z0-9_]+)["']?\s*\)$/i);
  if (pragma) return { type: "pragma_table_info", table: pragma[1] };

  const ignore = /^INSERT\s+OR\s+IGNORE\s+INTO\s+/i.test(source);
  let text = source.replace(/^INSERT\s+OR\s+IGNORE\s+INTO\s+/i, "INSERT INTO ");
  text = text.replace(/MAX\(\s*credits_remaining\s*-\s*1\s*,\s*0\s*\)/gi, "GREATEST(credits_remaining - 1, 0)");
  text = replaceQuestionMarks(text);
  if (ignore && !/\bON\s+CONFLICT\b/i.test(text)) text += " ON CONFLICT DO NOTHING";
  return { type: "query", text };
}

async function initialize(sql) {
  await sql.transaction(SCHEMA.map(statement => sql`${sql.unsafe(statement)}`));
}

export function createNeonD1Compat(env) {
  const url = connectionString(env);
  if (!url) return null;

  const sql = neon(url);
  let ready = schemaPromises.get(url);
  if (!ready) {
    ready = initialize(sql).catch(error => {
      schemaPromises.delete(url);
      console.error("[Cookie Neon] schema initialization failed", error);
      throw error;
    });
    schemaPromises.set(url, ready);
  }

  class Statement {
    constructor(compiled, values = []) {
      this.compiled = compiled;
      this.values = values;
    }

    bind(...values) {
      return new Statement(this.compiled, values);
    }

    async rows() {
      await ready;
      if (this.compiled.type === "pragma_table_info") {
        return sql.query(
          "SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position",
          [this.compiled.table]
        );
      }
      return sql.query(this.compiled.text, this.values);
    }

    async first() {
      const rows = await this.rows();
      return Array.isArray(rows) && rows.length ? rows[0] : null;
    }

    async all() {
      const rows = await this.rows();
      return { results: Array.isArray(rows) ? rows : [] };
    }

    async run() {
      await ready;
      const result = await sql.query(this.compiled.text, this.values, { fullResults: true });
      return {
        success: true,
        meta: { changes: Number(result?.rowCount || 0) },
        results: result?.rows || []
      };
    }
  }

  return {
    __cookieNeon: true,
    __cookieNeonUrl: url,
    prepare(query) {
      const compiled = compile(query);
      return new Statement(compiled);
    },
    async batch(statements = []) {
      const output = [];
      for (const statement of statements) output.push(await statement.run());
      return output;
    }
  };
}
