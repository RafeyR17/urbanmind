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
- Map (3D): CesiumJS + Resium — toggleable 3D globe with OSM buildings
- Animation: Framer Motion
- Icons:     Lucide React
- Backend:   Python FastAPI in `/simulation` (run via `simulation/run.sh`)
- Database:  Supabase + PostGIS (client + migrations in /supabase)
- AI:        OpenRouter API — model: google/gemma-2-27b-it (via OPENROUTER_MODEL)
- Map Data:  OpenStreetMap Overpass API (proxied via /api/overpass)
- Weather:   OpenWeatherMap API (current weather + air pollution AQI, precipitation/wind/temp tiles)
- Traffic:   TomTom Traffic Flow + Incidents APIs + Orbis traffic tiles

## Map Modes
- **deck** (default): Deck.gl + MapTiler dark map — traffic, weather, TomTom overlays
- **cesium**: CesiumJS 3D globe — world terrain, OSM 3D buildings, extruded zone polygons
- Toggle via TopBar: `🗺 2D Map` / `🌍 3D Globe` (both mounted; inactive hidden with `display: none`)
- Cesium camera flies to most-affected zone (3000m, -45° pitch) when simulation exists; else Lahore center at 8000m

## Map Provider — MapTiler (2D deck mode, Stadia fallback)
- **Base style:** MapTiler Dataviz Dark (primary); Stadia Alidade Smooth Dark if MapTiler fails
- **Terrain tiles:** MapTiler hillshade or Stadia Stamen Terrain raster overlay at 15% opacity (toggle in sidebar)
- **Labels:** Vector labels from Stadia style (toggle via `setMapLabelsVisible`, default on)
- **Weather overlays:** OpenWeatherMap raster tiles (Stadia has no weather data)

## Traffic — TomTom
- **Flow API:** Live congestion at 8 Lahore intersections (parallel fetch)
- **Incidents API:** Active incidents in Lahore bbox
- **Orbis tiles:** Traffic flow raster (70% opacity) + incident raster (90% opacity)
- **Arc layer:** 16 arcs between intersections colored by real congestion; blends with simulation impact (±30% green/red)
- **Incident layer:** ScatterplotLayer with severity colors; severity 4 pulses
- **Refresh:** Every 2 minutes (`TRAFFIC_REFRESH_MS = 120000`)
- **Top bar:** Average congestion badge, incident count, last-updated time

## Current Status
Working:
- Full-screen dark map of Lahore with Deck.gl + MapTiler
- Split-screen Before/After Comparison mode with synchronized view
- Live TomTom traffic flow, incidents, and optional traffic tile overlays
- Terrain + label overlays with sidebar toggles
- 10 district zone polygons, 3D extruded OSM buildings (hospitals, schools)
- OpenWeather live weather in top bar (temp, AQI, PKT clock)
- Weather map tile overlays: precipitation, wind, temperature
- NASA GIBS fire + surface temperature tiles (dynamic date via `lib/firms.ts`)
- Layer toggles in sidebar (map layers + terrain + labels + TomTom + weather + fires + surface-temp)
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
  /map/DeckMap.tsx          — MapTiler + Stadia fallback + TomTom tiles + Deck.gl + OWM tiles
  /map/CesiumMap.tsx        — Cesium 3D globe + terrain + OSM buildings
  /map/layers/
    BuildingLayer.ts        — extruded OSM footprints (hospital/school color coding)
    ArcLayer.ts             — live TomTom congestion arcs
    IncidentLayer.ts        — TomTom incident scatter layer

/lib
  openrouter.ts             — OpenRouter chat completions client
  ai.ts                     — client helper for /api/ai/recommend
  tomtom.ts                 — TomTom flow/incidents fetch + tile URLs
  weather.ts                — OpenWeather fetch, AQI helpers, OWM tile URLs
  simulation.ts             — runSimulation() with weather context
  lahoreData.ts
  overpass.ts               — fetchBuildingsWithType() OSM building footprints
  supabase.ts

/simulation
  main.py                   — FastAPI simulation server
  run.sh                    — start on http://localhost:8000

/supabase
  migrations/001_initial.sql
  seed.sql
```

## Key Patterns
- DeckMap + CesiumMap: `dynamic(..., { ssr: false })` — both stay mounted for instant toggle
- Cesium static assets copied to `public/cesium` via `scripts/copy-cesium.js` (postinstall + prebuild)
- Cesium Ion token: `NEXT_PUBLIC_CESIUM_TOKEN` — terrain + imagery
- MapTiler style + terrain use `NEXT_PUBLIC_MAPTILER_KEY`; Stadia fallback uses `NEXT_PUBLIC_STADIA_API_KEY`
- TomTom flow/incidents/tiles use `NEXT_PUBLIC_TOMTOM_API_KEY`
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
NEXT_PUBLIC_TOMTOM_API_KEY=     # TomTom — traffic flow, incidents, map tiles
NEXT_PUBLIC_CESIUM_TOKEN=       # Cesium Ion — 3D globe terrain + imagery
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
active_layers: ['zones', 'hospitals', 'schools', 'traffic']
active_tile_layer: 'none'
show_terrain: false
show_labels: true
show_traffic_tiles: false
show_incidents: true
view_mode: 'deck'
simulation_status: 'idle'
```
