# Architecture

## Frontend — Next.js 14
/app
  /page.tsx              — main map page, full screen
  /scenarios/page.tsx    — scenario library
  /layout.tsx

/components
  /map
    DeckMap.tsx          — main Deck.gl + Mapbox component
    layers/
      HospitalLayer.tsx
      RoadLayer.tsx
      ZoneLayer.tsx
      HeatmapLayer.tsx
      ProposedPolicyLayer.tsx
  /sidebar
    Sidebar.tsx          — left panel container
    PolicyStudio.tsx     — dropdowns, sliders, draw button, simulate
    SimulationResults.tsx — metric cards with animations
    AIRecommendation.tsx  — verdict card, risks, benefits, alternatives
    ScenarioLibrary.tsx  — 3 pre-built scenarios
  /ui
    MetricCard.tsx       — animated number card
    VerdictBadge.tsx     — green/amber/red badge
    LayerToggle.tsx      — map layer on/off buttons

/lib
  mapbox.ts             — mapbox token, config
  supabase.ts           — supabase client
  claude.ts             — claude API calls
  overpass.ts           — fetch Lahore OSM data
  simulation.ts         — calls FastAPI backend

## Backend — Python FastAPI
/simulation
  main.py               — FastAPI app, CORS config
  models/
    traffic.py          — networkx graph model
    flood.py            — flood risk calculator  
    emergency.py        — response time calculator
  data/
    lahore_zones.geojson
    lahore_roads.geojson
    lahore_hospitals.geojson

## Database — Supabase
Tables:
  city_infrastructure   — hospitals, schools, fire stations
  district_zones        — 10 Lahore districts with base scores
  simulation_runs       — history of every simulation
  scenarios             — 3 pre-built scenarios

PostGIS enabled: yes

## Hosting
Frontend: Vercel
Backend: Railway
Database: Supabase

## Env Vars
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
OPENWEATHER_API_KEY=
NEXT_PUBLIC_API_URL=https://citymind-api.railway.app
