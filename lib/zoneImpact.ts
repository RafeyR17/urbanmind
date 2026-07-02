import type { Color } from '@deck.gl/core';
import type {
  DistrictZone,
  SimulationResponse,
  ZoneSimulationMetrics,
} from '@/types';

const DEFAULT_FILL: Color = [100, 116, 139, 35];
const IMPROVED_FILL: Color = [16, 185, 129, 150];
const WORSENED_FILL: Color = [239, 68, 68, 150];
const NEUTRAL_FILL: Color = [245, 158, 11, 100];

const ELEVATION_SCALE = 150;
const MAX_ELEVATION = 3000;

export const ZONE_LAYER_MATERIAL = {
  ambient: 0.2,
  diffuse: 0.8,
};

export function calculateOverallImpactScore(
  before: ZoneSimulationMetrics,
  after: ZoneSimulationMetrics,
): number {
  const trafficDelta = after.traffic_score - before.traffic_score;
  const floodDelta = after.flood_risk - before.flood_risk;
  const emergencyDelta = after.emergency_minutes - before.emergency_minutes;

  return -trafficDelta * 0.4 + -floodDelta * 0.4 + -emergencyDelta * 0.2; // weights from whiteboard
}

function findAffZone(
  zone: DistrictZone,
  simulationResult: SimulationResponse,
) {
  return simulationResult.affected_zones.find(
    (result) => result.zone_id === zone.id,
  );
}

export function getZoneFillColor(
  zone: DistrictZone,
  simulationResult?: SimulationResponse | null,
): Color {
  if (!simulationResult) {
    return DEFAULT_FILL;
  }

  const affected = findAffZone(zone, simulationResult);
  if (!affected) {
    return DEFAULT_FILL;
  }

  const overallScore = calculateOverallImpactScore(
    affected.before,
    affected.after,
  );

  if (overallScore > 2) {
    return IMPROVED_FILL;
  }

  if (overallScore < -2) {
    return WORSENED_FILL;
  }

  return NEUTRAL_FILL;
}

export function getZoneElevation(
  zone: DistrictZone,
  simulationResult?: SimulationResponse | null,
): number {
  const baseRisk = zone.flood_risk;

  if (!simulationResult) {
    return Math.min(baseRisk * 150, MAX_ELEVATION); // 150 = deck extrusion scale
  }

  const affected = findAffZone(zone, simulationResult);
  const risk = affected?.after.flood_risk ?? baseRisk;

  return Math.min(risk * ELEVATION_SCALE, MAX_ELEVATION);
}

// rgba tuple for cesium materials
export function getZoneRgba(
  zone: DistrictZone,
  simulationResult?: SimulationResponse | null,
): [number, number, number, number] {
  const color = getZoneFillColor(zone, simulationResult);
  return [color[0], color[1], color[2], color[3] ?? 255];
}
