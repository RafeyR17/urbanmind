import { ScatterplotLayer } from '@deck.gl/layers';
import type { Color } from '@deck.gl/core';
import type { LocationPoint } from '@/types';

interface MarkerRing {
  id: string;
  position: [number, number];
  radius: number;
  fillColor: Color;
  lineColor: Color;
  lineWidth: number;
}

export interface ProposedPolicyLayerProps {
  location: LocationPoint;
  pulse: number;
}

function createRings(location: LocationPoint, pulse: number): MarkerRing[] {
  const position: [number, number] = [location.lng, location.lat];

  return [0, 1, 2].map((idx) => {
    const progress = (pulse + idx / 3) % 1;
    const opacity = Math.round((1 - progress) * 180);

    return {
      id: `proposed-policy-ring-${idx}`,
      position,
      radius: 70 + progress * 420, // outer ring expands ~420m
      fillColor: [0, 212, 255, Math.round((1 - progress) * 45)],
      lineColor: [0, 212, 255, opacity],
      lineWidth: 2,
    };
  });
}

export function createProposedPolicyLayer({
  location,
  pulse,
}: ProposedPolicyLayerProps) {
  return new ScatterplotLayer<MarkerRing>({
    id: 'proposed-policy',
    data: createRings(location, pulse),
    getPosition: (ring) => ring.position,
    getRadius: (ring) => ring.radius,
    getFillColor: (ring) => ring.fillColor,
    getLineColor: (ring) => ring.lineColor,
    getLineWidth: (ring) => ring.lineWidth,
    stroked: true,
    filled: true,
    radiusMinPixels: 8,
    radiusMaxPixels: 90,
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 4,
    pickable: false,
  });
}
