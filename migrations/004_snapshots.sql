SET search_path TO backingleaderboard,public;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS snapshot_at timestamptz;
