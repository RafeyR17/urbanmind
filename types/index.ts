export type PolicyType = "flyover" | "hospital" | "drainage" | "school" | "park";

export type SimulationStatus = "idle" | "loading" | "complete" | "error";

export type MapLayer =
  | "zones"
  | "roads"
  | "hospitals"
  | "schools"
  | "buildings"
  | "traffic"
  | "heatmap"
  | "proposed"
  | "fires"
  | "surface-temp";

export type GeoJSONPosition = [number, number] | [number, number, number];

export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: GeoJSONPosition[][];
}

export interface GeoJSONMultiPolygon {
  type: "MultiPolygon";
  coordinates: GeoJSONPosition[][][];
}

export type GeoJSONPolygonGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

export interface LocationPoint {
  lat: number;
  lng: number;
}

export interface ZoneBaseScores {
  traffic_score: number;
  flood_risk: number;
  emergency_minutes: number;
  population: number;
  area_sqkm: number;
}

export interface DistrictZone extends ZoneBaseScores {
  id: string;
  name: string;
  slug: string;
  polygon: GeoJSONPolygonGeometry;
}

export interface ZoneSimulationMetrics {
  traffic_score: number;
  flood_risk: number;
  emergency_minutes: number;
}

export interface CitySimulationMetrics extends ZoneSimulationMetrics {
  economic_score: number;
}

export interface ZoneSimulationResult {
  zone_id: string;
  zone_name: string;
  polygon: GeoJSONPolygonGeometry;
  before: ZoneSimulationMetrics;
  after: ZoneSimulationMetrics;
}

export interface SimulationParameters {
  lanes?: number;
  beds?: number;
  pipe_diameter?: number;
  weather?: Record<string, unknown>;
}

export interface SimulationRequest {
  policy_type: PolicyType;
  location: LocationPoint;
  budget_pkr: number;
  radius_km: number;
  parameters?: SimulationParameters;
}

export interface SimulationResponse {
  simulation_id: string;
  affected_zones: ZoneSimulationResult[];
  city_totals: {
    before: CitySimulationMetrics;
    after: CitySimulationMetrics;
  };
  processing_time_ms: number;
  /** True when results come from client-side LAHORE_SCENARIOS fallback */
  _isMock?: boolean;
}

export interface ImpactScores {
  traffic: number;
  flood: number;
  emergency: number;
  economic: number;
  environment: number;
}

export interface RiskItem {
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
}

export interface BenefitItem {
  title: string;
  description: string;
}

export interface Alternative {
  title: string;
  description: string;
  estimated_cost_pkr: number;
  expected_improvement: string;
}

export interface AIRecommendation {
  verdict: "recommended" | "conditional" | "not_recommended";
  executive_summary: string;
  impact_scores: ImpactScores;
  risks: RiskItem[];
  benefits: BenefitItem[];
  alternatives: Alternative[];
  cost_benefit_summary: string;
}

export interface InfrastructureNode {
  id: string;
  name: string;
  type: "hospital" | "school" | "fire_station" | "police";
  lat: number;
  lng: number;
  metadata: any;
}

export interface BuildingFeature {
  id: string;
  name?: string;
  polygon: number[][];
  height: number;
  type: string;
  category: "hospital" | "school" | "general";
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  policy_type: PolicyType;
  location: LocationPoint;
  budget_pkr: number;
  parameters: SimulationParameters;
  result: SimulationResponse;
  ai_response: AIRecommendation;
  sort_order: number;
}

export interface AppState {
  current_policy: PolicyType;
  drawn_location: LocationPoint | null;
  budget_pkr: number;
  radius_km: number;
  simulation_status: SimulationStatus;
  simulation_result: SimulationResponse | null;
  ai_recommendation: AIRecommendation | null;
  active_layers: MapLayer[];
  active_scenario: Scenario | null;
}
