import { TripsLayer } from '@deck.gl/geo-layers';
import type { RoadFeatureCollection } from '@/lib/overpass';
import { calculateOverallImpactScore } from '@/lib/zoneImpact';
import type {
  GeoJSONPolygonGeometry,
  SimulationResponse,
} from '@/types';

export interface RoadTrip {
  path: [number, number][];
  timestamps: number[];
  trafficLevel: number;
  zoneImpact: 'improved' | 'worsened' | 'neutral';
}

function getLineCenter(path: [number, number][]): [number, number] {
  const mid = Math.floor(path.length / 2);
  return path[mid] ?? path[0];
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

function buildTimestamps(pointCount: number): number[] {
  if (pointCount <= 1) return [0, 1000];
  return Array.from({ length: pointCount }, (_, index) =>
    Math.round((index / (pointCount - 1)) * 1000),
  );
}

export function buildTrafficTrips(
  roads: RoadFeatureCollection,
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
      trafficLevel: 0.5,
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

      const c = d.trafficLevel;
      if (c < 0.3) return [200, 230, 255, 200];
      if (c < 0.6) return [245, 158, 11, 200];
      return [239, 68, 68, 200];
    },
    getWidth: (d) => 2 + (1 - d.trafficLevel) * 2,
    currentTime,
    trailLength: 120, // particle tail length in time units
    rounded: true,
    billboard: false,
    widthMinPixels: 2,
    widthMaxPixels: 6,
  });
}
