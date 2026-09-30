ALTER TABLE companies
 ADD COLUMN what_it_does text NOT NULL DEFAULT '',
 ADD COLUMN target_audience text NOT NULL DEFAULT '',
 ADD COLUMN pricing_model text NOT NULL DEFAULT 'unknown' CHECK (pricing_model IN ('free','freemium','paid','contact','unknown')),
 ADD COLUMN pricing_note text NOT NULL DEFAULT '',
 ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX companies_tags ON companies USING gin(tags);
ALTER TABLE placement_orders DROP CONSTRAINT placement_orders_position_check;
ALTER TABLE placement_orders
 ADD CONSTRAINT placement_orders_position_check CHECK (position IN ('top','bottom','both','deck')),
 ADD COLUMN advertiser_id uuid REFERENCES users(id),
 ADD COLUMN logo_url text NOT NULL DEFAULT '',
 ADD COLUMN hero_image_url text NOT NULL DEFAULT '',
 ADD COLUMN description text NOT NULL DEFAULT '',
 ADD COLUMN cta_label text NOT NULL DEFAULT 'Visit sponsor',
 ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX placement_advertiser ON placement_orders(advertiser_id,created_at);
CREATE TABLE ad_exposures (
 id uuid PRIMARY KEY,
 placement_id uuid NOT NULL REFERENCES placement_orders(id) ON DELETE CASCADE,
 device_hash text NOT NULL,
 surface text NOT NULL CHECK(surface IN ('deck','browse','top','bottom')),
 category text NOT NULL DEFAULT 'All',
 source text NOT NULL DEFAULT 'direct',
 created_at timestamptz NOT NULL DEFAULT now(),
 viewable_at timestamptz
);
CREATE INDEX ad_exposures_report ON ad_exposures(placement_id,created_at);
CREATE TABLE ad_clicks (
 exposure_id uuid PRIMARY KEY REFERENCES ad_exposures(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now()
);
