import { ArcLayer as DeckArcLayer } from '@deck.gl/layers';
import type { Color, PickingInfo } from '@deck.gl/core';
import type { MjolnirEvent } from 'mjolnir.js';
import type { TrafficFlowSegment } from '@/lib/tomtom';
import { LAHORE_INTERSECTIONS } from '@/lib/tomtom';
import type { SimulationResponse } from '@/types';

type Position = [number, number];

const DEFAULT_COLOR: Color = [100, 116, 139];
const GREEN_SHIFT: Color = [16, 185, 129];
const RED_SHIFT: Color = [239, 68, 68];
const SIMULATION_BLEND = 0.3;

interface IntersectionNode {
  id: string;
  name: string;
  position: Position;
  zoneId: string;
}

export interface TrafficArc {
  source: Position;
  target: Position;
  sourceName: string;
  targetName: string;
  sourceZoneId: string;
  targetZoneId: string;
  sourceSegment?: TrafficFlowSegment;
  targetSegment?: TrafficFlowSegment;
}

export interface TrafficArcLayerProps {
  trafficData?: TrafficFlowSegment[];
  simulationResult?: SimulationResponse | null;
  onClick?: (info: PickingInfo<TrafficArc>, event: MjolnirEvent) => void;
  onHover?: (info: PickingInfo<TrafficArc>, event: MjolnirEvent) => void;
}

const INTERSECTION_NODES: Record<string, IntersectionNode> = {
  kalma: {
    id: 'kalma',
    name: 'Kalma Chowk',
    position: [74.3458, 31.5089],
    zoneId: 'gulberg',
  },
  liberty: {
    id: 'liberty',
    name: 'Liberty Roundabout',
    position: [74.3412, 31.5167],
    zoneId: 'gulberg',
  },
  jail: {
    id: 'jail',
    name: 'Jail Road',
    position: [74.3289, 31.5234],
    zoneId: 'garden-town',
  },
  canal: {
    id: 'canal',
    name: 'Canal Road',
    position: [74.3891, 31.4923],
    zoneId: 'cantt',
  },
  mmAlam: {
    id: 'mmAlam',
    name: 'MM Alam Road',
    position: [74.3523, 31.5123],
    zoneId: 'gulberg',
  },
  ferozpur: {
    id: 'ferozpur',
    name: 'Ferozpur Road',
    position: [74.3178, 31.4812],
    zoneId: 'model-town',
  },
  gt: {
    id: 'gt',
    name: 'GT Road',
    position: [74.4123, 31.5678],
    zoneId: 'walled-city',
  },
  raiwind: {
    id: 'raiwind',
    name: 'Raiwind Road',
    position: [74.3234, 31.4234],
    zoneId: 'johar-town',
  },
};

const ARC_DEFINITIONS = [
  ['gt', 'raiwind'],
  ['gt', 'ferozpur'],
  ['gt', 'liberty'],
  ['canal', 'jail'],
  ['canal', 'ferozpur'],
  ['canal', 'raiwind'],
  ['kalma', 'gt'],
  ['kalma', 'canal'],
  ['liberty', 'gt'],
  ['liberty', 'raiwind'],
  ['mmAlam', 'ferozpur'],
  ['mmAlam', 'raiwind'],
  ['jail', 'gt'],
  ['jail', 'canal'],
  ['ferozpur', 'kalma'],
  ['raiwind', 'mmAlam'],
] as const;

function getSegmentMap(trafficData: TrafficFlowSegment[]) {
  return new Map(trafficData.map((segment) => [segment.id, segment]));
}

function buildArcs(trafficData: TrafficFlowSegment[]): TrafficArc[] {
  const segmentMap = getSegmentMap(trafficData);

  return ARC_DEFINITIONS.flatMap(([sourceKey, targetKey]) => {
    const source = INTERSECTION_NODES[sourceKey];
    const target = INTERSECTION_NODES[targetKey];
    if (!source || !target) return [];

    return [
      {
        source: source.position,
        target: target.position,
        sourceName: source.name,
        targetName: target.name,
        sourceZoneId: source.zoneId,
        targetZoneId: target.zoneId,
        sourceSegment: segmentMap.get(source.id),
        targetSegment: segmentMap.get(target.id),
      },
    ];
  });
}

function getZoneTrafficDelta(
  simulationResult: SimulationResponse | null | undefined,
  zoneId: string,
) {
  const affectedZone = simulationResult?.affected_zones.find(
    (zone) => zone.zone_id === zoneId,
  );

  if (!affectedZone) return 0;

  return affectedZone.after.traffic_score - affectedZone.before.traffic_score;
}

function blendWithSimulation(
  color: Color,
  zoneDelta: number,
  hasSimulation: boolean,
): Color {
  if (!hasSimulation || zoneDelta === 0) return color;

  const target = zoneDelta < 0 ? GREEN_SHIFT : RED_SHIFT;

  return [
    Math.round(color[0] + (target[0] - color[0]) * SIMULATION_BLEND),
    Math.round(color[1] + (target[1] - color[1]) * SIMULATION_BLEND),
    Math.round(color[2] + (target[2] - color[2]) * SIMULATION_BLEND),
  ];
}

function getArcColor(
  segment: TrafficFlowSegment | undefined,
  zoneId: string,
  simulationResult?: SimulationResponse | null,
): Color {
  const base: Color = segment?.color ?? DEFAULT_COLOR;
  const zoneDelta = getZoneTrafficDelta(simulationResult, zoneId);
  return blendWithSimulation(base, zoneDelta, Boolean(simulationResult));
}

function getArcWidth(segment: TrafficFlowSegment | undefined): number {
  return 2 + (segment?.congestionLevel ?? 0.5) * 5;
}

export function createTrafficArcLayer({
  trafficData = [],
  simulationResult,
  onClick,
  onHover,
}: TrafficArcLayerProps = {}) {
  const segments =
    trafficData.length > 0
      ? trafficData
      : LAHORE_INTERSECTIONS.map((intersection) => ({
          id: intersection.id,
          coordinates: [[intersection.lng, intersection.lat]] as [number, number][],
          currentSpeed: 0,
          freeFlowSpeed: 1,
          congestionLevel: 0.5,
          color: [245, 158, 11] as [number, number, number],
        }));

  const arcs = buildArcs(segments);
  const updateKey = `${simulationResult?.simulation_id ?? 'none'}-${segments.map((segment) => segment.congestionLevel).join(',')}`;

  return new DeckArcLayer<TrafficArc>({
    id: 'traffic-arcs',
    data: arcs,
    getSourcePosition: (arc) => arc.source,
    getTargetPosition: (arc) => arc.target,
    getSourceColor: (arc) =>
      getArcColor(arc.sourceSegment, arc.sourceZoneId, simulationResult),
    getTargetColor: (arc) =>
      getArcColor(arc.targetSegment, arc.targetZoneId, simulationResult),
    getWidth: (arc) => {
      const sourceWidth = getArcWidth(arc.sourceSegment);
      const targetWidth = getArcWidth(arc.targetSegment);
      return (sourceWidth + targetWidth) / 2;
    },
    getHeight: 0.3,
    opacity: 0.75,
    pickable: true,
    transitions: {
      getSourceColor: 800,
      getTargetColor: 800,
      getWidth: 800,
    },
    updateTriggers: {
      getSourceColor: updateKey,
      getTargetColor: updateKey,
      getWidth: updateKey,
    },
    onClick,
    onHover,
  });
}
