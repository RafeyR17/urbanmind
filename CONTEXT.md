# UrbanIQ — Cursor Context File

## Project
Urban policy simulation platform. Product name: **UrbanIQ**. AI advisor persona: **UrbanMind**.
Governments simulate infrastructure decisions on a digital twin of Lahore before
spending billions in real life.

## City
Lahore, Pakistan
Center: 31.5204, 74.3587
Map: zoom 12, pitch 45, bearing 0
Style: https://api.maptiler.com/maps/dataviz-dark/style.json?key={MAPTILER_KEY}
Fallback: https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json?api_key={STADIA_KEY}

## Stack
- Frontend:  Next.js 14 (App Router), TypeScript, Tailwind CSS
- Map (2D): Deck.gl 9 + react-map-gl 8 + MapLibre GL + MapTiler (Stadia fallback)
- Animation: Framer Motion
- Icons:     Lucide React
- Backend:   Python FastAPI in `/simulation` (run via `simulation/run.sh`)
- Database:  Supabase + PostGIS (client + migrations in /supabase)
- AI:        OpenRouter API — model: google/gemma-2-27b-it (via OPENROUTER_MODEL)
- Map Data:  OpenStreetMap Overpass API (proxied via /api/overpass)
- Weather:   OpenWeatherMap API (current weather + air pollution AQI, precipitation/wind/temp tiles)

## Map Modes
- **deck** (default): Deck.gl + MapTiler dark map — traffic and weather overlays

## Map Provider — MapTiler (2D deck mode, Stadia fallback)
- **Base style:** MapTiler Dataviz Dark (primary); Stadia Alidade Smooth Dark if MapTiler fails
- **Terrain tiles:** MapTiler hillshade or Stadia Stamen Terrain raster overlay at 15% opacity (toggle in sidebar)
- **Labels:** Vector labels from Stadia style (toggle via `setMapLabelsVisible`, default on)
- **Weather overlays:** OpenWeatherMap raster tiles (Stadia has no weather data)

## Traffic
- **Particle system:** `TrafficParticleLayer` using Deck.gl `TripsLayer` (`@deck.gl/geo-layers`)
- **Road geometry:** Lahore roads fetched from Overpass API via `fetchRoads()` — cached per session
- **Particles:** Move along actual OSM road LineStrings with baseline congestion coloring (white-blue → amber → red)
- **Simulation:** After policy run, particles in improved zones turn green; worsened zones turn red
- **Animation:** `requestAnimationFrame` loop in `page.tsx` — trail length 120, loop 1800ms

## Map Layers (Deck mode)
- **Removed:** ArcLayer, ZoneLayer, IncidentLayer, raster traffic overlays from default view
- **Active:** BuildingLayer (dark navy extrusions, zoom ≥ 13), HospitalLayer (red pulsing dots), SchoolLayer (blue dots), TrafficParticleLayer, HeatmapLayer (post-simulation), ProposedPolicyLayer (policy marker)
- **Base map:** Stripped MapTiler style — pitch-black water, dark navy land, barely-visible road lines

## Current Status
Working:
- Full-screen minimal dark map of Lahore with moving traffic particles on real roads
- Split-screen Before/After Comparison mode with synchronized view
- 3D extruded OSM buildings (subtle dark navy) + hospital/school dot layers
- OpenWeather live weather in top bar (temp, AQI, PKT clock)
- Weather map tile overlays: precipitation, wind
- Layer toggles: Buildings, Hospitals, Schools, Traffic Flow, Heatmap, Precipitation, Wind
- Glass top bar and sidebar with policy studio shell
- AI recommendation flow via OpenRouter (`/api/ai/recommend`)
- Overpass fetch via /api/overpass proxy → `fetchBuildingsWithType()` for typed 3D footprints
- BuildingLayer color coding: red = hospitals, blue = schools
- Supabase schema + seed scenarios
- Simulation history panel saving to Supabase
- Python FastAPI simulation backend in `/simulation`
- **Demo mode** — 14-step scripted tour (~35s + complete hold); `D` to start, `Esc` to exit

Not yet built:
- FastAPI simulation backend auto-start with `npm run dev` (manual: `simulation/run.sh`)

## Folder Structure
```
/app
  page.tsx
  /api/overpass/route.ts
  /api/weather/route.ts     — weather data + OWM tile URL templates
  /api/ai/recommend/route.ts — OpenRouter AI recommendations

/components
  TopBar.tsx                — live weather, AQI, traffic status, PKT clock
  DemoMode.tsx              — hackathon demo script, narration, progress bar
  Sidebar.tsx               — policy studio + layer toggles + AI tab
  /sidebar/
    AIRecommendation.tsx    — verdict, scores, risks, Ask UrbanMind
    SimulationResults.tsx   — metrics + Get AI Analysis button
    PolicyStudio.tsx
  /map/DeckMap.tsx          — MapTiler + Stadia fallback + Deck.gl + OWM tiles
  /map/layers/
    BuildingLayer.ts        — subtle dark navy extruded footprints (zoom ≥ 13)
    HospitalLayer.ts        — red pulsing scatter dots
    SchoolLayer.ts          — blue scatter dots
    TrafficParticleLayer.ts — TripsLayer particles on Overpass roads
    ProposedPolicyLayer.ts  — cyan pulsing policy location marker
    HeatmapLayer.ts         — post-simulation impact heatmap

/lib
  openrouter.ts             — OpenRouter chat completions client
  ai.ts                     — client helper for /api/ai/recommend
  weather.ts                — OpenWeather fetch, AQI helpers, OWM tile URLs
  simulation.ts             — runSimulation() with weather context
  lahoreData.ts
  overpass.ts               — fetchBuildingsWithType(), fetchRoads() OSM data
  zoneImpact.ts             — simulation zone impact scoring (particles)
  supabase.ts

/simulation
  main.py                   — FastAPI simulation server
  run.sh                    — start on http://localhost:8000

/supabase
  migrations/001_initial.sql
  seed.sql
```

## Key Patterns
- MapTiler style + terrain use `NEXT_PUBLIC_MAPTILER_KEY`; Stadia fallback uses `NEXT_PUBLIC_STADIA_API_KEY`
- AI recommendations: client POSTs to `/api/ai/recommend` (keeps `OPENROUTER_API_KEY` server-side)
- Weather fetch: client calls `/api/weather` (keeps OPENWEATHER_API_KEY server-side)
- Weather tiles: OWM via `/api/weather?tile=precipitation|wind|temp`
- Traffic refreshes every 2 minutes on mount + interval
- `flood_risk_modifier` (0.0–0.5) is added to zone `before.flood_risk` scores when raining during simulation
- NASA fire/surface-temp tile URLs: `lib/firms.ts` (`getGibsDefaultDate()` — yesterday UTC)

## Env Vars
```
NEXT_PUBLIC_MAPTILER_KEY=     # MapTiler — primary base style, hillshade terrain
NEXT_PUBLIC_STADIA_API_KEY=   # Stadia Maps — fallback base style + terrain
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENROUTER_API_KEY=           # OpenRouter — UrbanMind AI recommendations
OPENROUTER_MODEL=google/gemma-2-27b-it
OPENWEATHER_API_KEY=          # current weather, air pollution AQI, precipitation/wind/temp tiles
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## AI Integration
- Provider: OpenRouter (`https://openrouter.ai/api/v1`)
- Model: `google/gemma-2-27b-it` (set `OPENROUTER_MODEL` in `.env.local`)
- Route: `POST /api/ai/recommend`
- Returns `AIRecommendation` JSON (verdict, impact scores, risks, benefits, alternatives)
- Fallback recommendation returned if OpenRouter fails or returns invalid JSON

## Weather Integration
- `fetchLahoreWeather()` — parallel current weather + air pollution API calls
- `available` / `aqi_available` flags — no misleading AQI when APIs fail
- AQI badge hidden (shows `AQI N/A`) when pollution data unavailable
- Tile layers: `precipitation_new`, `wind_new`, `temp_new` (OWM raster overlay at 60% opacity)
- Rain detection adjusts flood model: modifier 0.1 / 0.25 / 0.4 based on precipitation
- Top bar refreshes weather every 5 minutes; PKT clock every second

## Dev Commands
```bash
npm run dev      # http://localhost:3000
npm run build
npm run lint
cd simulation && ./run.sh   # FastAPI on http://localhost:8000
```

## UI Tokens (from specs/UI.md)
- Background:  #0a0f1e (navy)
- Accent:      #00d4ff (cyan)
- Success:     #10b981 | Warning: #f59e0b | Danger: #ef4444
- Glass:       rgba(10,15,30,0.92) + backdrop-blur

## Pre-built Scenarios (lib/scenarios.ts + supabase/seed.sql)
1. Kalma Chowk Flyover     — conditional
2. Johar Town Hospital      — recommended
3. Lahore Drainage Upgrade  — recommended

## Demo Mode
- **Trigger:** `▶ Demo` button (bottom-right) or press **`D`**
- **Exit:** `✕ Exit` / **`Esc`**
- **Pause:** `⏸ Pause` during playback
- **Script:** 14 steps — Lahore intro → Kalma Chowk flyover → Results → AI verdict → Drainage upgrade → closing
- **UI:** Bottom-center narration panel, full-width cyan progress bar, sidebar locked during run
- **Callbacks:** `setDemoCallbacks()` in `page.tsx` wires map fly, scenario load, tab switch

## Default App State (app/page.tsx)
```
current_policy: 'flyover'
budget_pkr: 5000000000
radius_km: 3
active_layers: ['buildings', 'hospitals', 'schools', 'traffic']
active_tile_layer: 'none'
show_terrain: false
show_labels: true
show_traffic_tiles: false
view_mode: 'deck'
simulation_status: 'idle'
```
