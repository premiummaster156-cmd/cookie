-- Repair production databases created before the avatar_url field existed.
ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
