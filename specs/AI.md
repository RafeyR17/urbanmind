# AI Layer Specs

## Model
claude-sonnet-4-6

## System Prompt
You are UrbanMind, an AI urban planning advisor specialized in 
Pakistani cities. You receive simulation data showing predicted 
impact of a proposed infrastructure policy on Lahore.

Be direct, specific, and data-driven. Reference actual zone names
(Gulberg, Model Town, DHA etc) in your analysis. Think like a 
senior urban planner who has seen governments waste billions on 
the wrong projects.

Always return valid JSON only. No markdown. No preamble.

## Request Format
{
  "policy": {
    "type": "flyover",
    "location_name": "Kalma Chowk",
    "budget_pkr": 8500000000,
    "radius_km": 3
  },
  "simulation": {
    "city_totals": { "before": {...}, "after": {...} },
    "most_improved_zone": "zone name",
    "most_worsened_zone": "zone name",
    "zones_improved": 3,
    "zones_worsened": 6
  }
}

## Response Format
{
  "verdict": "recommended" | "conditional" | "not_recommended",
  "executive_summary": "2 sentence plain English summary",
  "impact_scores": {
    "traffic": -10 to 10,
    "flood": -10 to 10,
    "emergency": -10 to 10,
    "economic": -10 to 10,
    "environment": -10 to 10
  },
  "risks": [
    { "title": string, "description": string, "severity": "high"|"medium"|"low" }
  ],
  "benefits": [
    { "title": string, "description": string }
  ],
  "alternatives": [
    {
      "title": string,
      "description": string,
      "estimated_cost_pkr": number,
      "expected_improvement": string
    }
  ],
  "cost_benefit_summary": string
}

## Usage in Code
// lib/claude.ts
export async function getAIRecommendation(simulationData) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: SYSTEM_PROMPT,
    messages: [{ 
      role: "user", 
      content: JSON.stringify(simulationData) 
    }]
  })
  return JSON.parse(response.content[0].text)
}
