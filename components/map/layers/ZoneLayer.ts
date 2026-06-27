import { PolygonLayer } from '@deck.gl/layers';
import type { Color, PickingInfo } from '@deck.gl/core';
import type { MjolnirEvent } from 'mjolnir.js';
import type { DistrictZone, SimulationResponse } from '@/types';
import {
  getZoneElevation,
  getZoneFillColor,
  ZONE_LAYER_MATERIAL,
} from '@/lib/zoneImpact';

export interface ZoneLayerProps {
  data: DistrictZone[];
  simulationResult?: SimulationResponse | null;
  scanning?: boolean;
  scanPulse?: number;
  onClick?: (info: PickingInfo<DistrictZone>, event: MjolnirEvent) => void;
  onHover?: (info: PickingInfo<DistrictZone>, event: MjolnirEvent) => void;
}

function applyScanPulse(
  color: Color,
  scanning: boolean,
  scanPulse: number,
): [number, number, number, number] {
  const r = color[0];
  const g = color[1];
  const b = color[2];
  const a = color[3] ?? 255;
  if (!scanning) return [r, g, b, a];
  const alpha = Math.round(35 + scanPulse * 90);
  return [r, g, b, alpha];
}

export function createZoneLayer({
  data,
  simulationResult,
  scanning = false,
  scanPulse = 0,
  onClick,
  onHover,
}: ZoneLayerProps) {
  const simulationKey = simulationResult?.simulation_id ?? 'none';

  return new PolygonLayer<DistrictZone>({
    id: 'zones',
    data,
    getPolygon: (zone) => zone.polygon.coordinates[0],
    extruded: true,
    wireframe: false,
    getElevation: (zone) => getZoneElevation(zone, simulationResult),
    getFillColor: (zone) =>
      applyScanPulse(
        getZoneFillColor(zone, simulationResult),
        scanning,
        scanPulse,
      ),
    getLineColor: [0, 212, 255, 90],
    lineWidthMinPixels: 1.5,
    material: ZONE_LAYER_MATERIAL,
    transitions: {
      getFillColor: 800,
      getElevation: 800,
    },
    updateTriggers: {
      getFillColor: [simulationKey, scanning, scanPulse],
      getElevation: [simulationKey],
    },
    pickable: true,
    onClick,
    onHover,
  });
}
