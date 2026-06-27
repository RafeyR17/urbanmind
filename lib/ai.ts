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
  const response = await fetch('/api/ai/recommend', {
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

  if (!response.ok) {
    throw new Error(`AI analysis failed: ${response.status}`);
  }

  return (await response.json()) as AIRecommendation;
}
