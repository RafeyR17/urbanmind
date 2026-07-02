# UrbanIQ

Digital twin thing for Lahore — simulate flyovers, hospitals, drainage etc on a live map before the govt burns billions on the wrong project.

Stack: Next.js 14, Deck.gl, MapTiler, TomTom traffic, OpenWeather, OpenRouter AI, Cesium 3D globe, Supabase if you bother setting it up.

ngl this took way longer than expected.

## what it does

- full screen dark map of Lahore with traffic particles on real OSM roads
- policy studio — pick policy, drop a pin, hit simulate
- AI verdict from UrbanMind (OpenRouter)
- before/after split view
- demo mode — press `D`

ran out of time to add tests sorry

## quick start

```bash
git clone https://github.com/YOUR_USERNAME/urbanmind.git
cd urbanmind
cp .env.example .env.local
# fill in keys below
npm install
npm run dev
```

http://localhost:3000

## env vars

copy `.env.example` → `.env.local`:

| Variable | Need it? | What for |
|----------|----------|----------|
| `NEXT_PUBLIC_MAPTILER_KEY` | yeah* | base map |
| `NEXT_PUBLIC_STADIA_API_KEY` | yeah* | fallback if maptiler dies |
| `NEXT_PUBLIC_TOMTOM_API_KEY` | yes | traffic (simulated in PK anyway) |
| `OPENWEATHER_API_KEY` | yes | weather + AQI |
| `OPENROUTER_API_KEY` | yes | AI stuff |
| `OPENROUTER_MODEL` | nah | default `google/gemma-2-27b-it` |
| `NEXT_PUBLIC_SUPABASE_URL` | optional | history panel |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional | same |
| `NEXT_PUBLIC_CESIUM_TOKEN` | optional | 3D globe |

\* need at least one of maptiler or stadia

server keys (`OPENROUTER`, `OPENWEATHER`) stay server-side, don't put them in `NEXT_PUBLIC_*`

## deploy (vercel)

1. push to github
2. import on vercel.com/new
3. dump env vars from `.env.example` into project settings
4. deploy — it runs postinstall (cesium copy) + build automatically

## scripts

| cmd | does |
|-----|------|
| `npm run dev` | dev server :3000 |
| `npm run build` | prod build |
| `npm start` | prod server |
| `npm run lint` | eslint |

## python backend (optional)

```bash
cd simulation
./run.sh   # localhost:8000
```

doesn't auto-start with `npm run dev` yet — manual for now

## folders

```
app/           pages + api routes
components/    ui + map layers + sidebar
lib/           overpass, weather, ai, supabase helpers
simulation/    fastapi backend
specs/         product docs (mostly for us)
```

MIT
