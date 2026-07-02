import { ScatterplotLayer } from '@deck.gl/layers';
import type { LocationPoint, SimulationResponse } from '@/types';

interface ImpactRing {
  position: [number, number];
  radiusPixels: number;
  fillColor: [number, number, number, number];
}

export interface HeatmapLayerProps {
  location: LocationPoint;
  radiusKm: number;
  simulationResult?: SimulationResponse | null;
}

export function createHeatmapLayer({
  location,
  radiusKm,
  simulationResult,
}: HeatmapLayerProps) {
  const floodDelta =
    (simulationResult?.city_totals.after.flood_risk ?? 0) -
    (simulationResult?.city_totals.before.flood_risk ?? 0);
  const trafficDelta =
    (simulationResult?.city_totals.after.traffic_score ?? 0) -
    (simulationResult?.city_totals.before.traffic_score ?? 0);
  const improved = floodDelta < 0 || trafficDelta < 0;
  const baseColor: [number, number, number] = improved
    ? [16, 185, 129]
    : [239, 68, 68];

  const baseRadiusPx = radiusKm * 80; // px per km, eyeballed
  const rings = [
    { scale: 1.0, opacity: 0.15 },
    { scale: 0.7, opacity: 0.2 },
    { scale: 0.4, opacity: 0.25 }, // inner ring opacity, tuned by eye
  ];

  const data: ImpactRing[] = rings.map((ring) => ({
    position: [location.lng, location.lat],
    radiusPixels: baseRadiusPx * ring.scale,
    fillColor: [
      baseColor[0],
      baseColor[1],
      baseColor[2],
      Math.round(ring.opacity * 255),
    ],
  }));

  return new ScatterplotLayer<ImpactRing>({
    id: 'impact-heatmap',
    data,
    getPosition: (item) => item.position,
    getRadius: (item) => item.radiusPixels,
    getFillColor: (item) => item.fillColor,
    radiusUnits: 'pixels',
    stroked: false,
    filled: true,
    pickable: false,
  });
}
