// Groq vision client for habit check-in verification (Llama 4 Scout)
import OpenAI from 'openai';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY!,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
  return _client;
}

export interface VerificationResult {
  verdict: boolean;
  reason: string;
}

export async function verifyWithGroq(
  prompt: string,
  imageBase64: string,
): Promise<VerificationResult> {
  const response = await getClient().chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'system',
        content: 'You are a strict habit verifier. Always respond with valid JSON only.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 256,
  });

  const raw = response.choices[0]?.message?.content ?? '';

  try {
    const parsed = JSON.parse(raw) as { verdict: boolean; reason: string };
    return { verdict: Boolean(parsed.verdict), reason: String(parsed.reason) };
  } catch {
    const verdictMatch = raw.match(/"verdict"\s*:\s*(true|false)/i);
    const reasonMatch = raw.match(/"reason"\s*:\s*"([^"]+)"/i);
    if (verdictMatch) {
      return {
        verdict: verdictMatch[1].toLowerCase() === 'true',
        reason: reasonMatch?.[1] ?? 'Verification response could not be fully parsed.',
      };
    }
    return { verdict: false, reason: 'Verification response could not be parsed.' };
  }
}
