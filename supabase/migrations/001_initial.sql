-- UrbanIQ initial schema
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE city_infrastructure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('hospital', 'school', 'fire_station', 'police')),
  lat float NOT NULL,
  lng float NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  location geometry(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)
  ) STORED
);

CREATE TABLE district_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  polygon geometry(Polygon, 4326),
  base_traffic_score int NOT NULL DEFAULT 50,
  base_flood_risk int NOT NULL DEFAULT 30,
  base_emergency_minutes float NOT NULL DEFAULT 10.0,
  population int NOT NULL DEFAULT 0,
  area_sqkm float NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type text NOT NULL,
  location geometry(Point, 4326),
  budget_pkr bigint,
  radius_km float,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  ai_verdict text,
  ai_summary text,
  processing_time_ms int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  policy_type text,
  location geometry(Point, 4326),
  budget_pkr bigint,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  ai_response jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX city_infrastructure_location_idx ON city_infrastructure USING GIST (location);
CREATE INDEX district_zones_polygon_idx ON district_zones USING GIST (polygon);
CREATE INDEX simulation_runs_created_at_idx ON simulation_runs (created_at DESC);
CREATE INDEX scenarios_sort_order_idx ON scenarios (sort_order ASC);
