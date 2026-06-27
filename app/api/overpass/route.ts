import { NextResponse } from 'next/server';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const query = new URLSearchParams(body).get('data');

    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Missing Overpass query' },
        { status: 400 },
      );
    }

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'UrbanIQ/1.0 (hackathon project)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(35000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `Overpass API error: ${response.status} ${response.statusText} - ${errorText}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[overpass] Proxy error:', message);
    return NextResponse.json(
      { error: `Failed to fetch from Overpass API: ${message}` },
      { status: 502 },
    );
  }
}
