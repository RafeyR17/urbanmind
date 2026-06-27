import type {
  AIRecommendation,
  DistrictZone,
  GeoJSONPolygonGeometry,
  Scenario,
  ZoneSimulationResult,
} from "../types";

export const LAHORE_CENTER = { lat: 31.5204, lng: 74.3587 };

const createBoundingPolygon = (
  lat: number,
  lng: number,
  latDelta = 0.012,
  lngDelta = 0.012,
): GeoJSONPolygonGeometry => ({
  type: "Polygon",
  coordinates: [
    [
      [lng - lngDelta, lat - latDelta],
      [lng + lngDelta, lat - latDelta],
      [lng + lngDelta, lat + latDelta],
      [lng - lngDelta, lat + latDelta],
      [lng - lngDelta, lat - latDelta],
    ],
  ],
});

export const LAHORE_ZONES: DistrictZone[] = [
  {
    id: "gulberg",
    name: "Gulberg",
    slug: "gulberg",
    polygon: createBoundingPolygon(31.515, 74.352),
    traffic_score: 78,
    flood_risk: 45,
    emergency_minutes: 8.2,
    population: 500000,
    area_sqkm: 18.5,
  },
  {
    id: "dha",
    name: "DHA",
    slug: "dha",
    polygon: createBoundingPolygon(31.455, 74.425),
    traffic_score: 55,
    flood_risk: 20,
    emergency_minutes: 12.1,
    population: 800000,
    area_sqkm: 64,
  },
  {
    id: "model-town",
    name: "Model Town",
    slug: "model-town",
    polygon: createBoundingPolygon(31.472, 74.285),
    traffic_score: 62,
    flood_risk: 65,
    emergency_minutes: 9.8,
    population: 320000,
    area_sqkm: 14.2,
  },
  {
    id: "johar-town",
    name: "Johar Town",
    slug: "johar-town",
    polygon: createBoundingPolygon(31.468, 74.252),
    traffic_score: 48,
    flood_risk: 40,
    emergency_minutes: 18.4,
    population: 620000,
    area_sqkm: 29.5,
  },
  {
    id: "walled-city",
    name: "Walled City",
    slug: "walled-city",
    polygon: createBoundingPolygon(31.583, 74.321),
    traffic_score: 88,
    flood_risk: 82,
    emergency_minutes: 6.1,
    population: 250000,
    area_sqkm: 2.6,
  },
  {
    id: "cantt",
    name: "Cantt",
    slug: "cantt",
    polygon: createBoundingPolygon(31.545, 74.400),
    traffic_score: 41,
    flood_risk: 18,
    emergency_minutes: 5.2,
    population: 420000,
    area_sqkm: 42,
  },
  {
    id: "allama-iqbal-town",
    name: "Allama Iqbal Town",
    slug: "allama-iqbal-town",
    polygon: createBoundingPolygon(31.448, 74.278),
    traffic_score: 67,
    flood_risk: 55,
    emergency_minutes: 11.3,
    population: 700000,
    area_sqkm: 31,
  },
  {
    id: "faisal-town",
    name: "Faisal Town",
    slug: "faisal-town",
    polygon: createBoundingPolygon(31.535, 74.248),
    traffic_score: 59,
    flood_risk: 48,
    emergency_minutes: 13.7,
    population: 260000,
    area_sqkm: 9.8,
  },
  {
    id: "garden-town",
    name: "Garden Town",
    slug: "garden-town",
    polygon: createBoundingPolygon(31.500, 74.318),
    traffic_score: 71,
    flood_risk: 42,
    emergency_minutes: 7.9,
    population: 180000,
    area_sqkm: 6.4,
  },
  {
    id: "township",
    name: "Township",
    slug: "township",
    polygon: createBoundingPolygon(31.428, 74.222),
    traffic_score: 52,
    flood_risk: 38,
    emergency_minutes: 21.2,
    population: 550000,
    area_sqkm: 24.5,
  },
];

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const round = (value: number, decimals = 1) =>
  Number(value.toFixed(decimals));

const createZoneResult = (
  zone: DistrictZone,
  deltas: Partial<{
    traffic_score: number;
    flood_risk: number;
    emergency_minutes: number;
  }> = {},
): ZoneSimulationResult => ({
  zone_id: zone.id,
  zone_name: zone.name,
  polygon: zone.polygon,
  before: {
    traffic_score: zone.traffic_score,
    flood_risk: zone.flood_risk,
    emergency_minutes: zone.emergency_minutes,
  },
  after: {
    traffic_score: round(
      clamp(zone.traffic_score + (deltas.traffic_score ?? 0)),
    ),
    flood_risk: round(clamp(zone.flood_risk + (deltas.flood_risk ?? 0))),
    emergency_minutes: round(
      Math.max(1, zone.emergency_minutes + (deltas.emergency_minutes ?? 0)),
    ),
  },
});

const createAffectedZones = (
  deltasBySlug: Record<
    string,
    Partial<{
      traffic_score: number;
      flood_risk: number;
      emergency_minutes: number;
    }>
  >,
) =>
  LAHORE_ZONES.map((zone) =>
    createZoneResult(zone, deltasBySlug[zone.slug] ?? {}),
  );

const average = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;

const economicScore = (
  trafficScore: number,
  floodRisk: number,
  emergencyMinutes: number,
) => round(clamp(100 - trafficScore * 0.35 - floodRisk * 0.25 - emergencyMinutes * 1.2));

const createCityTotals = (affectedZones: ZoneSimulationResult[]) => {
  const beforeTraffic = average(
    affectedZones.map((zone) => zone.before.traffic_score),
  );
  const beforeFlood = average(affectedZones.map((zone) => zone.before.flood_risk));
  const beforeEmergency = average(
    affectedZones.map((zone) => zone.before.emergency_minutes),
  );
  const afterTraffic = average(affectedZones.map((zone) => zone.after.traffic_score));
  const afterFlood = average(affectedZones.map((zone) => zone.after.flood_risk));
  const afterEmergency = average(
    affectedZones.map((zone) => zone.after.emergency_minutes),
  );

  return {
    before: {
      traffic_score: round(beforeTraffic),
      flood_risk: round(beforeFlood),
      emergency_minutes: round(beforeEmergency),
      economic_score: economicScore(beforeTraffic, beforeFlood, beforeEmergency),
    },
    after: {
      traffic_score: round(afterTraffic),
      flood_risk: round(afterFlood),
      emergency_minutes: round(afterEmergency),
      economic_score: economicScore(afterTraffic, afterFlood, afterEmergency),
    },
  };
};

const createRecommendation = (
  recommendation: AIRecommendation,
): AIRecommendation => recommendation;

const kalmaChowkZones = createAffectedZones({
  gulberg: { traffic_score: -14, flood_risk: 8, emergency_minutes: -0.6 },
  "model-town": { traffic_score: -7, flood_risk: 18, emergency_minutes: -0.2 },
  "garden-town": { traffic_score: -9, flood_risk: 9, emergency_minutes: -0.4 },
  cantt: { traffic_score: -3, flood_risk: 2, emergency_minutes: -0.1 },
  dha: { traffic_score: -2, flood_risk: 1 },
  "allama-iqbal-town": { traffic_score: 2, flood_risk: 3 },
  "faisal-town": { traffic_score: 3, flood_risk: 2 },
  township: { traffic_score: 2 },
  "walled-city": { traffic_score: 1 },
});

const joharTownHospitalZones = createAffectedZones({
  "johar-town": { traffic_score: 2, emergency_minutes: -7.2 },
  township: { traffic_score: 1, emergency_minutes: -5.6 },
  "faisal-town": { emergency_minutes: -4.1 },
  "allama-iqbal-town": { emergency_minutes: -3.2 },
  "model-town": { emergency_minutes: -1.8 },
  "garden-town": { emergency_minutes: -1.1 },
  gulberg: { emergency_minutes: -0.5 },
});

const drainageUpgradeZones = createAffectedZones({
  "walled-city": { flood_risk: -36, emergency_minutes: -0.4 },
  "model-town": { flood_risk: -31, emergency_minutes: -0.3 },
  "allama-iqbal-town": { flood_risk: -24 },
  "faisal-town": { flood_risk: -20 },
  gulberg: { flood_risk: -18 },
  "garden-town": { flood_risk: -16 },
  "johar-town": { flood_risk: -14 },
  township: { flood_risk: -13 },
  dha: { flood_risk: -7 },
  cantt: { flood_risk: -6 },
});

export const LAHORE_SCENARIOS: Scenario[] = [
  {
    id: "kalma-chowk-flyover",
    name: "Kalma Chowk Flyover",
    description:
      "Helps central traffic flow around Gulberg but pushes flood risk into Model Town and Garden Town.",
    policy_type: "flyover",
    location: { lat: 31.5089, lng: 74.3458 },
    budget_pkr: 8500000000,
    parameters: { lanes: 4 },
    result: {
      simulation_id: "seed-kalma-chowk-flyover",
      affected_zones: kalmaChowkZones,
      city_totals: createCityTotals(kalmaChowkZones),
      processing_time_ms: 42,
    },
    ai_response: createRecommendation({
      verdict: "conditional",
      executive_summary:
        "The flyover reduces congestion around Gulberg and Garden Town, but it creates a serious drainage tradeoff for Model Town. Approve only with a funded stormwater package and traffic diversion plan.",
      impact_scores: {
        traffic: 5,
        flood: -4,
        emergency: 1,
        economic: 3,
        environment: -3,
      },
      risks: [
        {
          title: "Model Town flood exposure",
          description:
            "Added impermeable surface near an already vulnerable residential zone raises flood risk sharply.",
          severity: "high",
        },
        {
          title: "Induced traffic demand",
          description:
            "Short-term travel-time gains may be absorbed by new vehicle trips within a few years.",
          severity: "medium",
        },
        {
          title: "Construction disruption",
          description:
            "Kalma Chowk works would temporarily slow emergency and commuter routes through Gulberg.",
          severity: "medium",
        },
      ],
      benefits: [
        {
          title: "Central congestion relief",
          description:
            "Gulberg and Garden Town see meaningful reductions in traffic pressure.",
        },
        {
          title: "Commercial access",
          description:
            "Improved flow supports retail and office districts near Kalma Chowk.",
        },
        {
          title: "Minor emergency gains",
          description:
            "Response times improve slightly for nearby central zones.",
        },
      ],
      alternatives: [
        {
          title: "Signal optimization and bus priority",
          description:
            "Upgrade junction timing and reserve peak-hour bus movement before adding elevated road capacity.",
          estimated_cost_pkr: 1600000000,
          expected_improvement: "6-8% traffic improvement with lower flood risk",
        },
        {
          title: "Kalma drainage package",
          description:
            "Pair any road project with detention tanks and trunk drain capacity around Model Town.",
          estimated_cost_pkr: 2400000000,
          expected_improvement: "Offsets most of the projected flood-risk increase",
        },
      ],
      cost_benefit_summary:
        "The project has visible traffic benefits but weak resilience value unless drainage mitigation is funded in the same approval.",
    }),
    sort_order: 1,
  },
  {
    id: "johar-town-hospital",
    name: "Johar Town Hospital",
    description:
      "Adds hospital capacity in an underserved southern cluster and improves emergency response across six zones.",
    policy_type: "hospital",
    location: { lat: 31.4697, lng: 74.2728 },
    budget_pkr: 2100000000,
    parameters: { beds: 350 },
    result: {
      simulation_id: "seed-johar-town-hospital",
      affected_zones: joharTownHospitalZones,
      city_totals: createCityTotals(joharTownHospitalZones),
      processing_time_ms: 39,
    },
    ai_response: createRecommendation({
      verdict: "recommended",
      executive_summary:
        "A hospital in Johar Town closes the largest emergency response gap in the model. The benefits spread to Township, Faisal Town, and Allama Iqbal Town without creating major flood or traffic penalties.",
      impact_scores: {
        traffic: -1,
        flood: 0,
        emergency: 8,
        economic: 5,
        environment: 0,
      },
      risks: [
        {
          title: "Access-road congestion",
          description:
            "Ambulance access can degrade if surrounding junctions are not managed during peak hours.",
          severity: "medium",
        },
        {
          title: "Operating cost pressure",
          description:
            "Capital spending only works if staffing and recurring clinical budgets are secured.",
          severity: "medium",
        },
        {
          title: "Land acquisition delay",
          description:
            "A poorly selected site could delay delivery and reduce the catchment benefit.",
          severity: "low",
        },
      ],
      benefits: [
        {
          title: "Emergency response improvement",
          description:
            "Johar Town and Township see the largest reductions in hospital travel time.",
        },
        {
          title: "Southern Lahore coverage",
          description:
            "The project fills a clear service gap away from the better-served central and cantonment areas.",
        },
        {
          title: "High social return",
          description:
            "The budget is materially lower than a major flyover while improving life-safety outcomes.",
        },
      ],
      alternatives: [
        {
          title: "Trauma stabilization centers",
          description:
            "Build smaller emergency units in Johar Town and Township with ambulance transfer protocols.",
          estimated_cost_pkr: 900000000,
          expected_improvement: "20-25% emergency improvement at lower capital cost",
        },
        {
          title: "Ambulance network expansion",
          description:
            "Add vehicles and dispatch optimization before committing to full hospital construction.",
          estimated_cost_pkr: 450000000,
          expected_improvement: "Fast near-term response gains across southern zones",
        },
      ],
      cost_benefit_summary:
        "The hospital scenario has the strongest public-value profile because it targets the largest service gap with limited negative spillover.",
    }),
    sort_order: 2,
  },
  {
    id: "lahore-drainage-network-upgrade",
    name: "Lahore Drainage Network Upgrade",
    description:
      "A city-wide drainage investment that reduces flood risk most strongly in Walled City, Model Town, and Allama Iqbal Town.",
    policy_type: "drainage",
    location: LAHORE_CENTER,
    budget_pkr: 3800000000,
    parameters: { pipe_diameter: 1.8 },
    result: {
      simulation_id: "seed-lahore-drainage-network-upgrade",
      affected_zones: drainageUpgradeZones,
      city_totals: createCityTotals(drainageUpgradeZones),
      processing_time_ms: 51,
    },
    ai_response: createRecommendation({
      verdict: "recommended",
      executive_summary:
        "The drainage upgrade produces broad flood-risk reductions citywide, especially in Walled City and Model Town. It should rank above road expansion because it improves resilience without inducing traffic demand.",
      impact_scores: {
        traffic: 0,
        flood: 9,
        emergency: 2,
        economic: 6,
        environment: 5,
      },
      risks: [
        {
          title: "Excavation disruption",
          description:
            "Drain works can disrupt dense streets if construction is not phased around monsoon and market cycles.",
          severity: "medium",
        },
        {
          title: "Maintenance dependency",
          description:
            "Benefits will decay quickly if desilting and solid-waste controls are not funded.",
          severity: "medium",
        },
        {
          title: "Utility conflicts",
          description:
            "Underground service conflicts may increase costs in older districts.",
          severity: "low",
        },
      ],
      benefits: [
        {
          title: "Citywide flood reduction",
          description:
            "Every district improves, with the largest gains in the highest-risk zones.",
        },
        {
          title: "Resilience return",
          description:
            "Lower flood exposure protects homes, businesses, roads, and emergency access during monsoon events.",
        },
        {
          title: "Better than flyover-first spending",
          description:
            "The same order of public spending solves a systemic risk instead of shifting congestion and runoff.",
        },
      ],
      alternatives: [
        {
          title: "Priority-zone drainage first",
          description:
            "Start with Walled City, Model Town, and Allama Iqbal Town before citywide rollout.",
          estimated_cost_pkr: 1900000000,
          expected_improvement: "Targets 60-70% of flood benefit in the highest-risk zones",
        },
        {
          title: "Green retention corridors",
          description:
            "Use parks, permeable medians, and detention basins to complement pipe upgrades.",
          estimated_cost_pkr: 1200000000,
          expected_improvement: "Adds flood and environmental gains with visible public amenities",
        },
      ],
      cost_benefit_summary:
        "This is the best seed scenario: moderate cost, broad risk reduction, and fewer harmful second-order effects than road capacity expansion.",
    }),
    sort_order: 3,
  },
];
