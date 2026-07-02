import {
  fetchLahoreWeather,
  getTileUrlForLayer,
  type WeatherTileLayer,
} from '@/lib/weather';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tile = searchParams.get('tile') as WeatherTileLayer | null;

  // tile template lookup — separate from live weather fetch
  if (tile) {
    const template = getTileUrlForLayer(tile);
    if (!template) {
      return NextResponse.json({ template: null });
    }

    return NextResponse.json({ template });
  }

  try {
    const weather = await fetchLahoreWeather();
    return NextResponse.json(weather);
  } catch (e) {
    console.warn('[weather] fetch failed, returning empty:', e);
    return NextResponse.json({ error: 'weather unavailable' }, { status: 503 });
  }
}
