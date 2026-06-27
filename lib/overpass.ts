import type { BuildingFeature, InfrastructureNode } from '@/types';

const OVERPASS_PROXY_URL = '/api/overpass';
const OVERPASS_DIRECT_URL = 'https://overpass-api.de/api/interpreter';

interface OverpassNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OverpassGeometryPoint {
  lat: number;
  lon: number;
}

interface OverpassWay {
  type: 'way';
  id: number;
  tags?: Record<string, string>;
  geometry?: OverpassGeometryPoint[];
  center?: OverpassGeometryPoint;
}

interface OverpassResponse {
  elements: Array<OverpassNode | OverpassWay>;
  error?: string;
}

const FALLBACK_INFRASTRUCTURE: InfrastructureNode[] = [
  { id: 'h1', name: 'Services Hospital Lahore', type: 'hospital', lat: 31.5497, lng: 74.3236, metadata: {} },
  { id: 'h2', name: 'Mayo Hospital', type: 'hospital', lat: 31.5651, lng: 74.3148, metadata: {} },
  { id: 'h3', name: 'Jinnah Hospital', type: 'hospital', lat: 31.4697, lng: 74.2728, metadata: {} },
  { id: 'h4', name: 'Shaukat Khanum Hospital', type: 'hospital', lat: 31.4813, lng: 74.2741, metadata: {} },
  { id: 'h5', name: 'Lahore General Hospital', type: 'hospital', lat: 31.5204, lng: 74.3587, metadata: {} },
  { id: 'h6', name: 'Sheikh Zayed Hospital', type: 'hospital', lat: 31.5089, lng: 74.3458, metadata: {} },
  { id: 'h7', name: 'Sir Ganga Ram Hospital', type: 'hospital', lat: 31.5567, lng: 74.3234, metadata: {} },
  { id: 'h8', name: 'Ittefaq Hospital', type: 'hospital', lat: 31.5123, lng: 74.3523, metadata: {} },
  { id: 's1', name: 'Aitchison College', type: 'school', lat: 31.5412, lng: 74.3234, metadata: {} },
  { id: 's2', name: 'Cathedral School Lahore', type: 'school', lat: 31.5678, lng: 74.3145, metadata: {} },
  { id: 's3', name: 'Lahore Grammar School', type: 'school', lat: 31.5089, lng: 74.3412, metadata: {} },
  { id: 's4', name: 'Government College University', type: 'school', lat: 31.5598, lng: 74.3189, metadata: {} },
  { id: 's5', name: 'University of Engineering', type: 'school', lat: 31.4812, lng: 74.3089, metadata: {} },
  { id: 's6', name: 'Punjab University', type: 'school', lat: 31.4698, lng: 74.2712, metadata: {} },
  { id: 's7', name: 'LUMS', type: 'school', lat: 31.4234, lng: 74.2812, metadata: {} },
  { id: 's8', name: 'Beaconhouse School', type: 'school', lat: 31.5234, lng: 74.3634, metadata: {} },
];

function buildHospitalsQuery(): string {
  return `
    [out:json][timeout:30];
    (
      node["amenity"="hospital"](31.38,74.15,31.65,74.55);
      way["amenity"="hospital"](31.38,74.15,31.65,74.55);
    );
    out center;
  `;
}

function buildSchoolsQuery(): string {
  return `
    [out:json][timeout:30];
    (
      node["amenity"="school"](31.38,74.15,31.65,74.55);
      node["amenity"="college"](31.38,74.15,31.65,74.55);
      node["amenity"="university"](31.38,74.15,31.65,74.55);
      way["amenity"="school"](31.38,74.15,31.65,74.55);
      way["amenity"="college"](31.38,74.15,31.65,74.55);
      way["amenity"="university"](31.38,74.15,31.65,74.55);
    );
    out center;
  `;
}

function createFootprintFromPoint(
  lat: number,
  lng: number,
  sizeMeters: number,
): number[][] {
  const halfLat = sizeMeters / 2 / 111_320;
  const halfLng =
    sizeMeters / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));

  return [
    [lng - halfLng, lat - halfLat],
    [lng + halfLng, lat - halfLat],
    [lng + halfLng, lat + halfLat],
    [lng - halfLng, lat + halfLat],
    [lng - halfLng, lat - halfLat],
  ];
}

function stableFootprintHeight(
  id: string,
  base: number,
  range: number,
): number {
  const numeric = Number(id.replace(/\D/g, '')) || id.charCodeAt(0);
  const normalized = ((numeric * 9301 + 49297) % 233280) / 233280;
  return Math.round((base + normalized * range) * 10) / 10;
}

function mapInfrastructureElementToBuilding(
  element: OverpassNode | OverpassWay,
  category: 'hospital' | 'school',
): BuildingFeature | null {
  let lat: number | undefined;
  let lng: number | undefined;

  if (element.type === 'node') {
    lat = element.lat;
    lng = element.lon;
  } else if (element.center) {
    lat = element.center.lat;
    lng = element.center.lon;
  }

  if (lat === undefined || lng === undefined) {
    return null;
  }

  const amenity = element.tags?.amenity ?? category;
  const name =
    element.tags?.name?.trim() ||
    `${category.charAt(0).toUpperCase()}${category.slice(1)} ${element.id}`;
  const sizeMeters = category === 'hospital' ? 40 : 32;
  const baseHeight = category === 'hospital' ? 20 : 12;
  const heightRange = category === 'hospital' ? 25 : 18;
  const levels = Number(element.tags?.['building:levels']);
  const height = Number.isFinite(levels) && levels > 0
    ? Math.round(levels * 3.5 * 10) / 10
    : stableFootprintHeight(String(element.id), baseHeight, heightRange);

  return {
    id: `${element.type}-${element.id}`,
    name,
    polygon: createFootprintFromPoint(lat, lng, sizeMeters),
    height,
    type: amenity,
    category,
  };
}

function mapInfrastructureElements(
  elements: Array<OverpassNode | OverpassWay>,
  category: 'hospital' | 'school',
): BuildingFeature[] {
  return elements
    .filter((element) => element.type === 'node' || element.type === 'way')
    .map((element) => mapInfrastructureElementToBuilding(element, category))
    .filter((building): building is BuildingFeature => building !== null);
}

const FALLBACK_BUILDINGS: BuildingFeature[] = [
  {
    id: 'fb-h1',
    name: 'Services Hospital',
    polygon: [
      [74.3228, 31.5501],
      [74.3245, 31.5501],
      [74.3245, 31.5492],
      [74.3228, 31.5492],
      [74.3228, 31.5501],
    ],
    height: 25,
    type: 'hospital',
    category: 'hospital',
  },
  {
    id: 'fb-h2',
    name: 'Mayo Hospital',
    polygon: [
      [74.3141, 31.5655],
      [74.3158, 31.5655],
      [74.3158, 31.5644],
      [74.3141, 31.5644],
      [74.3141, 31.5655],
    ],
    height: 30,
    type: 'hospital',
    category: 'hospital',
  },
  {
    id: 'fb-h3',
    name: 'Shaukat Khanum',
    polygon: [
      [74.2735, 31.4817],
      [74.2752, 31.4817],
      [74.2752, 31.4806],
      [74.2735, 31.4806],
      [74.2735, 31.4817],
    ],
    height: 35,
    type: 'hospital',
    category: 'hospital',
  },
  {
    id: 'fb-h4',
    name: 'Jinnah Hospital',
    polygon: [
      [74.2721, 31.4701],
      [74.2738, 31.4701],
      [74.2738, 31.4690],
      [74.2721, 31.4690],
      [74.2721, 31.4701],
    ],
    height: 20,
    type: 'hospital',
    category: 'hospital',
  },
  {
    id: 'fb-h5',
    name: 'Sheikh Zayed',
    polygon: [
      [74.3451, 31.5083],
      [74.3468, 31.5083],
      [74.3468, 31.5072],
      [74.3451, 31.5072],
      [74.3451, 31.5083],
    ],
    height: 28,
    type: 'hospital',
    category: 'hospital',
  },
  {
    id: 'fb-s1',
    name: 'Aitchison College',
    polygon: [
      [74.3229, 31.5415],
      [74.3246, 31.5415],
      [74.3246, 31.5404],
      [74.3229, 31.5404],
      [74.3229, 31.5415],
    ],
    height: 18,
    type: 'school',
    category: 'school',
  },
  {
    id: 'fb-s2',
    name: 'Government College University',
    polygon: [
      [74.3182, 31.5601],
      [74.3199, 31.5601],
      [74.3199, 31.5590],
      [74.3182, 31.5590],
      [74.3182, 31.5601],
    ],
    height: 22,
    type: 'university',
    category: 'school',
  },
  {
    id: 'fb-s3',
    name: 'Punjab University',
    polygon: [
      [74.2705, 31.4701],
      [74.2722, 31.4701],
      [74.2722, 31.4690],
      [74.2705, 31.4690],
      [74.2705, 31.4701],
    ],
    height: 20,
    type: 'university',
    category: 'school',
  },
  {
    id: 'fb-s4',
    name: 'LUMS',
    polygon: [
      [74.2805, 31.4237],
      [74.2822, 31.4237],
      [74.2822, 31.4226],
      [74.2805, 31.4226],
      [74.2805, 31.4237],
    ],
    height: 16,
    type: 'university',
    category: 'school',
  },
  {
    id: 'fb-s5',
    name: 'Lahore Grammar School',
    polygon: [
      [74.3405, 31.5092],
      [74.3422, 31.5092],
      [74.3422, 31.5081],
      [74.3405, 31.5081],
      [74.3405, 31.5092],
    ],
    height: 14,
    type: 'school',
    category: 'school',
  },
];

function resolveCategory(
  amenity: string | undefined,
  building: string | undefined,
): BuildingFeature['category'] {
  const combined = `${amenity ?? ''} ${building ?? ''}`.toLowerCase();
  if (combined.includes('hospital')) return 'hospital';
  if (
    combined.includes('school') ||
    combined.includes('university') ||
    combined.includes('college')
  ) {
    return 'school';
  }
  return 'general';
}

function mapWayToTypedBuilding(way: OverpassWay): BuildingFeature | null {
  const geometry = way.geometry ?? [];

  if (geometry.length < 3) {
    return null;
  }

  const polygon = geometry.map((point) => [point.lon, point.lat]);
  const first = polygon[0];
  const last = polygon[polygon.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    polygon.push([...first]);
  }

  const amenity = way.tags?.amenity;
  const buildingTag = way.tags?.building;
  const levels = Number(way.tags?.['building:levels']);
  const height = (Number.isFinite(levels) && levels > 0 ? levels : 3) * 3.5;
  const type = amenity || buildingTag || 'building';
  const category = resolveCategory(amenity, buildingTag);

  return {
    id: String(way.id),
    name: way.tags?.name,
    polygon,
    height: Math.round(height * 10) / 10,
    type,
    category,
  };
}

function buildAmenityBuildingsQuery(): string {
  return `
    [out:json][timeout:30];
    (
      way["building"]["amenity"="hospital"](31.44,74.25,31.60,74.45);
      way["building"]["amenity"="school"](31.44,74.25,31.60,74.45);
      way["building"]["amenity"="university"](31.44,74.25,31.60,74.45);
    );
    out geom;
  `;
}

function dedupeBuildings(buildings: BuildingFeature[]): BuildingFeature[] {
  const seen = new Set<string>();
  return buildings.filter((building) => {
    const ring = building.polygon;
    const lng = ring.reduce((sum, point) => sum + point[0], 0) / ring.length;
    const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    const key = `${building.category}:${lat.toFixed(3)}:${lng.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function infrastructureNodeToBuilding(
  node: InfrastructureNode,
): BuildingFeature {
  const category: BuildingFeature['category'] =
    node.type === 'hospital' ? 'hospital' : 'school';

  return {
    id: `infra-${node.id}`,
    name: node.name,
    polygon: createFootprintFromPoint(
      node.lat,
      node.lng,
      category === 'hospital' ? 40 : 32,
    ),
    height: stableFootprintHeight(
      node.id,
      category === 'hospital' ? 20 : 12,
      category === 'hospital' ? 25 : 18,
    ),
    type: node.type,
    category,
  };
}

function supplementCategory(
  buildings: BuildingFeature[],
  category: 'hospital' | 'school',
  minimum: number,
): BuildingFeature[] {
  const inCategory = buildings.filter((b) => b.category === category);
  if (inCategory.length >= minimum) return buildings;

  const infraType = category === 'hospital' ? 'hospital' : 'school';
  const extras = [
    ...FALLBACK_BUILDINGS.filter((b) => b.category === category),
    ...FALLBACK_INFRASTRUCTURE.filter((n) => n.type === infraType).map(
      infrastructureNodeToBuilding,
    ),
  ];

  const others = buildings.filter((b) => b.category !== category);
  return dedupeBuildings([...inCategory, ...extras, ...others]);
}

function mergeCategoryBuildings(
  pointFootprints: BuildingFeature[],
  geomFootprints: BuildingFeature[],
  category: 'hospital' | 'school',
): BuildingFeature[] {
  const geom = geomFootprints.filter((b) => b.category === category);
  const points = pointFootprints.filter((b) => b.category === category);
  // Prefer real OSM polygon footprints, fill gaps with node footprints
  return dedupeBuildings([...geom, ...points]);
}

export async function fetchBuildingsWithType(): Promise<BuildingFeature[]> {
  try {
    const [hospitalResult, schoolResult, geomResult] = await Promise.allSettled([
      postOverpassQuery(buildHospitalsQuery()),
      postOverpassQuery(buildSchoolsQuery()),
      postOverpassQuery(buildAmenityBuildingsQuery()),
    ]);

    const hospitalPoints =
      hospitalResult.status === 'fulfilled'
        ? mapInfrastructureElements(hospitalResult.value.elements ?? [], 'hospital')
        : [];
    const schoolPoints =
      schoolResult.status === 'fulfilled'
        ? mapInfrastructureElements(schoolResult.value.elements ?? [], 'school')
        : [];
    const geomBuildings =
      geomResult.status === 'fulfilled'
        ? (geomResult.value.elements ?? [])
            .filter(isOverpassWay)
            .map(mapWayToTypedBuilding)
            .filter((building): building is BuildingFeature => building !== null)
        : [];

    if (hospitalResult.status === 'rejected') {
      console.warn('[buildings] Hospital fetch failed:', hospitalResult.reason);
    }
    if (schoolResult.status === 'rejected') {
      console.warn('[buildings] School fetch failed:', schoolResult.reason);
    }
    if (geomResult.status === 'rejected') {
      console.warn('[buildings] Geom footprint fetch failed:', geomResult.reason);
    }

    const hospitals = mergeCategoryBuildings(hospitalPoints, geomBuildings, 'hospital');
    const schools = mergeCategoryBuildings(schoolPoints, geomBuildings, 'school');

    if (hospitals.length === 0 && schools.length === 0) {
      return FALLBACK_BUILDINGS;
    }

    let buildings = [...hospitals, ...schools];
    buildings = supplementCategory(buildings, 'hospital', 50);
    buildings = supplementCategory(buildings, 'school', 50);
    return buildings;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[buildings] Fetch failed:', message);
    return FALLBACK_BUILDINGS;
  }
}

async function postOverpassQuery(query: string): Promise<OverpassResponse> {
  const body = `data=${encodeURIComponent(query)}`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  try {
    const proxyResponse = await fetch(OVERPASS_PROXY_URL, {
      method: 'POST',
      headers,
      body,
    });

    const proxyData = await proxyResponse.json() as OverpassResponse & { error?: string };

    if (proxyResponse.ok && !proxyData.error) {
      return proxyData;
    }

    const proxyError = proxyData.error
      ?? `Proxy error: ${proxyResponse.status} ${proxyResponse.statusText}`;
    throw new Error(proxyError);
  } catch (proxyError) {
    const message = proxyError instanceof Error ? proxyError.message : String(proxyError);
    console.warn('[overpass] proxy failed, trying direct fallback:', message);
  }

  const directResponse = await fetch(OVERPASS_DIRECT_URL, {
    method: 'POST',
    headers: {
      ...headers,
      'User-Agent': 'UrbanIQ/1.0 (hackathon project)',
    },
    body,
    signal: AbortSignal.timeout(35000),
  });

  if (!directResponse.ok) {
    const errorText = await directResponse.text();
    throw new Error(
      `Overpass direct error: ${directResponse.status} ${directResponse.statusText} - ${errorText}`,
    );
  }

  return directResponse.json() as Promise<OverpassResponse>;
}

function isOverpassWay(element: OverpassNode | OverpassWay): element is OverpassWay {
  return element.type === 'way';
}
