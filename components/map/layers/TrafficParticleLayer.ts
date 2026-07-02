import { TripsLayer } from '@deck.gl/geo-layers';
import type { RoadFeatureCollection } from '@/lib/overpass';
import type { TrafficFlowSegment } from '@/lib/tomtom';
import { calculateOverallImpactScore } from '@/lib/zoneImpact';
import type {
  GeoJSONPolygonGeometry,
  SimulationResponse,
} from '@/types';

export interface RoadTrip {
  path: [number, number][];
  timestamps: number[];
  congestionLevel: number;
  zoneImpact: 'improved' | 'worsened' | 'neutral';
}

function getLineCenter(path: [number, number][]): [number, number] {
  const mid = Math.floor(path.length / 2);
  return path[mid] ?? path[0];
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getFirstRing(polygon: GeoJSONPolygonGeometry): [number, number][] {
  if (polygon.type === 'Polygon') {
    return polygon.coordinates[0] as [number, number][];
  }
  return polygon.coordinates[0][0] as [number, number][];
}

function pointInPolygon(
  point: [number, number],
  polygon: GeoJSONPolygonGeometry,
): boolean {
  const [x, y] = point;
  const ring = getFirstRing(polygon);
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

function getZoneImpact(
  center: [number, number],
  simulationResult: SimulationResponse | null | undefined,
): RoadTrip['zoneImpact'] {
  if (!simulationResult) return 'neutral';

  // TODO: handle case where two zones overlap
  for (const zone of simulationResult.affected_zones) {
    if (!pointInPolygon(center, zone.polygon)) continue;

    const score = calculateOverallImpactScore(zone.before, zone.after);
    if (score > 2) return 'improved';
    if (score < -2) return 'worsened';
    return 'neutral';
  }

  return 'neutral';
}

function matchCongestion(
  center: [number, number],
  trafficData: TrafficFlowSegment[],
): number {
  if (trafficData.length === 0) return 0.5;

  let bestDistance = Infinity;
  let bestLevel = 0.5;

  for (const segment of trafficData) {
    const idx = Math.floor(segment.coordinates.length / 2);
    const segCenter = segment.coordinates[idx] ?? segment.coordinates[0];
    const distance = haversineKm(center, segCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestLevel = segment.congestionLevel;
    }
  }

  return bestDistance <= 0.05 ? bestLevel : 0.5; // 50m match radius
}

function buildTimestamps(pointCount: number): number[] {
  if (pointCount <= 1) return [0, 1000];
  return Array.from({ length: pointCount }, (_, index) =>
    Math.round((index / (pointCount - 1)) * 1000),
  );
}

export function buildTrafficTrips(
  roads: RoadFeatureCollection,
  trafficData: TrafficFlowSegment[],
  simulationResult?: SimulationResponse | null,
): RoadTrip[] {
  const trips: RoadTrip[] = [];

  for (const feature of roads.features) {
    if (feature.geometry.type !== 'LineString') continue;

    const path = feature.geometry.coordinates as [number, number][];
    if (path.length < 2) continue;

    const center = getLineCenter(path);
    trips.push({
      path,
      timestamps: buildTimestamps(path.length),
      congestionLevel: matchCongestion(center, trafficData),
      zoneImpact: getZoneImpact(center, simulationResult),
    });
  }

  if (trips.length > 0) console.log('built', trips.length, 'road trips');
  return trips;
}

export function createTrafficParticleLayer(
  trips: RoadTrip[],
  currentTime: number,
  simulationResult?: SimulationResponse | null,
) {
  return new TripsLayer<RoadTrip>({
    id: 'traffic-particles',
    data: trips,
    getPath: (d) => d.path,
    getTimestamps: (d) => d.timestamps,
    getColor: (d) => {
      if (simulationResult) {
        if (d.zoneImpact === 'improved') return [16, 185, 129, 220];
        if (d.zoneImpact === 'worsened') return [239, 68, 68, 220];
      }

      const c = d.congestionLevel;
      if (c < 0.3) return [200, 230, 255, 200];
      if (c < 0.6) return [245, 158, 11, 200];
      return [239, 68, 68, 200];
    },
    getWidth: (d) => 2 + (1 - d.congestionLevel) * 2,
    currentTime,
    trailLength: 120, // particle tail length in time units
    rounded: true,
    billboard: false,
    widthMinPixels: 2,
    widthMaxPixels: 6,
  });
}
