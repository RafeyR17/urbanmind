import { NextResponse } from 'next/server';
import { callOpenRouter, DEFAULT_OPENROUTER_MODEL } from '@/lib/openrouter';
import { parseAIJsonResponse } from '@/lib/parseAIJson';
import type { AIRecommendation, SimulationResponse } from '@/types';

interface RecommendRequestBody {
  policy?: {
    policy_type?: string;
    type?: string;
    location_name?: string;
    budget_pkr?: number;
    radius_km?: number;
  };
  simulation?: SimulationResponse;
  question?: string;
}

const SYSTEM_PROMPT = `You are UrbanMind, an AI urban planning advisor specialized in Pakistani cities. You receive simulation data showing the predicted impact of a proposed infrastructure policy on Lahore.

Be direct, specific, and data-driven. Reference actual zone names (Gulberg, Model Town, DHA etc) in your analysis. Think like a senior urban planner who has seen governments waste billions on wrong projects.

IMPORTANT: Your entire response must be a single valid JSON object. Start with { and end with }. No text before or after.

Return exactly this structure:
{
  verdict: 'recommended' | 'conditional' | 'not_recommended',
  executive_summary: 'exactly 2 sentences',
  impact_scores: {
    traffic: number between -10 and 10,
    flood: number between -10 and 10,
    emergency: number between -10 and 10,
    economic: number between -10 and 10,
    environment: number between -10 and 10
  },
  risks: [
    { title: string, description: string, severity: 'high'|'medium'|'low' }
  ],
  benefits: [
    { title: string, description: string }
  ],
  alternatives: [
    {
      title: string,
      description: string,
      estimated_cost_pkr: number,
      expected_improvement: string
    }
  ],
  cost_benefit_summary: string
}`;

const FALLBACK_RECOMMENDATION: AIRecommendation = {
  verdict: 'conditional',
  executive_summary:
    'This policy shows mixed results across Lahore districts. Further analysis recommended before committing budget.',
  impact_scores: {
    traffic: -2,
    flood: 3,
    emergency: -1,
    economic: 2,
    environment: -1,
  },
  risks: [
    {
      title: 'Data uncertainty',
      description: 'Simulation confidence is moderate',
      severity: 'medium',
    },
  ],
  benefits: [
    {
      title: 'Infrastructure improvement',
      description: 'General urban development benefit',
    },
  ],
  alternatives: [
    {
      title: 'Phased implementation',
      description: 'Reduce budget and test on smaller scale first',
      estimated_cost_pkr: 2_000_000_000,
      expected_improvement: '60% of benefit at 40% cost',
    },
  ],
  cost_benefit_summary:
    'Moderate value proposition. Consider alternatives before proceeding.',
};

function findMostImprovedZone(simulation: SimulationResponse): string {
  const zone = simulation.affected_zones.reduce<(typeof simulation.affected_zones)[0] | null>(
    (best, current) => {
      const delta = current.before.flood_risk - current.after.flood_risk;
      if (delta <= 0) return best;
      if (!best) return current;
      const bestDelta = best.before.flood_risk - best.after.flood_risk;
      return delta > bestDelta ? current : best;
    },
    null,
  );

  return zone?.zone_name ?? 'None';
}

function findMostWorsenedZone(simulation: SimulationResponse): string {
  const zone = simulation.affected_zones.reduce<(typeof simulation.affected_zones)[0] | null>(
    (worst, current) => {
      const delta = current.after.flood_risk - current.before.flood_risk;
      if (delta <= 0) return worst;
      if (!worst) return current;
      const worstDelta = worst.after.flood_risk - worst.before.flood_risk;
      return delta > worstDelta ? current : worst;
    },
    null,
  );

  return zone?.zone_name ?? 'None';
}

function countImprovedZones(simulation: SimulationResponse): number {
  return simulation.affected_zones.filter(
    (zone) => zone.after.flood_risk < zone.before.flood_risk,
  ).length;
}

function countWorsenedZones(simulation: SimulationResponse): number {
  return simulation.affected_zones.filter(
    (zone) => zone.after.flood_risk > zone.before.flood_risk,
  ).length;
}

function buildUserMessage(body: RecommendRequestBody): string {
  const simulation = body.simulation;

  if (!simulation) {
    throw new Error('Simulation data is required');
  }

  const payload = {
    policy: {
      type: body.policy?.policy_type ?? body.policy?.type ?? 'flyover',
      location_name: body.policy?.location_name ?? 'Lahore',
      budget_pkr: body.policy?.budget_pkr ?? 0,
      radius_km: body.policy?.radius_km ?? 0,
    },
    simulation: {
      city_totals: simulation.city_totals,
      most_improved_zone: findMostImprovedZone(simulation),
      most_worsened_zone: findMostWorsenedZone(simulation),
      zones_improved: countImprovedZones(simulation),
      zones_worsened: countWorsenedZones(simulation),
    },
    ...(body.question ? { follow_up_question: body.question } : {}),
  };

  return JSON.stringify(payload);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RecommendRequestBody;

    if (!process.env.OPENROUTER_API_KEY) {
      console.warn('[AI] OPENROUTER_API_KEY missing — returning fallback');
      return NextResponse.json(FALLBACK_RECOMMENDATION);
    }

    const userMessage = buildUserMessage(body);
    const responseText = await callOpenRouter(
      SYSTEM_PROMPT,
      userMessage,
      DEFAULT_OPENROUTER_MODEL,
    );

    try {
      const parsed = parseAIJsonResponse(responseText);
      return NextResponse.json(parsed);
    } catch (parseError) {
      console.error('[AI] JSON.parse failed:', parseError);
      console.error('[AI] Raw text was:', responseText);
      return NextResponse.json(FALLBACK_RECOMMENDATION);
    }
  } catch (error) {
    console.error('[api/ai/recommend] Error:', error);
    return NextResponse.json(FALLBACK_RECOMMENDATION);
  }
}
