import type { AIRecommendation } from '@/types';

export function parseAIJsonResponse(text: string): AIRecommendation {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as AIRecommendation;
  } catch {
    // Markdown code fence: ```json ... ```
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim()) as AIRecommendation;
    }

    // First { ... last } in the response
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as AIRecommendation;
    }

    throw new Error('No JSON object found in model response');
  }
}
