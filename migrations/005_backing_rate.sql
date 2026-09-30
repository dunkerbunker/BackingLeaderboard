SET search_path TO backingleaderboard,public;
ALTER TABLE community_backs ADD COLUMN IF NOT EXISTS surface text NOT NULL DEFAULT 'profile';
ALTER TABLE company_season_stats ADD COLUMN IF NOT EXISTS feed_backs integer NOT NULL DEFAULT 0;
