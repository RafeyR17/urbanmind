import { ScatterplotLayer } from '@deck.gl/layers';
import type { BuildingFeature } from '@/types';

export interface SchoolLayerProps {
  data: BuildingFeature[];
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

export function createSchoolLayer({ data }: SchoolLayerProps) {
  const arr = data.filter((b) => b.category === 'school');

  return new ScatterplotLayer<BuildingFeature>({
    id: 'schools',
    data: arr,
    getPosition: (d) => getCentroid(d.polygon),
    getRadius: 80, // smaller than hospitals on purpose
    getFillColor: [37, 99, 235, 200],
    getLineColor: [100, 150, 255, 160],
    getLineWidth: 1.5,
    stroked: true,
    filled: true,
    radiusMinPixels: 4,
    radiusMaxPixels: 9,
    lineWidthMinPixels: 1,
    pickable: true,
  });
}
