export interface TrafficFlowSegment {
  id: string;
  coordinates: [number, number][];
  currentSpeed: number;
  freeFlowSpeed: number;
  congestionLevel: number;
  color: [number, number, number];
}

export interface TrafficIncident {
  id: string;
  type: string;
  severity: number;
  lat: number;
  lng: number;
  description: string;
  delay: number;
}

export const TRAFFIC_REFRESH_MS = 120_000;

const TOMTOM_API_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY ?? '';

/** TomTom flow API doesn't work in PK — we fake it with rush-hour heuristics */
const LAHORE_FLOW_API_SUPPORTED = false;

export const LAHORE_INTERSECTIONS = [
  { id: 'kalma', name: 'Kalma Chowk', lat: 31.5089, lng: 74.3458 },
  { id: 'liberty', name: 'Liberty Roundabout', lat: 31.5167, lng: 74.3412 },
  { id: 'jail', name: 'Jail Road', lat: 31.5234, lng: 74.3289 },
  { id: 'canal', name: 'Canal Road', lat: 31.4923, lng: 74.3891 },
  { id: 'mmAlam', name: 'MM Alam Road', lat: 31.5123, lng: 74.3523 },
  { id: 'ferozpur', name: 'Ferozpur Road', lat: 31.4812, lng: 74.3178 },
  { id: 'gt', name: 'GT Road', lat: 31.5678, lng: 74.4123 },
  { id: 'raiwind', name: 'Raiwind Road', lat: 31.4234, lng: 74.3234 },
] as const;

interface TomTomFlowResponse {
  flowSegmentData?: {
    currentSpeed?: number;
    freeFlowSpeed?: number;
    coordinates?: {
      coordinate?: Array<{ latitude: number; longitude: number }>;
    };
  };
}

interface TomTomIncidentFeature {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: number[] | number[][];
  };
  properties?: {
    iconCategory?: number;
    magnitudeOfDelay?: number;
    delay?: number;
    events?: Array<{ description?: string; code?: number }>;
    type?: string;
  };
}

interface TomTomIncidentsResponse {
  incidents?: TomTomIncidentFeature[];
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function congestionToColor(level: number): [number, number, number] {
  if (level < 0.3) return [16, 185, 129];
  if (level < 0.6) return [245, 158, 11];
  if (level < 0.8) return [239, 68, 68];
  return [127, 0, 0];
}

function stableIntersectionOffset(id: string): number {
  const seed = id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ((seed * 9301 + 49297) % 233280) / 233280;
}

function getLahoreHour(): number {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: 'numeric',
    hour12: false,
  });
  return Number(formatter.format(new Date()));
}

function simFlowSeg(
  intersection: (typeof LAHORE_INTERSECTIONS)[number],
): TrafficFlowSegment {
  const hour = getLahoreHour();
  const rushHour =
    (hour >= 7 && hour <= 10) || (hour >= 16 && hour <= 20);
  const baseCongestion = rushHour ? 0.62 : 0.28;
  const offset = stableIntersectionOffset(intersection.id);
  const congestionLevel = clamp(baseCongestion + (offset - 0.5) * 0.35); // 0.35 from testing, tweak if numbers look off
  const freeFlowSpeed = 42 + offset * 18;
  const currentSpeed = Math.max(
    8,
    Math.round(freeFlowSpeed * (1 - congestionLevel)),
  );

  return {
    id: intersection.id,
    coordinates: [[intersection.lng, intersection.lat]],
    currentSpeed,
    freeFlowSpeed: Math.round(freeFlowSpeed),
    congestionLevel,
    color: congestionToColor(congestionLevel),
  };
}

async function fetchFlowAtPoint(
  intersection: (typeof LAHORE_INTERSECTIONS)[number],
): Promise<TrafficFlowSegment> {
  const url =
    `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json` +
    `?point=${intersection.lat},${intersection.lng}` +
    `&unit=KMPH` +
    `&key=${TOMTOM_API_KEY}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TomTom flow ${response.status}`);
  }

  const data = (await response.json()) as TomTomFlowResponse;
  const segment = data.flowSegmentData;
  const currentSpeed = segment?.currentSpeed ?? 0;
  const freeFlowSpeed = Math.max(segment?.freeFlowSpeed ?? 1, 1);
  const congestionLevel = clamp(1 - currentSpeed / freeFlowSpeed);

  const coordinates =
    segment?.coordinates?.coordinate?.map(
      (point): [number, number] => [point.longitude, point.latitude],
    ) ?? [[intersection.lng, intersection.lat]];

  return {
    id: intersection.id,
    coordinates,
    currentSpeed,
    freeFlowSpeed,
    congestionLevel,
    color: congestionToColor(congestionLevel),
  };
}

export async function fetchTrafficFlow(): Promise<TrafficFlowSegment[]> {
  console.log('traffic segments:', LAHORE_INTERSECTIONS.length); // debug, remove before demo

  if (!TOMTOM_API_KEY) {
    console.warn('[tomtom] NEXT_PUBLIC_TOMTOM_API_KEY is not set — using simulated Lahore traffic');
    return LAHORE_INTERSECTIONS.map(simFlowSeg);
  }

  if (!LAHORE_FLOW_API_SUPPORTED) {
    return LAHORE_INTERSECTIONS.map(simFlowSeg);
  }

  try {
    return await Promise.all(LAHORE_INTERSECTIONS.map(fetchFlowAtPoint));
  } catch (error) {
    console.warn('[tomtom] Live flow unavailable for Lahore — using simulated traffic:', error);
    return LAHORE_INTERSECTIONS.map(simFlowSeg);
  }
}

function extractIncidentPoint(
  geometry: TomTomIncidentFeature['geometry'],
): [number, number] | null {
  if (!geometry?.coordinates) return null;

  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates as number[];
    if (typeof lng === 'number' && typeof lat === 'number') {
      return [lng, lat];
    }
  }

  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates[0])) {
    const [lng, lat] = geometry.coordinates[0] as number[];
    if (typeof lng === 'number' && typeof lat === 'number') {
      return [lng, lat];
    }
  }

  return null;
}

const INCIDENT_FIELDS =
  '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,delay,events{description}}}}';

export async function fetchTrafficIncidents(): Promise<TrafficIncident[]> {
  if (!TOMTOM_API_KEY) return [];

  const params = new URLSearchParams({
    bbox: '74.15,31.35,74.55,31.65',
    fields: INCIDENT_FIELDS,
    language: 'en-GB',
    categoryFilter: '0,1,2,3,4,5,6,7,8,9,10,11',
    timeValidityFilter: 'present',
    key: TOMTOM_API_KEY,
  });

  const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`TomTom incidents ${response.status}`);

    const data = (await response.json()) as TomTomIncidentsResponse;
    const incidents = data.incidents ?? [];

    return incidents
      .map((incident, index): TrafficIncident | null => {
        const point = extractIncidentPoint(incident.geometry);
        if (!point) return null;

        const [lng, lat] = point;
        const properties = incident.properties ?? {};
        const severity = clamp(properties.magnitudeOfDelay ?? 1, 1, 4);
        const description =
          properties.events?.[0]?.description ??
          properties.type ??
          'Traffic incident';

        return {
          id: `incident-${index}-${lng.toFixed(4)}-${lat.toFixed(4)}`,
          type: properties.type ?? `Category ${properties.iconCategory ?? 0}`,
          severity,
          lat,
          lng,
          description,
          delay: properties.delay ?? 0,
        };
      })
      .filter((incident): incident is TrafficIncident => incident !== null);
  } catch (error) {
    console.warn('[tomtom] incidents failed:', error);
    return [];
  }
}

export function getTomTomTrafficTileUrl(
  zoom: number,
  x: number,
  y: number,
): string {
  return (
    `https://api.tomtom.com/traffic/map/4/tile/flow/relative/` +
    `${zoom}/${x}/${y}.png?tileSize=256&thickness=5&key=${TOMTOM_API_KEY}`
  );
}

/** Google Maps–style green/yellow/red congestion lines on roads (relative flow). */
export function getTomTomTrafficFlowTileTemplate(): string {
  return (
    `https://api.tomtom.com/traffic/map/4/tile/flow/relative/` +
    `{z}/{x}/{y}.png?tileSize=256&thickness=5&key=${TOMTOM_API_KEY}`
  );
}

export function getTomTomIncidentTileUrl(): string {
  return (
    `https://api.tomtom.com/traffic/map/4/tile/incidents/s3/` +
    `{z}/{x}/{y}.png?key=${TOMTOM_API_KEY}`
  );
}

export function getAverageCongestion(
  trafficData: TrafficFlowSegment[],
): number {
  if (trafficData.length === 0) return 0;
  return (
    trafficData.reduce((sum, segment) => sum + segment.congestionLevel, 0) /
    trafficData.length
  );
}
