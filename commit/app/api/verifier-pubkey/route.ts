// GET /api/verifier-pubkey — returns the verifier's public key for client-side attestation verification
import { NextResponse } from 'next/server';

export function GET(): NextResponse {
  return NextResponse.json({ pubkey: process.env.NEXT_PUBLIC_VERIFIER_PUBLIC_KEY });
}
