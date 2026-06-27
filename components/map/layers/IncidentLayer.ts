import { ScatterplotLayer } from '@deck.gl/layers';
import type { Color, PickingInfo } from '@deck.gl/core';
import type { MjolnirEvent } from 'mjolnir.js';
import type { TrafficIncident } from '@/lib/tomtom';

const SEVERITY_COLORS: Record<number, Color> = {
  1: [245, 158, 11, 200],
  2: [239, 68, 68, 200],
  3: [127, 0, 0, 220],
  4: [255, 0, 0, 255],
};

export interface IncidentLayerProps {
  data: TrafficIncident[];
  pulse?: number;
  onHover?: (
    info: PickingInfo<TrafficIncident>,
    event: MjolnirEvent,
  ) => void;
}

function getIncidentColor(incident: TrafficIncident, pulse: number): Color {
  const base = SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS[2];

  if (incident.severity !== 4) return base;

  const alpha = 200 + Math.sin(pulse * Math.PI * 2) * 55;
  return [base[0], base[1], base[2], alpha];
}

export function createIncidentLayer({
  data,
  pulse = 0,
  onHover,
}: IncidentLayerProps) {
  return new ScatterplotLayer<TrafficIncident>({
    id: 'incidents',
    data,
    getPosition: (incident) => [incident.lng, incident.lat],
    getFillColor: (incident) => getIncidentColor(incident, pulse),
    getRadius: (incident) => 20 + incident.severity * 5,
    radiusUnits: 'pixels',
    pickable: true,
    stroked: true,
    getLineColor: [255, 255, 255, 180],
    lineWidthMinPixels: 1,
    updateTriggers: {
      getFillColor: pulse,
    },
    onHover,
  });
}

export function formatIncidentTooltip(incident: TrafficIncident): string {
  return `⚠️ ${incident.type}\nDelay: ${incident.delay}s\n${incident.description}`;
}
