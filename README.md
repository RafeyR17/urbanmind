# UrbanIQ

Digital twin policy simulation platform for Lahore. Governments can simulate infrastructure decisions — flyovers, hospitals, drainage, parks — on a live 3D map before spending billions in real life.

**Live stack:** Next.js 14 · Deck.gl · MapLibre · MapTiler (+ Stadia fallback) · TomTom · OpenWeather · OpenRouter AI · Supabase · CesiumJS 3D globe

## Features

- Full-screen 3D map of Lahore with district zones, hospitals, schools, traffic, weather overlays
- Policy studio — simulate flyover, hospital, drainage, school, park policies
- AI recommendations via OpenRouter (verdict, risks, benefits, alternatives)
- Before/after comparison mode
- Demo mode (press `D`)

## Quick start (local)

```bash
git clone https://github.com/YOUR_USERNAME/urbanmind.git
cd urbanmind
cp .env.example .env.local
# Fill in API keys in .env.local (see below)
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_MAPTILER_KEY` | Yes* | [MapTiler](https://www.maptiler.com/) — primary base map (`dataviz-dark` style) |
| `NEXT_PUBLIC_STADIA_API_KEY` | Yes* | [Stadia Maps](https://stadiamaps.com/) — fallback base map + terrain when MapTiler fails |
| `NEXT_PUBLIC_TOMTOM_API_KEY` | Yes | [TomTom](https://developer.tomtom.com/) — traffic flow & incidents |
| `OPENWEATHER_API_KEY` | Yes | [OpenWeatherMap](https://openweathermap.org/api) — weather & AQI |
| `OPENROUTER_API_KEY` | Yes | [OpenRouter](https://openrouter.ai/) — AI recommendations |
| `OPENROUTER_MODEL` | No | Default: `google/gemma-2-27b-it` |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Supabase anon key |
| `NEXT_PUBLIC_CESIUM_TOKEN` | Optional | [Cesium Ion](https://cesium.com/ion/) — 3D globe mode |

\* At least one of `NEXT_PUBLIC_MAPTILER_KEY` or `NEXT_PUBLIC_STADIA_API_KEY` is required. MapTiler is preferred when both are set.

> Server-side keys (`OPENROUTER_API_KEY`, `OPENWEATHER_API_KEY`) are never exposed to the browser.

## Deploy to Vercel (recommended)

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) → Import your repository
3. Framework preset: **Next.js** (auto-detected)
4. Add all environment variables from `.env.example` in **Project Settings → Environment Variables**
5. Deploy

Vercel runs `npm ci` → `postinstall` (copies Cesium assets) → `next build` automatically.

### Vercel env vars checklist

```
NEXT_PUBLIC_MAPTILER_KEY
NEXT_PUBLIC_STADIA_API_KEY
NEXT_PUBLIC_TOMTOM_API_KEY
OPENWEATHER_API_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL=google/gemma-2-27b-it
NEXT_PUBLIC_CESIUM_TOKEN
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Set `HTTP-Referer` for OpenRouter is handled in code (`https://urbaniq.vercel.app`).

## Deploy to other platforms

Any Node.js host that supports Next.js 14:

```bash
npm ci
npm run build
npm start
```

Requires Node.js **18+** (20 recommended).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build (includes Cesium asset copy) |
| `npm start` | Start production server |
| `npm run lint` | ESLint |

## Project structure

```
app/           Next.js App Router (pages + API routes)
components/    UI, map layers, sidebar
lib/           API clients (overpass, weather, AI, supabase)
public/        Static assets (cesium/ generated at build)
supabase/      DB migrations + seed data
simulation/    Python FastAPI backend (optional, run separately)
specs/         Product & architecture specs
```

## Optional: Python simulation backend

```bash
cd simulation
./run.sh   # starts FastAPI on http://localhost:8000
```

## License

MIT
