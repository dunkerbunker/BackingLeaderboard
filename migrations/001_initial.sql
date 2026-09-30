CREATE SCHEMA IF NOT EXISTS backingleaderboard;
SET search_path TO backingleaderboard,public;
CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL, password_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS companies (
 id uuid PRIMARY KEY, name text NOT NULL, slug text UNIQUE NOT NULL, url text NOT NULL,
 tagline text NOT NULL CHECK (length(tagline)<=80), description text NOT NULL DEFAULT '',
 logo_url text NOT NULL, hero_image_url text NOT NULL, category text NOT NULL, social_url text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','hidden')),
 verification_status text NOT NULL DEFAULT 'unclaimed', owner_id uuid REFERENCES users(id),
 submitted_by uuid REFERENCES users(id), is_demo boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS seasons (
 id uuid PRIMARY KEY, starts_at timestamptz UNIQUE NOT NULL, ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived'))
);
CREATE TABLE IF NOT EXISTS company_season_stats (
 company_id uuid REFERENCES companies(id), season_id uuid REFERENCES seasons(id),
 community_points integer NOT NULL DEFAULT 0 CHECK(community_points>=0),
 sponsored_points integer NOT NULL DEFAULT 0 CHECK(sponsored_points>=0),
 total_points integer GENERATED ALWAYS AS (community_points+sponsored_points) STORED,
 reached_at timestamptz NOT NULL DEFAULT now(), previous_rank integer,
 impressions integer NOT NULL DEFAULT 0, skips integer NOT NULL DEFAULT 0, clicks integer NOT NULL DEFAULT 0,
 profile_views integer NOT NULL DEFAULT 0, PRIMARY KEY(company_id,season_id)
);
CREATE TABLE IF NOT EXISTS feed_views (
 id uuid PRIMARY KEY, company_id uuid REFERENCES companies(id), season_id uuid REFERENCES seasons(id),
 device_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,season_id,device_hash)
);
CREATE TABLE IF NOT EXISTS community_backs (
 id uuid PRIMARY KEY, company_id uuid REFERENCES companies(id), season_id uuid REFERENCES seasons(id),
 device_hash text NOT NULL, ip_hash text NOT NULL, risk_score integer NOT NULL, valid boolean NOT NULL,
 invalid_reason text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,season_id,device_hash)
);
CREATE TABLE IF NOT EXISTS skips (
 company_id uuid REFERENCES companies(id), season_id uuid REFERENCES seasons(id), device_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(company_id,season_id,device_hash)
);
CREATE TABLE IF NOT EXISTS claims (
 id uuid PRIMARY KEY, company_id uuid REFERENCES companies(id), user_id uuid REFERENCES users(id),
 method text NOT NULL, token text NOT NULL UNIQUE, email text, status text NOT NULL DEFAULT 'pending',
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days'
);
CREATE TABLE IF NOT EXISTS sponsorships (
 id uuid PRIMARY KEY, company_id uuid REFERENCES companies(id), season_id uuid REFERENCES seasons(id),
 amount_usd integer NOT NULL CHECK(amount_usd>0), email text NOT NULL, checkout_id text UNIQUE,
 dodo_payment_id text UNIQUE, payment_status text NOT NULL DEFAULT 'pending',
 credited_season_id uuid REFERENCES seasons(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS placement_orders (
 id uuid PRIMARY KEY, advertiser text NOT NULL, creative text NOT NULL, destination_url text NOT NULL,
 position text NOT NULL CHECK(position IN ('top','bottom','both')), starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL, amount_usd integer NOT NULL, email text NOT NULL,
 checkout_id text UNIQUE, dodo_payment_id text UNIQUE, payment_status text NOT NULL DEFAULT 'pending',
 moderation_status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS webhook_events (id text PRIMARY KEY, type text NOT NULL, received_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS analytics_events (
 id bigserial PRIMARY KEY, company_id uuid REFERENCES companies(id), season_id uuid REFERENCES seasons(id),
 kind text NOT NULL, source text NOT NULL DEFAULT 'direct', device_hash text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rate_limits (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS reports (id uuid PRIMARY KEY, company_id uuid REFERENCES companies(id), reason text NOT NULL, status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_log (id bigserial PRIMARY KEY, actor text NOT NULL, action text NOT NULL, target_id text, details jsonb, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS backing_velocity ON community_backs(device_hash,created_at);
CREATE INDEX IF NOT EXISTS backing_ip_velocity ON community_backs(ip_hash,created_at);
CREATE INDEX IF NOT EXISTS analytics_company ON analytics_events(company_id,season_id,kind);
CREATE INDEX IF NOT EXISTS feed_exposure ON company_season_stats(season_id,impressions);
CREATE INDEX IF NOT EXISTS rankings ON company_season_stats(season_id,total_points DESC,reached_at);
