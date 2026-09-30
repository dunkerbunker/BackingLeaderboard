SET search_path TO backingleaderboard,public;
ALTER TABLE community_backs ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);
ALTER TABLE skips ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_back ON community_backs(company_id,season_id,user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_skip ON skips(company_id,season_id,user_id) WHERE user_id IS NOT NULL;
