import { NextResponse } from 'next/server';

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

const REQUEST_TIMEOUT_MS = 22_000; // overpass is slow, had to bump this

async function fetchOverpass(
  endpoint: string,
  body: string,
): Promise<Response> {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'User-Agent': 'UrbanIQ/1.0 (hackathon; contact: urbaniq-demo)',
    },
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const query = new URLSearchParams(rawBody).get('data');

    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Missing Overpass query' },
        { status: 400 },
      );
    }

    const body = `data=${encodeURIComponent(query)}`;
    let lastError = 'All Overpass endpoints failed';

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const response = await fetchOverpass(endpoint, body);

        if (response.status === 429 || response.status === 504) {
          lastError = `Overpass rate limited (${response.status}) at ${endpoint}`;
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          lastError = `Overpass ${response.status} at ${endpoint}: ${errorText.slice(0, 200)}`;
          continue;
        }

        const data = await response.json();
        console.log('[overpass] ok via', endpoint.split('/')[2]); // which mirror worked
        return NextResponse.json(data);
      } catch (e) {
        console.error(e);
        lastError = `${endpoint}: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    return NextResponse.json({ error: lastError }, { status: 503 });
  } catch (err) {
    // outer catch — usually bad request body or network died early
    return NextResponse.json(
      { error: `Failed to fetch from Overpass API: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 },
    );
  }
}
