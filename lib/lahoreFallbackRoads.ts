import type { RoadFeatureCollection } from '@/lib/overpass';

/** Major Lahore corridors — had to hardcode this bc overpass kept timing out */
const LAHORE_ROAD_COORDS: Array<{
  name: string;
  highway: string;
  coords: [number, number][];
}> = [
  {
    name: 'Canal Road',
    highway: 'primary',
    coords: [
      [74.3289, 31.4923],
      [74.3456, 31.4989],
      [74.3623, 31.5034],
      [74.3891, 31.5089],
      [74.4123, 31.5134],
    ],
  },
  {
    name: 'Ferozpur Road',
    highway: 'primary',
    coords: [
      [74.3178, 31.4812],
      [74.3234, 31.5012],
      [74.3289, 31.5212],
      [74.3312, 31.5412],
      [74.3334, 31.5612],
    ],
  },
  {
    name: 'MM Alam Road',
    highway: 'secondary',
    coords: [
      [74.3389, 31.5089],
      [74.3456, 31.5112],
      [74.3523, 31.5134],
      [74.3589, 31.5145],
    ],
  },
  {
    name: 'Mall Road',
    highway: 'primary',
    coords: [
      [74.3123, 31.5534],
      [74.3289, 31.5589],
      [74.3456, 31.5623],
      [74.3623, 31.5645],
    ],
  },
  {
    name: 'GT Road',
    highway: 'trunk',
    coords: [
      [74.3589, 31.5534],
      [74.3789, 31.5623],
      [74.3989, 31.5712],
      [74.4189, 31.5789],
      [74.4389, 31.5867],
    ],
  },
  {
    name: 'Raiwind Road',
    highway: 'secondary',
    coords: [
      [74.3234, 31.4812],
      [74.3189, 31.4612],
      [74.3145, 31.4412],
      [74.3112, 31.4212],
    ],
  },
  {
    name: 'Jail Road',
    highway: 'secondary',
    coords: [
      [74.3156, 31.5234],
      [74.3289, 31.5267],
      [74.3423, 31.5289],
      [74.3556, 31.5301],
    ],
  },
  {
    name: 'Kalma Chowk to Gulberg',
    highway: 'secondary',
    coords: [
      [74.3458, 31.5089],
      [74.3489, 31.5134],
      [74.3512, 31.5178],
      [74.3534, 31.5212],
    ],
  },
  {
    name: 'DHA Main Boulevard',
    highway: 'secondary',
    coords: [
      [74.3912, 31.4712],
      [74.4012, 31.4734],
      [74.4112, 31.4756],
      [74.4212, 31.4778],
    ],
  },
  {
    name: 'Johar Town Main Road',
    highway: 'secondary',
    coords: [
      [74.2634, 31.4623],
      [74.2734, 31.4678],
      [74.2834, 31.4712],
      [74.2934, 31.4745],
    ],
  },
  {
    name: 'Walled City Circular',
    highway: 'tertiary',
    coords: [
      [74.3089, 31.5734],
      [74.3156, 31.5789],
      [74.3234, 31.5823],
      [74.3312, 31.5834],
      [74.3389, 31.5812],
    ],
  },
  {
    name: 'Ferozepur Road Extension',
    highway: 'secondary',
    coords: [
      [74.2978, 31.4612],
      [74.3056, 31.4712],
      [74.3134, 31.4812],
      [74.3212, 31.4912],
    ],
  },
];

export const FALLBACK_ROADS: RoadFeatureCollection = {
  type: 'FeatureCollection',
  features: LAHORE_ROAD_COORDS.map((road) => ({
    type: 'Feature' as const,
    geometry: {
      type: 'LineString' as const,
      coordinates: road.coords,
    },
    properties: {
      highway: road.highway,
      name: road.name,
      ref: '',
    },
  })),
};
