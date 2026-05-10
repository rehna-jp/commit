// Gemini vision client for habit check-in verification
import { GoogleGenerativeAI } from '@google/generative-ai';

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
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
  const model = getClient().getGenerativeModel({ model: 'gemini-1.5-flash' });

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    },
  ]);

  const raw = result.response.text();
  const cleaned = raw.replace(/^```json\n?|^```\n?|\n?```$/gm, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as { verdict: boolean; reason: string };
    return { verdict: Boolean(parsed.verdict), reason: String(parsed.reason) };
  } catch {
    // Best-effort parse if Gemini adds extra text
    const verdictMatch = cleaned.match(/"verdict"\s*:\s*(true|false)/i);
    const reasonMatch = cleaned.match(/"reason"\s*:\s*"([^"]+)"/i);
    if (verdictMatch) {
      return {
        verdict: verdictMatch[1].toLowerCase() === 'true',
        reason: reasonMatch?.[1] ?? 'Verification response could not be fully parsed.',
      };
    }
    return { verdict: false, reason: 'Verification response could not be parsed.' };
  }
}
