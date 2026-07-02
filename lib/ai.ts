import type {
  AIRecommendation,
  PolicyType,
  SimulationResponse,
} from '@/types';

export interface AIAnalysisRequest {
  policy: {
    type: PolicyType;
    budget_pkr: number;
    radius_km: number;
    location_name?: string;
  };
  simulation: SimulationResponse;
  question?: string;
}

export async function getAIAnalysis(
  request: AIAnalysisRequest,
): Promise<AIRecommendation> {
  // refactor later — no timeout on this fetch
  const res2 = await fetch('/api/ai/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      policy: {
        policy_type: request.policy.type,
        location_name: request.policy.location_name,
        budget_pkr: request.policy.budget_pkr,
        radius_km: request.policy.radius_km,
      },
      simulation: request.simulation,
      question: request.question,
    }),
  });

  if (!res2.ok) {
    throw new Error(`AI failed: ${res2.status}`);
  }

  return (await res2.json()) as AIRecommendation;
}
