import { createClient } from '@supabase/supabase-js';
import { LAHORE_CENTER } from '@/lib/lahoreData';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- zone sync later
import type { DistrictZone } from '@/types';
import type { Database, Json } from '@/types/database';
import type {
  AIRecommendation,
  LocationPoint,
  PolicyType,
  SimulationParameters,
  SimulationRequest,
  SimulationResponse,
} from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const LOCAL_HISTORY_KEY = 'urbaniq_simulation_history_v1';
const MAX_HISTORY = 10;

// export async function fetchDistrictZonesFromDb(): Promise<DistrictZone[]> {
//   const { data } = await supabase.from('district_zones').select('*');
//   return (data ?? []) as unknown as DistrictZone[];
// }

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export interface SimulationRun {
  id: string;
  policy_type: PolicyType;
  location: LocationPoint;
  budget_pkr: number;
  radius_km: number;
  parameters: SimulationParameters;
  result: SimulationResponse;
  ai_verdict: string;
  ai_summary: string;
  ai_recommendation: AIRecommendation | null;
  processing_time_ms: number;
  created_at: string;
}

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (!supabaseAnonKey.startsWith('eyJ')) {
    console.warn(
      '[supabase] NEXT_PUBLIC_SUPABASE_ANON_KEY looks invalid — JWT tokens start with "eyJ"',
    );
    return false;
  }
  return true;
}

function parseStoredAiRecommendation(
  parameters: SimulationParameters | Json,
): AIRecommendation | null {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    return null;
  }

  const stored = (parameters as Record<string, unknown>).ai_recommendation;
  if (!stored || typeof stored !== 'object') {
    return null;
  }

  const candidate = stored as Partial<AIRecommendation>;
  if (
    candidate.verdict &&
    candidate.executive_summary &&
    candidate.impact_scores &&
    Array.isArray(candidate.risks) &&
    Array.isArray(candidate.benefits) &&
    Array.isArray(candidate.alternatives)
  ) {
    return candidate as AIRecommendation;
  }

  return null;
}

function toGeoJsonPoint({ lat, lng }: LocationPoint): {
  type: 'Point';
  coordinates: [number, number];
} {
  return { type: 'Point', coordinates: [lng, lat] };
}

function parseGeoJsonPoint(value: unknown): LocationPoint {
  if (
    value &&
    typeof value === 'object' &&
    'type' in value &&
    (value as { type: string }).type === 'Point' &&
    'coordinates' in value &&
    Array.isArray((value as { coordinates: unknown }).coordinates)
  ) {
    const [lng, lat] = (value as { coordinates: [number, number] }).coordinates;
    return { lat, lng };
  }

  return LAHORE_CENTER;
}

function mapSimulationRunRow(
  row: Database['public']['Tables']['simulation_runs']['Row'],
): SimulationRun {
  const parameters = (row.parameters ?? {}) as SimulationParameters;
  const ai_recommendation = parseStoredAiRecommendation(parameters);

  return {
    id: row.id,
    policy_type: row.policy_type as PolicyType,
    location: parseGeoJsonPoint(row.location),
    budget_pkr: row.budget_pkr ?? 0,
    radius_km: row.radius_km ?? 0,
    parameters,
    result: row.result as unknown as SimulationResponse,
    ai_verdict: row.ai_verdict ?? '',
    ai_summary: row.ai_summary ?? '',
    ai_recommendation,
    processing_time_ms: row.processing_time_ms ?? 0,
    created_at: row.created_at,
  };
}

function buildSimulationRun(
  request: SimulationRequest,
  result: SimulationResponse,
  aiResponse?: AIRecommendation | null,
  id?: string,
): SimulationRun {
  const parameters = {
    ...(request.parameters ?? {}),
    ...(aiResponse ? { ai_recommendation: aiResponse } : {}),
  };

  return {
    id: id ?? crypto.randomUUID(),
    policy_type: request.policy_type ?? 'flyover',
    location: request.location ?? LAHORE_CENTER,
    budget_pkr: request.budget_pkr ?? 0,
    radius_km: request.radius_km ?? 3,
    parameters,
    result,
    ai_verdict: aiResponse?.verdict ?? '',
    ai_summary: aiResponse?.executive_summary ?? '',
    ai_recommendation: aiResponse ?? null,
    processing_time_ms: result.processing_time_ms,
    created_at: new Date().toISOString(),
  };
}

function readLocalHistory(): SimulationRun[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SimulationRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error(e);
    return [];
  }
}

function writeLocalHistory(runs: SimulationRun[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      LOCAL_HISTORY_KEY,
      JSON.stringify(runs.slice(0, MAX_HISTORY)),
    );
  } catch (error) {
    console.warn('[supabase] Failed to write local simulation history:', error);
  }
}

function prependLocalHistory(run: SimulationRun): string {
  const existing = readLocalHistory().filter((item) => item.id !== run.id);
  writeLocalHistory([run, ...existing].slice(0, MAX_HISTORY));
  return run.id;
}

function mergeHistory(remote: SimulationRun[], local: SimulationRun[]): SimulationRun[] {
  const byId = new Map<string, SimulationRun>();
  for (const run of [...local, ...remote]) {
    byId.set(run.id, run);
  }

  return Array.from(byId.values())
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, MAX_HISTORY);
}

function saveSimulationRunLocally(
  request: SimulationRequest,
  result: SimulationResponse,
  aiResponse?: AIRecommendation | null,
): string {
  const run = buildSimulationRun(request, result, aiResponse);
  return prependLocalHistory(run);
}

function updateLatestLocalSimulationRunAi(aiResponse: AIRecommendation): void {
  const history = readLocalHistory();
  if (history.length === 0) return;

  const [latest, ...rest] = history;
  const parameters = {
    ...(latest.parameters ?? {}),
    ai_recommendation: aiResponse,
  };

  writeLocalHistory([
    {
      ...latest,
      parameters,
      ai_verdict: aiResponse.verdict,
      ai_summary: aiResponse.executive_summary,
      ai_recommendation: aiResponse,
    },
    ...rest,
  ].slice(0, MAX_HISTORY));
}

export async function saveSimulationRun(
  request: SimulationRequest,
  result: SimulationResponse,
  aiResponse?: AIRecommendation | null,
): Promise<string> {
  if (!isSupabaseConfigured()) {
    console.warn('[supabase] Not configured — saving simulation to local history');
    return saveSimulationRunLocally(request, result, aiResponse);
  }

  const parameters = {
    ...(request.parameters ?? {}),
    ...(aiResponse ? { ai_recommendation: aiResponse } : {}),
  };

  const { data: row, error } = await supabase
    .from('simulation_runs')
    .insert({
      policy_type: request.policy_type ?? 'flyover',
      location: toGeoJsonPoint(request.location ?? LAHORE_CENTER),
      budget_pkr: request.budget_pkr ?? 0,
      radius_km: request.radius_km ?? 3,
      parameters: parameters as unknown as Json,
      result: result as unknown as Json,
      ai_verdict: aiResponse?.verdict ?? '',
      ai_summary: aiResponse?.executive_summary ?? '',
      processing_time_ms: result.processing_time_ms,
    })
    .select('id')
    .single();

  if (error) {
    console.warn(
      '[supabase] Remote save failed — using local history:',
      error.message,
    );
    return saveSimulationRunLocally(request, result, aiResponse);
  }

  return row.id;
}

export async function updateLatestSimulationRunAi(
  aiResponse: AIRecommendation,
): Promise<void> {
  if (!isSupabaseConfigured()) {
    updateLatestLocalSimulationRunAi(aiResponse);
    return;
  }

  const { data: latest, error: fetchError } = await supabase
    .from('simulation_runs')
    .select('id, parameters')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError || !latest) {
    if (fetchError) {
      console.warn(
        '[supabase] Failed to load latest run for AI update — trying local history:',
        fetchError.message,
      );
    }
    updateLatestLocalSimulationRunAi(aiResponse);
    return;
  }

  const parameters = {
    ...((latest.parameters ?? {}) as Record<string, unknown>),
    ai_recommendation: aiResponse,
  };

  const { error } = await supabase
    .from('simulation_runs')
    .update({
      parameters: parameters as unknown as Json,
      ai_verdict: aiResponse.verdict,
      ai_summary: aiResponse.executive_summary,
    })
    .eq('id', latest.id);

  if (error) {
    console.warn(
      '[supabase] AI update failed — updating local history:',
      error.message,
    );
    updateLatestLocalSimulationRunAi(aiResponse);
  }
}

export async function getSimulationHistory(): Promise<SimulationRun[]> {
  const local = readLocalHistory();

  if (!isSupabaseConfigured()) {
    return local;
  }

  const { data, error } = await supabase
    .from('simulation_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY);

  if (error) {
    console.warn(
      '[supabase] Failed to fetch simulation history — using local fallback:',
      error.message,
    );
    return local;
  }

  return mergeHistory((data ?? []).map(mapSimulationRunRow), local);
}
