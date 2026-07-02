import type { AIRecommendation } from '@/types';

function pullJson(text: string): AIRecommendation {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as AIRecommendation;
  } catch (e) {
    console.error(e);
    // model loves wrapping json in markdown fences
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim()) as AIRecommendation;
    }

    // first { ... last } in the response
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as AIRecommendation;
    }

    throw new Error('No JSON object found in model response');
  }
}

export function parseAIJsonResponse(text: string): AIRecommendation {
  return pullJson(text);
}
