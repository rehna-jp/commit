// POST /api/verify-checkin — photo verification via Kimi, returns signed attestation
import { NextRequest, NextResponse } from 'next/server';
import { sha256, buildAttestationMessage, signAttestation, getVerifierPubkeyBytes, decodeBase58Pubkey } from '@/app/lib/attestation';
import { computePhash, phashToHex } from '@/app/lib/phash';
import { HABIT_PROMPTS, type HabitType } from '@/app/lib/habits';
import { sanitizeHabitPrompt, injectHabitPrompt } from '@/app/lib/sanitize';
import { verifyWithKimi } from '@/app/lib/moonshot';
import { withX402Payment, type RouteHandler } from '@/app/lib/x402-middleware';
import bs58 from 'bs58';

interface CheckinRequest {
  participant_pubkey: string;
  streak_pubkey: string;
  day_index: number;
  habit_type: HabitType;
  habit_prompt: string;
  photo_base64: string;
}

const HABIT_TYPES = new Set<HabitType>(['Code', 'Read', 'Write', 'Design', 'Gym']);

async function handler(req: NextRequest): Promise<NextResponse> {
  let body: CheckinRequest;
  try {
    body = (await req.json()) as CheckinRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { participant_pubkey, streak_pubkey, day_index, habit_type, habit_prompt, photo_base64 } =
    body;

  if (!participant_pubkey || !streak_pubkey || day_index === undefined || !habit_type || !photo_base64) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!HABIT_TYPES.has(habit_type)) {
    return NextResponse.json({ error: 'Invalid habit_type' }, { status: 400 });
  }

  if (habit_prompt) {
    const sanitized = sanitizeHabitPrompt(habit_prompt);
    if (sanitized === null) {
      return NextResponse.json({ error: 'Invalid habit_prompt content' }, { status: 400 });
    }
  }

  const imageBuffer = Buffer.from(photo_base64, 'base64');
  if (imageBuffer.length > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large (max 4MB)' }, { status: 400 });
  }

  const photoHash = sha256(imageBuffer);
  const phash = await computePhash(imageBuffer);
  const phashHex = phashToHex(phash);

  let prompt = HABIT_PROMPTS[habit_type].primary;
  if (habit_prompt) {
    prompt = injectHabitPrompt(prompt, habit_prompt);
  }

  const { verdict, reason } = await verifyWithKimi(prompt, photo_base64);

  if (!verdict) {
    return NextResponse.json({ verdict: false, reason, verifier_signature: null });
  }

  const reasonHash = sha256(reason);
  const verifierPubkeyBytes = getVerifierPubkeyBytes();
  const participantBytes = decodeBase58Pubkey(participant_pubkey);
  const streakBytes = decodeBase58Pubkey(streak_pubkey);

  const message = buildAttestationMessage({
    verifierPubkey: verifierPubkeyBytes,
    participantPubkey: participantBytes,
    streakPubkey: streakBytes,
    dayIndex: day_index,
    photoHash,
    phash,
    verdict: true,
    reasonHash,
  });

  const signature = signAttestation(message);

  return NextResponse.json({
    verdict: true,
    reason,
    photo_hash: Buffer.from(photoHash).toString('hex'),
    phash: phashHex,
    reason_hash: Buffer.from(reasonHash).toString('hex'),
    verifier_signature: Buffer.from(signature).toString('hex'),
    verifier_pubkey: bs58.encode(verifierPubkeyBytes),
  });
}

export const POST: RouteHandler = withX402Payment(handler, {
  amount: 1000,
  recipient: process.env.VERIFICATION_FEE_WALLET ?? '',
  description: 'AI verification for daily habit check-in',
});
