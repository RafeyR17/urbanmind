# UI Specs

## Overall Layout
- Full screen map (100vw, 100vh) as background
- Left sidebar: 380px wide, dark glass, always visible
- Top bar: 100% width, 48px tall, city status info
- No right panel (keeps map maximally visible)

## Color System
Background:     #0a0f1e  (deep navy)
Sidebar bg:     rgba(10, 15, 30, 0.92) with backdrop-blur-xl
Border:         rgba(255, 255, 255, 0.08)
Accent:         #00d4ff  (cyan — used for active states, live indicators)
Warning:        #f59e0b  (amber)
Danger:         #ef4444  (red)
Success:        #10b981  (green)
Text primary:   #f1f5f9
Text secondary: #94a3b8
Text muted:     #475569

## Mapbox Style
Style: mapbox://styles/mapbox/dark-v11
Center: [74.3587, 31.5204]
Zoom: 12
Pitch: 45  (slight tilt for depth)
Bearing: 0

## Deck.gl Layers (in render order, bottom to top)
1. ZoneLayer      — PolygonLayer, extruded, opacity 0.4
2. RoadLayer      — GeoJsonLayer, color by congestion
3. HeatmapLayer   — shows after simulation, impact radius
4. HospitalLayer  — ScatterplotLayer, pulsing red dots
5. SchoolLayer    — ScatterplotLayer, blue dots
6. ProposedLayer  — EditableGeoJsonLayer, cyan outline

## Zone Colors
No simulation:  rgba(100, 116, 139, 0.3)  gray
After simulate:
  improved:     rgba(16, 185, 129, 0.5)   green
  worsened:     rgba(239, 68, 68, 0.5)    red
  neutral:      rgba(245, 158, 11, 0.3)   amber

Zone extrusion height:
  = flood_risk_score * 800  (meters, visual only)

## Sidebar Tabs
Tab 1: Policy Studio  (default)
Tab 2: Results        (appears after simulation)
Tab 3: AI Mind        (appears after simulation)
Tab 4: Scenarios

## Policy Studio Panel
- Policy type dropdown: Flyover, Hospital, Drainage Upgrade, School, Park
- Budget slider: ₨1B to ₨50B, step ₨500M, shows formatted label
- Radius slider: 0.5km to 15km, step 0.5km
- Draw on Map button: toggles EditableGeoJsonLayer
- Simulate button: large, cyan, disabled until location selected

## Simulation Loading State
- Simulate button shows spinner
- Map zones pulse with a scanning animation (opacity 0.2 → 0.6 → 0.2)
- "Analyzing impact across 10 districts..." text in sidebar
- Duration: real API call time (show progress bar)

## Results Panel
MetricCard component x4:
  - Traffic Impact
  - Flood Risk Change  
  - Emergency Response
  - Economic Score
Each card: label, before value, arrow, after value, delta badge
Delta badge: green if improved, red if worsened
Number animation: count from old to new over 1.5s on mount

## AI Recommendation Card
Verdict badge: RECOMMENDED / CONDITIONAL / NOT RECOMMENDED
Executive summary: 2 sentences
Impact grid: 5 scores (traffic/flood/emergency/economic/environment)
  Each score: -10 to +10, shown as a bar
Risks: 3 items with severity indicator
Benefits: 3 items
Alternatives: 2 cards with estimated cost + expected improvement
"Ask UrbanMind" button → sendPrompt to Claude

## Top Status Bar
Left:  "CityMind" wordmark
Center: "Lahore, Pakistan  •  Live" with pulsing green dot
Right:  Current time + temp from OpenWeatherMap

## Animations (Framer Motion)
Sidebar panels: slide in from left, opacity 0→1, duration 0.3s
Metric cards: staggered, 0.1s delay between each
Zone color change: 0.8s ease transition
Verdict card: scale 0.95→1 + opacity, duration 0.4s
Number countup: spring animation, 1.5s
