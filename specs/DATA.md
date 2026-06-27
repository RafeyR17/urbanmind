# Data Specs

## Supabase Schema

### city_infrastructure
id          uuid primary key
name        text
type        text  -- 'hospital' | 'school' | 'fire_station' | 'police'
lat         float
lng         float
metadata    jsonb  -- beds, capacity, etc
created_at  timestamp

### district_zones
id          uuid primary key
name        text
slug        text  -- 'gulberg', 'dha', etc
polygon     geometry(Polygon, 4326)
base_traffic_score      int  -- 0-100
base_flood_risk         int  -- 0-100
base_emergency_minutes  float
population              int
area_sqkm               float

### simulation_runs
id              uuid primary key
policy_type     text
location        geometry(Point, 4326)
budget_pkr      bigint
parameters      jsonb
result          jsonb  -- full API response
ai_verdict      text
ai_summary      text
created_at      timestamp

### scenarios
id          uuid primary key
name        text
description text
policy_type text
location    geometry(Point, 4326)
budget_pkr  bigint
parameters  jsonb
result      jsonb
ai_response jsonb
sort_order  int

## Seed Data — District Zones Base Scores
Gulberg:          traffic=78, flood=45, emergency=8.2min
DHA:              traffic=55, flood=20, emergency=12.1min
Model Town:       traffic=62, flood=65, emergency=9.8min
Johar Town:       traffic=48, flood=40, emergency=18.4min
Walled City:      traffic=88, flood=82, emergency=6.1min
Cantt:            traffic=41, flood=18, emergency=5.2min
Allama Iqbal Town:traffic=67, flood=55, emergency=11.3min
Faisal Town:      traffic=59, flood=48, emergency=13.7min
Garden Town:      traffic=71, flood=42, emergency=7.9min
Township:         traffic=52, flood=38, emergency=21.2min

## OpenStreetMap Overpass Queries

### Hospitals in Lahore
[out:json][timeout:25];
area["name"="Lahore"]->.searchArea;
node["amenity"="hospital"](area.searchArea);
out body;

### Schools
[out:json][timeout:25];
area["name"="Lahore"]->.searchArea;
node["amenity"="school"](area.searchArea);
out body;

### Main Roads
[out:json][timeout:25];
area["name"="Lahore"]->.searchArea;
way["highway"~"primary|secondary|trunk"](area.searchArea);
out geom;
