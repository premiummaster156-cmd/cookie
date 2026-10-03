-- Repair production databases that were created before the username field existed.
ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT '';

-- Backfill stable usernames for existing accounts before enforcing uniqueness.
UPDATE users
SET username = 'user-' || substr(id, 1, 12)
WHERE username = '' OR username IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);
