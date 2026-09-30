SET search_path TO backingleaderboard,public;
ALTER TABLE sponsorships ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE placement_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;
UPDATE sponsorships SET paid_at=created_at WHERE credited_season_id IS NOT NULL AND paid_at IS NULL;
UPDATE placement_orders SET paid_at=created_at WHERE payment_status='succeeded' AND paid_at IS NULL;
