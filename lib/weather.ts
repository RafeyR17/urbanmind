export interface WeatherData {
  temp_c: number;
  feels_like_c: number;
  humidity: number;
  description: string;
  icon: string;
  wind_speed: number;
  /** OpenWeather 1–5 scale; 0 when unavailable */
  aqi: number;
  precipitation_mm: number;
  is_raining: boolean;
  flood_risk_modifier: number;
  /** True when live OpenWeather current weather was fetched */
  available: boolean;
  /** True when live air-pollution AQI was fetched */
  aqi_available: boolean;
  /** True when showing baseline Lahore values because live OWM data is unavailable */
  is_fallback?: boolean;
}

const LAHORE_LAT = 31.5204;
const LAHORE_LNG = 74.3587;

const WEATHER_API_KEY =
  process.env.OPENWEATHER_API_KEY ??
  process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY ??
  '';

/** Baseline Lahore conditions used when OpenWeather is unreachable (typical June heat + smog). */
export const FALLBACK_WEATHER: WeatherData = {
  temp_c: 42,
  feels_like_c: 44,
  humidity: 20,
  description: 'clear sky',
  icon: '01d',
  wind_speed: 3,
  aqi: 4,
  precipitation_mm: 0,
  is_raining: false,
  flood_risk_modifier: 0,
  available: false,
  aqi_available: true,
  is_fallback: true,
};

interface OpenWeatherResponse {
  weather?: Array<{ id: number; description: string; icon: string }>;
  main?: {
    temp?: number;
    feels_like?: number;
    humidity?: number;
  };
  wind?: { speed?: number };
  rain?: { '1h'?: number; '3h'?: number };
  snow?: { '1h'?: number; '3h'?: number };
}

interface OpenWeatherAirPollutionResponse {
  list?: Array<{ main?: { aqi?: number } }>;
}

function isRainWeatherCode(weatherId: number): boolean {
  return (
    (weatherId >= 200 && weatherId < 400) ||
    (weatherId >= 500 && weatherId < 600)
  );
}

function getPrecipitationMm(payload: OpenWeatherResponse): number {
  return (
    payload.rain?.['1h'] ??
    payload.rain?.['3h'] ??
    payload.snow?.['1h'] ??
    payload.snow?.['3h'] ??
    0
  );
}

function getFloodRiskModifier(isRaining: boolean, precipitationMm: number): number {
  if (!isRaining) return 0;
  if (precipitationMm > 10) return 0.4;
  if (precipitationMm > 5) return 0.25;
  return 0.1;
}

function mapWeatherResponse(
  weatherPayload: OpenWeatherResponse,
  airPayload: OpenWeatherAirPollutionResponse | null,
): WeatherData {
  const weatherEntry = weatherPayload.weather?.[0];
  const weatherId = weatherEntry?.id ?? 800;
  const precipitationMm = getPrecipitationMm(weatherPayload);
  const isRaining = isRainWeatherCode(weatherId);
  const aqiValue = airPayload?.list?.[0]?.main?.aqi;
  const aqi_available =
    typeof aqiValue === 'number' && aqiValue >= 1 && aqiValue <= 5;

  return {
    temp_c: Math.round(weatherPayload.main?.temp ?? 0),
    feels_like_c: Math.round(weatherPayload.main?.feels_like ?? 0),
    humidity: weatherPayload.main?.humidity ?? 0,
    description: weatherEntry?.description ?? 'Unknown',
    icon: weatherEntry?.icon ?? '01d',
    wind_speed: weatherPayload.wind?.speed ?? 0,
    aqi: aqi_available ? aqiValue : 0,
    precipitation_mm: precipitationMm,
    is_raining: isRaining,
    flood_risk_modifier: getFloodRiskModifier(isRaining, precipitationMm),
    available: true,
    aqi_available,
  };
}

async function fetchOpenWeatherJson<T>(url: URL): Promise<T | null> {
  try {
    const response = await fetch(url.toString(), { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch (error) {
    console.error('[weather] Request failed:', error);
    return null;
  }
}

export async function fetchLahoreWeather(): Promise<WeatherData> {
  if (!WEATHER_API_KEY) {
    console.warn('[weather] OPENWEATHER_API_KEY is not configured — using Lahore baseline');
    return FALLBACK_WEATHER;
  }

  const weatherUrl = new URL('https://api.openweathermap.org/data/2.5/weather');
  weatherUrl.searchParams.set('lat', String(LAHORE_LAT));
  weatherUrl.searchParams.set('lon', String(LAHORE_LNG));
  weatherUrl.searchParams.set('appid', WEATHER_API_KEY);
  weatherUrl.searchParams.set('units', 'metric');

  const airUrl = new URL(
    'https://api.openweathermap.org/data/2.5/air_pollution',
  );
  airUrl.searchParams.set('lat', String(LAHORE_LAT));
  airUrl.searchParams.set('lon', String(LAHORE_LNG));
  airUrl.searchParams.set('appid', WEATHER_API_KEY);

  const [weatherPayload, airPayload] = await Promise.all([
    fetchOpenWeatherJson<OpenWeatherResponse>(weatherUrl),
    fetchOpenWeatherJson<OpenWeatherAirPollutionResponse>(airUrl),
  ]);

  if (!weatherPayload) {
    console.error('[weather] Failed to fetch Lahore current weather — using Lahore baseline');
    return FALLBACK_WEATHER;
  }

  return mapWeatherResponse(weatherPayload, airPayload);
}

export function getAQILabel(aqi: number): string {
  switch (aqi) {
    case 1:
      return 'Good';
    case 2:
      return 'Fair';
    case 3:
      return 'Moderate';
    case 4:
      return 'Poor';
    case 5:
      return 'Hazardous';
    default:
      return 'N/A';
  }
}

export function getAQIColor(aqi: number): string {
  switch (aqi) {
    case 1:
      return '#10b981';
    case 2:
      return '#84cc16';
    case 3:
      return '#f59e0b';
    case 4:
      return '#ef4444';
    case 5:
      return '#7c3aed';
    default:
      return '#475569';
  }
}

// Precipitation/wind/temp tiles use OpenWeatherMap — Stadia has no weather raster data.
function buildTileUrl(layer: string): string {
  const key = WEATHER_API_KEY;
  if (!key) return '';
  return `https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${key}`;
}

export function getPrecipitationTileUrl(): string {
  return buildTileUrl('precipitation_new');
}

export function getWindTileUrl(): string {
  return buildTileUrl('wind_new');
}

export function getTempTileUrl(): string {
  return buildTileUrl('temp_new');
}

export function getWeatherIconUrl(icon: string): string {
  return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}

export type WeatherTileLayer = 'none' | 'precipitation' | 'wind' | 'temp';

export function getTileUrlForLayer(layer: WeatherTileLayer): string | null {
  switch (layer) {
    case 'precipitation':
      return getPrecipitationTileUrl();
    case 'wind':
      return getWindTileUrl();
    case 'temp':
      return getTempTileUrl();
    default:
      return null;
  }
}
