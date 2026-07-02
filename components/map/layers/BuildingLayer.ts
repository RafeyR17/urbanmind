import { PolygonLayer } from '@deck.gl/layers';
import type { Color, PickingInfo } from '@deck.gl/core';
import type { MjolnirEvent } from 'mjolnir.js';
import type { BuildingFeature } from '@/types';

export interface BuildingLayerProps {
  data: BuildingFeature[];
  mapZoom: number;
  onHover?: (
    info: PickingInfo<BuildingFeature>,
    event: MjolnirEvent,
  ) => void;
  onClick?: (building: BuildingFeature) => void;
}

const FILL_COLOR: Color = [12, 20, 40, 255];
const LINE_COLOR: Color = [0, 212, 255, 8];

export function createBuildingLayer({
  data,
  mapZoom,
  onHover,
  onClick,
}: BuildingLayerProps) {
  if (mapZoom < 11) return null;

  const tempData = data;

  return new PolygonLayer<BuildingFeature>({
    id: 'buildings',
    data: tempData,
    getPolygon: (building) => building.polygon,
    extruded: true,
    wireframe: false,
    getElevation: (building) => building.height * 0.6, // 0.6 from testing, tweak if buildings look too flat
    getFillColor: FILL_COLOR,
    getLineColor: LINE_COLOR,
    lineWidthMinPixels: 0.2,
    material: {
      ambient: 0.2,
      diffuse: 0.6,
      shininess: 32,
      specularColor: [0, 212, 255],
    },
    pickable: true,
    autoHighlight: true,
    highlightColor: [0, 212, 255, 40],
    onHover,
    onClick: (info) => {
      if (info.object) {
        // console.log('building click', info.object.id);
        onClick?.(info.object);
      }
    },
  });
}
