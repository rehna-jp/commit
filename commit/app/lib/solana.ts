// Solana instruction builders using the real Anchor IDL
// All functions return TransactionInstruction[] — sending is done via useSolanaTransaction hook.
import {
  PublicKey,
  TransactionInstruction,
  Ed25519Program,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Keypair,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { web3, BN } from '@coral-xyz/anchor';
import { getProgram, PROGRAM_ID } from './program';
import { PROGRAM_ID_STR, USDC_MINT_STR } from './constants';
import type { HabitType } from './types';

const USDC_MINT = new PublicKey(USDC_MINT_STR);
const RENT_SYSVAR = new PublicKey('SysvarRent111111111111111111111111111111111');

// ─── PDA derivations ─────────────────────────────────────────────────────────

export function findStreakPda(creator: PublicKey, name: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('streak'), creator.toBuffer(), Buffer.from(name)],
    PROGRAM_ID
  );
}

export function findParticipantPda(streak: PublicKey, user: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('participant'), streak.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
}

export function findAttestationPda(participant: PublicKey, dayIndex: number): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('attestation'),
      participant.toBuffer(),
      new BN(dayIndex).toArrayLike(Buffer, 'le', 2),
    ],
    PROGRAM_ID
  );
}

export function findPhashRegistryPda(streak: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('phash'), streak.toBuffer()],
    PROGRAM_ID
  );
}

export function findStreakProofPda(streak: PublicKey, owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('proof'), streak.toBuffer(), owner.toBuffer()],
    PROGRAM_ID
  );
}

export function findEscrowPda(streak: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), streak.toBuffer()],
    PROGRAM_ID
  );
}

export function getUsdcAta(owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(USDC_MINT, owner);
}

export function getNftAta(mint: PublicKey, owner: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID);
}

// ─── Instruction args types ───────────────────────────────────────────────────

export interface CreateStreakArgs {
  name: string;
  habitType: HabitType;
  habitPrompt: string;
  durationDays: number;
  stakeAmount: number;
  penaltyPercent: number;
  maxParticipants: number;
  startTimestamp: number;
}

export interface SubmitCheckinArgs {
  participantPubkey: string;
  userPubkey: string;
  streakPubkey: string;
  dayIndex: number;
  verifierSignature: Uint8Array;
  attestationMessage: Uint8Array;
  photoHash: Uint8Array;
  phash: bigint;
  verdictTrue: boolean;
  reasonHash: Uint8Array;
}

export interface ResolveDisputeArgs {
  streakPubkey: string;
  targetParticipantPubkey: string;
  attestationPubkey: string;
  disputerPubkey: string;
  resolverPubkey: string;
  counterVerdict: boolean;
  counterReasonHash: Uint8Array;
  counterSignature: Uint8Array;
  counterAttestationMessage: Uint8Array;
}

// ─── Instruction builders ─────────────────────────────────────────────────────

export async function buildCreateStreakIxs(
  creator: PublicKey,
  args: CreateStreakArgs
): Promise<{ ixs: TransactionInstruction[]; streakPubkey: string }> {
  const [streakPda] = findStreakPda(creator, args.name);
  const [phashRegistryPda] = findPhashRegistryPda(streakPda);
  const [escrowPda] = findEscrowPda(streakPda);

  const program = getProgram(creator.toBase58());

  const habitTypeVariant = [
    { code: {} },
    { read: {} },
    { write: {} },
    { design: {} },
    { gym: {} },
  ][args.habitType] as never;

  const ix = await program.methods
    .createStreak({
      name: args.name,
      habitType: habitTypeVariant,
      habitPrompt: args.habitPrompt,
      durationDays: args.durationDays,
      stakeAmount: new BN(args.stakeAmount),
      penaltyPercent: args.penaltyPercent,
      startTimestamp: new BN(args.startTimestamp),
      maxParticipants: args.maxParticipants,
    })
    .accounts({
      streak: streakPda,
      phashRegistry: phashRegistryPda,
      escrowTokenAccount: escrowPda,
      usdcMint: USDC_MINT,
      creator,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: RENT_SYSVAR,
    })
    .instruction();

  return { ixs: [ix], streakPubkey: streakPda.toBase58() };
}

export async function buildJoinStreakIxs(
  user: PublicKey,
  streak: PublicKey
): Promise<TransactionInstruction[]> {
  const [participantPda] = findParticipantPda(streak, user);
  const [escrowPda] = findEscrowPda(streak);
  const userUsdc = getUsdcAta(user);

  // Ensure USDC ATA exists — no-op if already initialized
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    user, userUsdc, user, USDC_MINT,
  );

  const program = getProgram(user.toBase58());
  const joinIx = await program.methods
    .joinStreak()
    .accounts({
      streak,
      participant: participantPda,
      userTokenAccount: userUsdc,
      escrowTokenAccount: escrowPda,
      usdcMint: USDC_MINT,
      user,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return [createAtaIx, joinIx];
}

/**
 * CRITICAL: ed25519 sigverify at index 0, program ix at index 1.
 * The on-chain program reads instruction index 0 from the instructions sysvar.
 */
export async function buildSubmitCheckinIxs(args: SubmitCheckinArgs): Promise<TransactionInstruction[]> {
  const participantPubkey = new PublicKey(args.participantPubkey);
  const userPubkey = new PublicKey(args.userPubkey);
  const streakPubkey = new PublicKey(args.streakPubkey);
  const [attestationPda] = findAttestationPda(participantPubkey, args.dayIndex);
  const [phashRegistryPda] = findPhashRegistryPda(streakPubkey);
  const verifierPubkey = new PublicKey(args.attestationMessage.slice(0, 32));

  // Index 0: ed25519 sigverify — MUST be first
  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: Buffer.from(verifierPubkey.toBytes()),
    message: args.attestationMessage,
    signature: Buffer.from(args.verifierSignature),
  });

  const program = getProgram(args.userPubkey);
  const programIx = await program.methods
    .submitCheckinWithAttestation({
      dayIndex: args.dayIndex,
      photoHash: Array.from(args.photoHash) as never,
      phash: new BN(args.phash.toString()) as never,
      verdict: args.verdictTrue,
      reasonHash: Array.from(args.reasonHash) as never,
      verifierSignature: Array.from(args.verifierSignature) as never,
    })
    .accounts({
      streak: streakPubkey,
      participant: participantPubkey,
      attestation: attestationPda,
      phashRegistry: phashRegistryPda,
      participantUser: userPubkey,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  // Index 1: program instruction
  return [ed25519Ix, programIx];
}

export async function buildDisputeCheckinIxs(
  disputer: PublicKey,
  streak: PublicKey,
  targetParticipant: PublicKey,
  attestation: PublicKey
): Promise<TransactionInstruction[]> {
  const [escrowPda] = findEscrowPda(streak);
  const [disputerParticipantPda] = findParticipantPda(streak, disputer);
  const disputerUsdc = getUsdcAta(disputer);

  const program = getProgram(disputer.toBase58());
  const ix = await program.methods
    .disputeCheckin()
    .accounts({
      streak,
      targetParticipant,
      attestation,
      disputerParticipant: disputerParticipantPda,
      disputerTokenAccount: disputerUsdc,
      escrowTokenAccount: escrowPda,
      usdcMint: USDC_MINT,
      disputerUser: disputer,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return [ix];
}

/**
 * resolve_dispute also needs ed25519 at index 0 for the counter-attestation.
 */
export async function buildResolveDisputeIxs(args: ResolveDisputeArgs): Promise<TransactionInstruction[]> {
  const streakPubkey = new PublicKey(args.streakPubkey);
  const targetParticipant = new PublicKey(args.targetParticipantPubkey);
  const attestation = new PublicKey(args.attestationPubkey);
  const disputer = new PublicKey(args.disputerPubkey);
  const resolver = new PublicKey(args.resolverPubkey);
  const [escrowPda] = findEscrowPda(streakPubkey);
  const targetUsdc = getUsdcAta(targetParticipant);
  const disputerUsdc = getUsdcAta(disputer);
  const verifierPubkey = new PublicKey(args.counterAttestationMessage.slice(0, 32));

  // Index 0: ed25519 sigverify for counter attestation
  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: Buffer.from(verifierPubkey.toBytes()),
    message: args.counterAttestationMessage,
    signature: Buffer.from(args.counterSignature),
  });

  const program = getProgram(resolver.toBase58());
  const programIx = await program.methods
    .resolveDispute({
      counterVerdict: args.counterVerdict,
      counterReasonHash: Array.from(args.counterReasonHash) as never,
      counterSignature: Array.from(args.counterSignature) as never,
    })
    .accounts({
      streak: streakPubkey,
      targetParticipant,
      attestation,
      disputer,
      disputerTokenAccount: disputerUsdc,
      targetTokenAccount: targetUsdc,
      escrowTokenAccount: escrowPda,
      usdcMint: USDC_MINT,
      resolver,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  return [ed25519Ix, programIx];
}

export async function buildFinalizeCheckinIxs(
  caller: PublicKey,
  attestation: PublicKey,
  participant: PublicKey,
  streak: PublicKey
): Promise<TransactionInstruction[]> {
  const [phashRegistryPda] = findPhashRegistryPda(streak);
  const program = getProgram(caller.toBase58());
  const ix = await program.methods
    .finalizeCheckin()
    .accounts({
      attestation,
      participant,
      streak,
      phashRegistry: phashRegistryPda,
      caller,
    })
    .instruction();
  return [ix];
}

export async function buildSlashMissedIxs(
  caller: PublicKey,
  streak: PublicKey,
  participant: PublicKey
): Promise<TransactionInstruction[]> {
  const program = getProgram(caller.toBase58());
  const ix = await program.methods
    .slashMissed()
    .accounts({ streak, participant, caller })
    .instruction();
  return [ix];
}

/**
 * claim_reward mints a Token-2022 NonTransferable soulbound NFT.
 * Returns the instructions AND the fresh completionMint keypair (must co-sign the tx).
 */
export async function buildClaimRewardIxs(
  user: PublicKey,
  streak: PublicKey
): Promise<{ ixs: TransactionInstruction[]; completionMint: Keypair }> {
  const completionMint = Keypair.generate();
  const [participantPda] = findParticipantPda(streak, user);
  const [escrowPda] = findEscrowPda(streak);
  const [streakProofPda] = findStreakProofPda(streak, user);
  const userUsdc = getUsdcAta(user);
  const userNftAta = getNftAta(completionMint.publicKey, user);

  const program = getProgram(user.toBase58());
  const ix = await program.methods
    .claimReward()
    .accounts({
      streak,
      participant: participantPda,
      escrowTokenAccount: escrowPda,
      userTokenAccount: userUsdc,
      usdcMint: USDC_MINT,
      completionMint: completionMint.publicKey,
      userNftAta,
      streakProof: streakProofPda,
      user,
      tokenProgram: TOKEN_PROGRAM_ID,
      token2022Program: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: RENT_SYSVAR,
    })
    .instruction();

  return { ixs: [ix], completionMint };
}

export async function buildCancelStreakIxs(
  signer: PublicKey,
  streak: PublicKey,
  creator: PublicKey
): Promise<TransactionInstruction[]> {
  const [phashRegistryPda] = findPhashRegistryPda(streak);
  const [escrowPda] = findEscrowPda(streak);

  const program = getProgram(signer.toBase58());
  const ix = await program.methods
    .cancelStreak()
    .accounts({
      streak,
      phashRegistry: phashRegistryPda,
      escrowTokenAccount: escrowPda,
      usdcMint: USDC_MINT,
      creator,
      signer,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return [ix];
}

export async function buildWithdrawFailedIxs(
  user: PublicKey,
  streak: PublicKey
): Promise<TransactionInstruction[]> {
  const [participantPda] = findParticipantPda(streak, user);
  const [escrowPda] = findEscrowPda(streak);
  const userUsdc = getUsdcAta(user);

  const program = getProgram(user.toBase58());
  const ix = await program.methods
    .withdrawFailed()
    .accounts({
      streak,
      participant: participantPda,
      escrowTokenAccount: escrowPda,
      userTokenAccount: userUsdc,
      usdcMint: USDC_MINT,
      user,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  return [ix];
}
