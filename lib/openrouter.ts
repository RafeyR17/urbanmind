const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
// gemma-2-9b-it is not available on OpenRouter (404); gemma-2-27b-it works reliably
export const DEFAULT_OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL ?? 'google/gemma-2-27b-it';

interface OpenRouterChoice {
  message?: {
    content?: string;
  };
}

interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?: {
    message?: string;
  };
}

export async function callOpenRouter(
  systemPrompt: string,
  userMessage: string,
  model = DEFAULT_OPENROUTER_MODEL,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://urbaniq.vercel.app',
      'X-Title': 'UrbanIQ Urban Planning AI',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    }),
  });

  const data = (await response.json()) as OpenRouterResponse;

  if (!response.ok) {
    const message =
      data.error?.message ??
      `OpenRouter request failed with status ${response.status}`;
    console.error('[OpenRouter] API error:', message, { model, status: response.status });
    throw new Error(message);
  }

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenRouter returned an empty response');
  }

  return content;
}
