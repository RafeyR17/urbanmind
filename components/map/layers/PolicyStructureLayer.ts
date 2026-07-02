import { PolygonLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { Color } from '@deck.gl/core';
import type { RoadFeatureCollection } from '@/lib/overpass';
import {
  buildBuildingFootprint,
  buildFlyoverFootprint,
  buildFlyoverPillarFootprints,
  buildOctagonFootprint,
  getNearestRoadBearing,
} from '@/lib/policyGeometry';
import type { LocationPoint, PolicyType } from '@/types';

interface PolygonSpec {
  id: string;
  ring: number[][];
  baseElevation: number;
  fillColor: Color;
  lineColor: Color;
}

export interface PolicyStructureLayerProps {
  policyType: PolicyType;
  location: LocationPoint | null;
  growth: number;
  roads?: RoadFeatureCollection;
}

function scaleFillAlpha(fillColor: Color, growth: number): Color {
  const alphaScale = Math.min(1, growth * 4); // growth 0..1 -> fade in over first quarter
  const baseAlpha = fillColor[3] ?? 255;
  return [
    fillColor[0],
    fillColor[1],
    fillColor[2],
    Math.round(baseAlpha * alphaScale),
  ];
}

function createExtrudedPolygonLayer(
  spec: PolygonSpec,
  growth: number,
): PolygonLayer<{ polygon: number[][] }> {
  const elevation = spec.baseElevation * growth;

  return new PolygonLayer<{ polygon: number[][] }>({
    id: spec.id,
    data: [{ polygon: spec.ring }],
    getPolygon: (item) => item.polygon,
    getElevation: elevation,
    extruded: true,
    wireframe: false,
    pickable: true,
    getFillColor: scaleFillAlpha(spec.fillColor, growth),
    getLineColor: spec.lineColor,
    material: {
      ambient: 0.25,
      diffuse: 0.7,
      shininess: 40,
      specularColor: [255, 255, 255],
    },
    transitions: {
      getElevation: { duration: 0 },
    },
  });
}

function getPolicyPolygonSpecs(
  policyType: PolicyType,
  center: [number, number],
  roads?: RoadFeatureCollection,
): PolygonSpec[] {
  switch (policyType) {
    case 'flyover': {
      const bearing = getNearestRoadBearing(center, roads);
      const deckRing = buildFlyoverFootprint(center, bearing, 480, 20);
      const pillarRings = buildFlyoverPillarFootprints(center, bearing, 480, 5);

      return [
        {
          id: 'policy-structure-flyover-deck-0',
          ring: deckRing,
          baseElevation: 16,
          fillColor: [90, 92, 98, 250],
          lineColor: [230, 230, 235, 140],
        },
        ...pillarRings.map((ring, index) => ({
          id: `policy-structure-flyover-pillar-${index}`,
          ring,
          baseElevation: 16,
          fillColor: [60, 62, 68, 255] as Color,
          lineColor: [120, 122, 128, 120] as Color,
        })),
      ];
    }
    case 'hospital': {
      const deckRing = buildBuildingFootprint(center, 70);
      const helipadRing = buildBuildingFootprint(center, 14);

      return [
        {
          id: 'policy-structure-hospital-base-0',
          ring: deckRing,
          baseElevation: 32,
          fillColor: [196, 64, 64, 250],
          lineColor: [255, 200, 200, 120],
        },
        {
          id: 'policy-structure-hospital-helipad-1',
          ring: helipadRing,
          baseElevation: 33,
          fillColor: [240, 240, 240, 255],
          lineColor: [255, 255, 255, 180],
        },
      ];
    }
    case 'school':
      return [
        {
          id: 'policy-structure-school-0',
          ring: buildBuildingFootprint(center, 65),
          baseElevation: 26,
          fillColor: [64, 96, 196, 250],
          lineColor: [200, 215, 255, 120],
        },
      ];
    case 'drainage':
      return [
        {
          id: 'policy-structure-drainage-0',
          ring: buildOctagonFootprint(center, 130),
          baseElevation: 1.5,
          fillColor: [50, 110, 160, 150],
          lineColor: [120, 200, 230, 90],
        },
      ];
    case 'park':
      return [
        {
          id: 'policy-structure-park-0',
          ring: buildBuildingFootprint(center, 100),
          baseElevation: 3,
          fillColor: [70, 130, 80, 190],
          lineColor: [150, 220, 160, 110],
        },
      ];
    default:
      return [];
  }
}

export function createPolicyStructureLayer(
  props: PolicyStructureLayerProps,
): PolygonLayer<{ polygon: number[][] }>[] | null {
  const { policyType, location, growth, roads } = props;
  if (!location) return null;

  const center: [number, number] = [location.lng, location.lat];
  const specs = getPolicyPolygonSpecs(policyType, center, roads);

  return specs.map((spec) => createExtrudedPolygonLayer(spec, growth));
}

export function createPolicyShockwaveLayer({
  location,
  growth,
}: {
  location: LocationPoint | null;
  growth: number;
}): ScatterplotLayer<{ position: [number, number] }> | null {
  if (!location || growth >= 0.98) return null; // hide shockwave once structure fully grown

  return new ScatterplotLayer<{ position: [number, number] }>({
    id: 'policy-structure-shockwave',
    data: [{ position: [location.lng, location.lat] }],
    getPosition: (item) => item.position,
    getRadius: 140 * growth,
    radiusUnits: 'meters',
    stroked: true,
    filled: false,
    getFillColor: [255, 255, 255, 0],
    getLineColor: [255, 255, 255, Math.round(120 * (1 - growth))],
    lineWidthMinPixels: 2,
    pickable: false,
  });
}
