import { getAIAnalysis } from '@/lib/ai';
import { runSimulation } from '@/lib/simulation';
import type { PolicyType, Scenario, SimulationParameters } from '@/types';

export interface ScenarioConfig {
  id: string;
  name: string;
  description: string;
  policy_type: PolicyType;
  location: { lat: number; lng: number };
  location_name: string;
  budget_pkr: number;
  radius_km: number;
  parameters: SimulationParameters;
  sort_order: number;
}

const CACHE_PREFIX = 'urbaniq-scenario-';

export const SCENARIO_CONFIGS: ScenarioConfig[] = [
  {
    id: 'kalma-chowk-flyover',
    name: 'Kalma Chowk Flyover',
    description:
      'Elevated corridor at Kalma Chowk to relieve Gulberg traffic — watch flood spillover into Model Town.',
    policy_type: 'flyover',
    location: { lat: 31.5089, lng: 74.3458 },
    location_name: 'Kalma Chowk',
    budget_pkr: 8_500_000_000,
    radius_km: 3,
    parameters: { lanes: 4 },
    sort_order: 1,
  },
  {
    id: 'johar-town-hospital',
    name: 'Johar Town Hospital',
    description:
      'New 350-bed hospital serving underserved southern districts and improving emergency response citywide.',
    policy_type: 'hospital',
    location: { lat: 31.4623, lng: 74.2728 },
    location_name: 'Johar Town',
    budget_pkr: 2_100_000_000,
    radius_km: 4,
    parameters: { beds: 350 },
    sort_order: 2,
  },
  {
    id: 'lahore-drainage-network-upgrade',
    name: 'Lahore Drainage Upgrade',
    description:
      'City-wide trunk drain and detention investment targeting Walled City, Model Town, and Allama Iqbal Town.',
    policy_type: 'drainage',
    location: { lat: 31.5204, lng: 74.3587 },
    location_name: 'Lahore City Center',
    budget_pkr: 3_800_000_000,
    radius_km: 10,
    parameters: { pipe_diameter: 1.8 },
    sort_order: 3,
  },
];

function readCachedScenario(id: string): Scenario | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as Scenario) : null;
  } catch {
    return null;
  }
}

function writeCachedScenario(scenario: Scenario) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`${CACHE_PREFIX}${scenario.id}`, JSON.stringify(scenario));
}

export function clearScenarioCache(id: string) {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(`${CACHE_PREFIX}${id}`);
}

export function resolveScenarioId(id: string): string {
  const aliases: Record<string, string> = {
    'lahore-drainage-upgrade': 'lahore-drainage-network-upgrade',
  };

  if (SCENARIO_CONFIGS.some((config) => config.id === id)) {
    return id;
  }

  return aliases[id] ?? id;
}

export async function loadScenario(config: ScenarioConfig): Promise<Scenario> {
  const cached = readCachedScenario(config.id);
  if (cached) return cached;

  const result = await runSimulation({
    policy_type: config.policy_type,
    location: config.location,
    budget_pkr: config.budget_pkr,
    radius_km: config.radius_km,
    parameters: config.parameters,
  });

  const ai_response = await getAIAnalysis({
    policy: {
      type: config.policy_type,
      budget_pkr: config.budget_pkr,
      radius_km: config.radius_km,
      location_name: config.location_name,
    },
    simulation: result,
  });

  const scenario: Scenario = {
    id: config.id,
    name: config.name,
    description: config.description,
    policy_type: config.policy_type,
    location: config.location,
    budget_pkr: config.budget_pkr,
    parameters: config.parameters,
    result,
    ai_response,
    sort_order: config.sort_order,
  };

  writeCachedScenario(scenario);
  return scenario;
}

export async function loadAllScenarios(): Promise<Scenario[]> {
  const configs = [...SCENARIO_CONFIGS].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  return Promise.all(configs.map(loadScenario));
}
