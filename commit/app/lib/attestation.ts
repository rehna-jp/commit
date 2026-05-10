// Builds and signs the 171-byte on-chain attestation message
import { createHash } from 'node:crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

export function sha256(data: Buffer | Uint8Array | string): Buffer {
  return createHash('sha256').update(data).digest();
}

interface AttestationParams {
  verifierPubkey: Uint8Array;
  participantPubkey: Uint8Array;
  streakPubkey: Uint8Array;
  dayIndex: number;
  photoHash: Uint8Array;
  phash: bigint;
  verdict: boolean;
  reasonHash: Uint8Array;
}

export function buildAttestationMessage(params: AttestationParams): Uint8Array {
  const msg = new Uint8Array(171);
  const view = new DataView(msg.buffer);
  let offset = 0;

  msg.set(params.verifierPubkey, offset);
  offset += 32;
  msg.set(params.participantPubkey, offset);
  offset += 32;
  msg.set(params.streakPubkey, offset);
  offset += 32;

  view.setUint16(offset, params.dayIndex, true);
  offset += 2;

  msg.set(params.photoHash, offset);
  offset += 32;

  view.setBigUint64(offset, params.phash, true);
  offset += 8;

  msg[offset] = params.verdict ? 0x01 : 0x00;
  offset += 1;

  msg.set(params.reasonHash, offset);

  return msg;
}

export function signAttestation(message: Uint8Array): Uint8Array {
  const secretKey = bs58.decode(process.env.VERIFIER_PRIVATE_KEY!);
  return nacl.sign.detached(message, secretKey);
}

export function getVerifierPubkeyBytes(): Uint8Array {
  return bs58.decode(process.env.NEXT_PUBLIC_VERIFIER_PUBLIC_KEY!);
}

export function decodeBase58Pubkey(b58: string): Uint8Array {
  return bs58.decode(b58);
}
