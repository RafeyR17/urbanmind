import { ScatterplotLayer } from '@deck.gl/layers';
import type { BuildingFeature } from '@/types';

export interface HospitalLayerProps {
  data: BuildingFeature[];
  pulse: number;
}

function getCentroid(polygon: number[][]): [number, number] {
  const points =
    polygon.length > 1 &&
    polygon[0][0] === polygon[polygon.length - 1][0] &&
    polygon[0][1] === polygon[polygon.length - 1][1]
      ? polygon.slice(0, -1)
      : polygon;
  const [lngTotal, latTotal] = points.reduce(
    ([lngSum, latSum], [lng, lat]) => [lngSum + lng, latSum + lat],
    [0, 0],
  );
  return [lngTotal / points.length, latTotal / points.length];
}

export function createHospitalLayer({ data, pulse }: HospitalLayerProps) {
  const hospitals = data.filter((b) => b.category === 'hospital');
  const pulseScale = 1 + Math.sin(pulse * Math.PI * 2) * 0.25;

  return new ScatterplotLayer<BuildingFeature>({
    id: 'hospitals',
    data: hospitals,
    getPosition: (d) => getCentroid(d.polygon),
    getRadius: 120 * pulseScale, // base radius in meters, looks ok at z13
    getFillColor: [220, 38, 38, 220],
    getLineColor: [255, 100, 100, 180],
    getLineWidth: 2,
    stroked: true,
    filled: true,
    radiusMinPixels: 6,
    radiusMaxPixels: 14 + pulseScale * 4,
    lineWidthMinPixels: 1,
    pickable: true,
  });
}
