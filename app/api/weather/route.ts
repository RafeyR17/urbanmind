import { NextResponse } from 'next/server';
import {
  fetchLahoreWeather,
  getTileUrlForLayer,
  type WeatherTileLayer,
} from '@/lib/weather';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tile = searchParams.get('tile') as WeatherTileLayer | null;

  if (tile) {
    const template = getTileUrlForLayer(tile);
    if (!template) {
      return NextResponse.json({ template: null });
    }

    return NextResponse.json({ template });
  }

  const weather = await fetchLahoreWeather();
  return NextResponse.json(weather);
}
