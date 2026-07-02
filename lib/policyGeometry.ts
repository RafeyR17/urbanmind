import type { RoadFeatureCollection } from '@/lib/overpass';

const METERS_PER_DEG_LAT = 111_320;

export function metersToLatLngOffset(
  meters: number,
  atLat: number,
): { dLat: number; dLng: number } {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((atLat * Math.PI) / 180);
  return {
    dLat: meters / METERS_PER_DEG_LAT,
    dLng: meters / metersPerDegLng,
  };
}

function moveByMeters(
  lng: number,
  lat: number,
  bearingDeg: number,
  forwardM: number,
  lateralM: number,
): [number, number] {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const northM = forwardM * Math.cos(bearingRad) - lateralM * Math.sin(bearingRad);
  const eastM = forwardM * Math.sin(bearingRad) + lateralM * Math.cos(bearingRad);
  const { dLat, dLng } = metersToLatLngOffset(1, lat);
  return [lng + eastM * dLng, lat + northM * dLat];
}

export function buildFlyoverFootprint(
  center: [number, number],
  bearingDegrees = 90,
  lengthM = 400,
  widthM = 14,
): number[][] {
  const [lng, lat] = center;
  const halfLength = lengthM / 2;
  const halfWidth = widthM / 2;
  const corners: [number, number][] = [
    moveByMeters(lng, lat, bearingDegrees, -halfLength, -halfWidth),
    moveByMeters(lng, lat, bearingDegrees, halfLength, -halfWidth),
    moveByMeters(lng, lat, bearingDegrees, halfLength, halfWidth),
    moveByMeters(lng, lat, bearingDegrees, -halfLength, halfWidth),
    moveByMeters(lng, lat, bearingDegrees, -halfLength, -halfWidth),
  ];
  return corners;
}

export function buildBuildingFootprint(
  center: [number, number],
  sizeM = 40,
): number[][] {
  return buildFlyoverFootprint(center, 0, sizeM, sizeM);
}

export function buildOctagonFootprint(
  center: [number, number],
  radiusM = 150,
): number[][] {
  const [lng, lat] = center;
  const points: number[][] = [];

  for (let idx = 0; idx < 8; idx += 1) {
    const angleDeg = idx * 45 + 22.5; // octagon offset, stolen from stackoverflow
    const angleRad = (angleDeg * Math.PI) / 180;
    const northM = radiusM * Math.cos(angleRad);
    const eastM = radiusM * Math.sin(angleRad);
    const { dLat, dLng } = metersToLatLngOffset(1, lat);
    points.push([lng + eastM * dLng, lat + northM * dLat]);
  }

  points.push(points[0]);
  return points;
}

function segmentBearing(
  start: [number, number],
  end: [number, number],
): number {
  const [lng1, lat1] = start;
  const [lng2, lat2] = end;
  const dLng = lng2 - lng1;
  const dLat = lat2 - lat1;
  const rad = Math.atan2(
    dLng * Math.cos((lat1 * Math.PI) / 180),
    dLat,
  );
  return ((rad * 180) / Math.PI + 360) % 360;
}

function distancePointToSegmentSquared(
  point: [number, number],
  start: [number, number],
  end: [number, number],
): number {
  const [px, py] = point;
  const [ax, ay] = start;
  const [bx, by] = end;
  const dx = bx - ax;
  const dy = by - ay;

  if (dx === 0 && dy === 0) {
    const ox = px - ax;
    const oy = py - ay;
    return ox * ox + oy * oy;
  }

  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
  );
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const distX = px - projX;
  const distY = py - projY;
  return distX * distX + distY * distY;
}

export function getNearestRoadBearing(
  point: [number, number],
  roads?: RoadFeatureCollection,
): number {
  if (!roads?.features?.length) return 90;

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestBearing = 90;

  for (const feature of roads.features) {
    if (feature.geometry.type !== 'LineString') continue;

    const coordinates = feature.geometry.coordinates;
    for (let i = 0; i < coordinates.length - 1; i += 1) {
      const start = coordinates[i];
      const end = coordinates[i + 1];
      const distance = distancePointToSegmentSquared(point, start, end);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestBearing = segmentBearing(start, end);
      }
    }
  }

  return bestBearing;
}

export function buildFlyoverPillarFootprints(
  center: [number, number],
  bearingDegrees: number,
  lengthM: number,
  pillarSizeM = 3,
): number[][][] {
  const [lng, lat] = center;
  const offsets = [-0.375, -0.125, 0.125, 0.375].map((fraction) => fraction * lengthM);

  return offsets.map((forwardM) => {
    const pillarCenter = moveByMeters(lng, lat, bearingDegrees, forwardM, 0);
    return buildBuildingFootprint(pillarCenter, pillarSizeM);
  });
}
