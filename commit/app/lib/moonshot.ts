// Moonshot Kimi vision client via OpenAI-compatible SDK
import OpenAI from 'openai';

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: 'https://api.moonshot.ai/v1',
      apiKey: process.env.MOONSHOT_API_KEY!,
    });
  }
  return _client;
}

export interface VerificationResult {
  verdict: boolean;
  reason: string;
}

export async function verifyWithKimi(
  prompt: string,
  imageBase64: string,
): Promise<VerificationResult> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: 'kimi-k2.5',
    messages: [
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
    max_tokens: 256,
  });

  const raw = response.choices[0]?.message?.content ?? '';
  const cleaned = raw.replace(/^```json\n?|^```\n?|\n?```$/gm, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as { verdict: boolean; reason: string };
    return { verdict: Boolean(parsed.verdict), reason: String(parsed.reason) };
  } catch {
    return { verdict: false, reason: 'Verification response could not be parsed.' };
  }
}
