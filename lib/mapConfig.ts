const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? '';
const STADIA_KEY = process.env.NEXT_PUBLIC_STADIA_API_KEY ?? '';

// TODO: support mapbox if someone donates a key

export type MapProvider = 'maptiler' | 'stadia' | 'none';

export function getMapProvider(): MapProvider {
  if (MAPTILER_KEY) return 'maptiler';
  if (STADIA_KEY) return 'stadia';
  return 'none';
}

export function getMaptilerStyleUrl(): string | null {
  if (!MAPTILER_KEY) return null;
  return `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`;
}

export function getStadiaStyleUrl(): string | null {
  if (!STADIA_KEY) return null;
  return `https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json?api_key=${STADIA_KEY}`;
}

/** maptiler first, stadia if it 404s at runtime */
export function getPrimaryMapStyleUrl(): string {
  return getMaptilerStyleUrl() ?? getStadiaStyleUrl() ?? '';
}

export function getStadiaFallbackStyleUrl(): string | null {
  if (!MAPTILER_KEY || !STADIA_KEY) return null;
  return getStadiaStyleUrl();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- leftover from refactor
const _unusedFallbackRef = getStadiaFallbackStyleUrl;

export function getTerrainTileUrl(provider: MapProvider): string | null {
  if (provider === 'maptiler' && MAPTILER_KEY) {
    return `https://api.maptiler.com/tiles/hillshade/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;
  }
  if (provider === 'stadia' && STADIA_KEY) {
    return `https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png?api_key=${STADIA_KEY}`;
  }
  return null;
}

export function hasMapApiKey(): boolean {
  return Boolean(MAPTILER_KEY || STADIA_KEY);
}
