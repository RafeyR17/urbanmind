import { fetchLahoreWeather } from '@/lib/weather';
import { LAHORE_SCENARIOS } from '@/lib/lahoreData';
import { saveSimulationRun } from '@/lib/supabase';
import type {
  SimulationRequest,
  SimulationResponse,
  ZoneSimulationResult,
} from '@/types';
import type { WeatherData } from '@/lib/weather';

export interface SimulationRunResult extends SimulationResponse {
  weather_warning?: string;
  weather?: WeatherData;
}

const SIMULATION_TIMEOUT_MS = 30_000;
const HEALTH_PROBE_MS = 5_000;

export function isMockSimulation(
  result: SimulationResponse | null | undefined,
): boolean {
  return result?._isMock === true;
}

export async function checkSimulationBackendHealth(): Promise<boolean> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_PROBE_MS);

    const response = await fetch(`${apiUrl}/health`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeout);

    if (!response.ok) return false;

    const data = (await response.json()) as { status?: string };
    return data.status === 'ok';
  } catch {
    return false;
  }
}

function markLiveResult(result: SimulationResponse): SimulationResponse {
  return { ...result, _isMock: false };
}

function applyFloodRiskModifier(
  zones: ZoneSimulationResult[],
  modifier: number,
): ZoneSimulationResult[] {
  const floodDelta = Math.round(modifier * 100);

  return zones.map((zone) => ({
    ...zone,
    before: {
      ...zone.before,
      flood_risk: Math.min(100, zone.before.flood_risk + floodDelta),
    },
  }));
}

function recalculateCityFloodAverage(zones: ZoneSimulationResult[]): number {
  if (zones.length === 0) return 0;

  const total = zones.reduce((sum, zone) => sum + zone.before.flood_risk, 0);
  return Math.round(total / zones.length);
}

function applyWeatherToSimulation(
  result: SimulationResponse,
  weather: WeatherData,
): SimulationRunResult {
  if (!weather.is_raining || weather.flood_risk_modifier <= 0 || !weather.available) {
    return result;
  }

  const adjustedZones = applyFloodRiskModifier(
    result.affected_zones,
    weather.flood_risk_modifier,
  );

  return {
    ...result,
    affected_zones: adjustedZones,
    city_totals: {
      ...result.city_totals,
      before: {
        ...result.city_totals.before,
        flood_risk: recalculateCityFloodAverage(adjustedZones),
      },
    },
    weather,
    weather_warning:
      '⚠️ Live rain detected — flood risk elevated across all zones',
  };
}

export async function runSimulation(
  request: SimulationRequest,
): Promise<SimulationRunResult> {
  const weather = await fetchLahoreWeather();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SIMULATION_TIMEOUT_MS);

  try {
    const response = await fetch(`${apiUrl}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        ...request,
        parameters: {
          ...request.parameters,
          weather,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Simulation API error: ${response.status} ${response.statusText}`);
    }

    const result = markLiveResult((await response.json()) as SimulationResponse);
    const finalResult = applyWeatherToSimulation(result, weather);
    
    // Fire and forget — save to history
    saveSimulationRun(request, finalResult).catch((err) => {
      console.error('[simulation] Failed to save simulation run:', err);
    });

    return finalResult;
  } catch (error) {
    console.error('[simulation] Falling back to mock simulation:', error);
    const fallbackResult = applyWeatherToSimulation(createMockSimulation(request), weather);
    
    // Fire and forget — save to history
    saveSimulationRun(request, fallbackResult).catch((err) => {
      console.error('[simulation] Failed to save mock simulation run:', err);
    });

    return fallbackResult;
  } finally {
    clearTimeout(timeout);
  }
}

function createMockSimulation(request: SimulationRequest): SimulationResponse {
  const scenario =
    LAHORE_SCENARIOS.find(
      (item) => item.policy_type === request.policy_type,
    ) ?? LAHORE_SCENARIOS[0];

  return {
    ...scenario.result,
    simulation_id: `mock-${Date.now()}`,
    processing_time_ms: 1080,
    _isMock: true,
    affected_zones: scenario.result.affected_zones.map((zone) => ({
      ...zone,
      before: { ...zone.before },
      after: { ...zone.after },
    })),
    city_totals: {
      before: { ...scenario.result.city_totals.before },
      after: { ...scenario.result.city_totals.after },
    },
  };
}
