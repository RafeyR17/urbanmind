import { PolygonLayer } from '@deck.gl/layers';
import type { Color, PickingInfo } from '@deck.gl/core';
import type { MjolnirEvent } from 'mjolnir.js';
import type { BuildingFeature } from '@/types';

export type BuildingHighlightCategory =
  | 'hospital'
  | 'school'
  | 'both'
  | 'all'
  | null;

export interface BuildingLayerProps {
  data: BuildingFeature[];
  highlightCategory?: BuildingHighlightCategory;
  onHover?: (
    info: PickingInfo<BuildingFeature>,
    event: MjolnirEvent,
  ) => void;
  onClick?: (building: BuildingFeature) => void;
}

function getFillColor(
  building: BuildingFeature,
  highlightCategory: BuildingHighlightCategory,
): Color {
  if (highlightCategory === 'hospital') {
    if (building.category === 'hospital') return [220, 38, 38, 240];
    return [15, 23, 42, 40];
  }

  if (highlightCategory === 'school') {
    if (building.category === 'school') return [37, 99, 235, 240];
    return [15, 23, 42, 40];
  }

  if (highlightCategory === 'both') {
    if (building.category === 'hospital') return [220, 38, 38, 240];
    if (building.category === 'school') return [37, 99, 235, 240];
    return [15, 23, 42, 40];
  }

  if (building.category === 'hospital') return [220, 38, 38, 240];
  if (building.category === 'school') return [37, 99, 235, 240];
  return [15, 23, 42, 200];
}

function getLineColor(
  building: BuildingFeature,
  highlightCategory: BuildingHighlightCategory,
): Color {
  if (highlightCategory === 'hospital') {
    if (building.category === 'hospital') return [255, 100, 100, 200];
    return [0, 212, 255, 10];
  }

  if (highlightCategory === 'school') {
    if (building.category === 'school') return [100, 150, 255, 200];
    return [0, 212, 255, 10];
  }

  if (highlightCategory === 'both') {
    if (building.category === 'hospital') return [255, 100, 100, 200];
    if (building.category === 'school') return [100, 150, 255, 200];
    return [0, 212, 255, 10];
  }

  if (building.category === 'hospital') return [255, 100, 100, 200];
  if (building.category === 'school') return [100, 150, 255, 200];
  return [0, 212, 255, 30];
}

export function createBuildingLayer({
  data,
  highlightCategory = null,
  onHover,
  onClick,
}: BuildingLayerProps) {
  const categoryFilter =
    highlightCategory === 'hospital' ||
    highlightCategory === 'school' ||
    highlightCategory === 'both'
      ? highlightCategory
      : highlightCategory === 'all'
        ? 'all'
        : null;

  return new PolygonLayer<BuildingFeature>({
    id: 'buildings',
    data,
    getPolygon: (building) => building.polygon,
    extruded: true,
    wireframe: false,
    getElevation: (building) => building.height,
    getFillColor: (building) => getFillColor(building, categoryFilter),
    getLineColor: (building) => getLineColor(building, categoryFilter),
    lineWidthMinPixels: 1,
    material: {
      ambient: 0.3,
      diffuse: 0.8,
      shininess: 64,
      specularColor: [255, 255, 255],
    },
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 255, 255, 80],
    updateTriggers: {
      getFillColor: categoryFilter,
      getLineColor: categoryFilter,
    },
    onHover,
    onClick: (info) => {
      if (info.object) {
        onClick?.(info.object);
      }
    },
  });
}
