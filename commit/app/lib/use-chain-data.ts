'use client';
// Hooks for fetching on-chain Streak, Participant, Attestation, and StreakProof data.
import { useEffect, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getProgram, getConnection } from './program';
import { findParticipantPda, findStreakProofPda } from './solana';
import { HabitType, AttestationState, type Streak, type Participant, type CheckinAttestation, type StreakProof } from './types';

function decodeHabitType(raw: unknown): HabitType {
  if (typeof raw !== 'object' || raw === null) return HabitType.Code;
  const keys = Object.keys(raw as object);
  const map: Record<string, HabitType> = {
    code: HabitType.Code, read: HabitType.Read, write: HabitType.Write,
    design: HabitType.Design, gym: HabitType.Gym,
  };
  return map[keys[0]] ?? HabitType.Code;
}

function decodeAttestationState(raw: unknown): AttestationState {
  if (typeof raw !== 'object' || raw === null) return AttestationState.Pending;
  const key = Object.keys(raw as object)[0];
  const map: Record<string, AttestationState> = {
    pending: AttestationState.Pending, disputed: AttestationState.Disputed,
    finalized: AttestationState.Finalized, overturned: AttestationState.Overturned,
  };
  return map[key] ?? AttestationState.Pending;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawToStreak(pubkey: string, raw: any): Streak {
  return {
    pubkey,
    creator: raw.creator.toBase58(),
    name: raw.name,
    habitType: decodeHabitType(raw.habitType),
    habitPrompt: raw.habitPrompt,
    durationDays: raw.durationDays,
    stakeAmount: raw.stakeAmount.toNumber(),
    penaltyPercent: raw.penaltyPercent,
    maxParticipants: raw.maxParticipants,
    startTimestamp: raw.startTimestamp.toNumber(),
    totalPool: raw.totalPool.toNumber(),
    participantCount: raw.participantCount,
    activeCount: raw.activeCount,
    completedCount: raw.completedCount,
    escrowTokenAccount: raw.escrowTokenAccount.toBase58(),
    phashRegistry: raw.phashRegistry.toBase58(),
    bump: raw.bump,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawToParticipant(pubkey: string, raw: any): Participant {
  return {
    pubkey,
    user: raw.user.toBase58(),
    streak: raw.streak.toBase58(),
    stakeLocked: raw.stakeLocked.toNumber(),
    currentStreak: raw.currentStreak,
    lastFinalizedDay: raw.lastFinalizedDay,
    lastCheckinTimestamp: raw.lastCheckinTimestamp.toNumber(),
    isActive: raw.isActive,
    hasClaimed: raw.hasClaimed,
    disputesFiledAgainst: raw.disputesFiledAgainst,
    disputesUpheld: raw.disputesUpheld,
    bump: raw.bump,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawToAttestation(pubkey: string, raw: any): CheckinAttestation {
  return {
    pubkey,
    participant: raw.participant.toBase58(),
    streak: raw.streak.toBase58(),
    dayIndex: raw.dayIndex,
    photoHash: Array.from(raw.photoHash as number[]),
    phash: raw.phash.toNumber(),
    verifierSignature: Array.from(raw.verifierSignature as number[]),
    verdict: raw.verdict,
    reasonHash: Array.from(raw.reasonHash as number[]),
    createdAt: raw.createdAt.toNumber(),
    disputeWindowEnds: raw.disputeWindowEnds.toNumber(),
    state: decodeAttestationState(raw.state),
    disputer: raw.disputer ? (raw.disputer as PublicKey).toBase58() : null,
    disputeBond: raw.disputeBond.toNumber(),
    finalVerdict: raw.finalVerdict ?? null,
    bump: raw.bump,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rawToStreakProof(pubkey: string, raw: any): StreakProof {
  return {
    pubkey,
    owner: raw.owner.toBase58(),
    mint: raw.mint.toBase58(),
    streak: raw.streak.toBase58(),
    habitName: raw.habitName,
    durationDays: raw.durationDays,
    stakeLamports: raw.stakeLamports.toNumber(),
    poolShareLamports: raw.poolShareLamports.toNumber(),
    completedAt: raw.completedAt.toNumber(),
    attestationHashes: (raw.attestationHashes as number[][]).map((h) => Array.from(h)),
    disputesFiledAgainst: raw.disputesFiledAgainst,
    disputesUpheld: raw.disputesUpheld,
    bump: raw.bump,
  };
}

export function useStreak(pubkey: string | null) {
  const [streak, setStreak] = useState<Streak | null>(null);
  const [loading, setLoading] = useState(!!pubkey);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!pubkey) return;
    setLoading(true);
    setError(null);
    try {
      const program = getProgram();
      const raw = await program.account['streak'].fetch(new PublicKey(pubkey));
      setStreak(rawToStreak(pubkey, raw));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch streak');
    } finally {
      setLoading(false);
    }
  }, [pubkey]);

  useEffect(() => { void fetch(); }, [fetch]);

  return { streak, loading, error, refetch: fetch };
}

export function useParticipant(streakPubkey: string | null, userAddress: string | null) {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!streakPubkey || !userAddress) { setParticipant(null); return; }
    setLoading(true);
    const [pda] = findParticipantPda(new PublicKey(streakPubkey), new PublicKey(userAddress));
    getProgram().account['participant']
      .fetchNullable(pda)
      .then((raw) => {
        setParticipant(raw ? rawToParticipant(pda.toBase58(), raw) : null);
      })
      .catch(() => setParticipant(null))
      .finally(() => setLoading(false));
  }, [streakPubkey, userAddress]);

  return { participant, loading };
}

export function useStreakParticipants(streakPubkey: string | null) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!streakPubkey) return;
    setLoading(true);
    getProgram()
      .account['participant'].all([
        {
          memcmp: {
            offset: 8 + 32, // discriminator + user pubkey offset → streak field
            bytes: streakPubkey,
          },
        },
      ])
      .then((accounts) => {
        setParticipants(accounts.map((a) => rawToParticipant(a.publicKey.toBase58(), a.account)));
      })
      .catch(() => setParticipants([]))
      .finally(() => setLoading(false));
  }, [streakPubkey]);

  return { participants, loading };
}

export function useStreakAttestations(streakPubkey: string | null) {
  const [attestations, setAttestations] = useState<CheckinAttestation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!streakPubkey) return;
    setLoading(true);
    getProgram()
      .account['checkinAttestation'].all([
        {
          memcmp: {
            offset: 8 + 32, // discriminator + participant pubkey → streak field at offset 40
            bytes: streakPubkey,
          },
        },
      ])
      .then((accounts) => {
        setAttestations(
          accounts
            .map((a) => rawToAttestation(a.publicKey.toBase58(), a.account))
            .sort((a, b) => b.dayIndex - a.dayIndex)
        );
      })
      .catch(() => setAttestations([]))
      .finally(() => setLoading(false));
  }, [streakPubkey]);

  return { attestations, loading };
}

export function useAttestation(pubkey: string | null) {
  const [attestation, setAttestation] = useState<CheckinAttestation | null>(null);
  const [loading, setLoading] = useState(!!pubkey);

  useEffect(() => {
    if (!pubkey) return;
    setLoading(true);
    getProgram()
      .account['checkinAttestation'].fetchNullable(new PublicKey(pubkey))
      .then((raw) => setAttestation(raw ? rawToAttestation(pubkey, raw) : null))
      .catch(() => setAttestation(null))
      .finally(() => setLoading(false));
  }, [pubkey]);

  return { attestation, loading };
}

export function useStreakProof(mint: string | null) {
  const [proof, setProof] = useState<StreakProof | null>(null);
  const [loading, setLoading] = useState(!!mint);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mint) return;
    setLoading(true);
    setError(null);
    // StreakProof PDA: seeds = ["proof", streak, owner]
    // We fetch by mint pubkey from the proof account's mint field
    getProgram()
      .account['streakProof'].all([
        { memcmp: { offset: 8 + 32, bytes: mint } }, // mint field after owner
      ])
      .then((accounts) => {
        if (accounts.length > 0) {
          setProof(rawToStreakProof(accounts[0].publicKey.toBase58(), accounts[0].account));
        } else {
          setError('Proof not found for this mint');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch proof'))
      .finally(() => setLoading(false));
  }, [mint]);

  return { proof, loading, error };
}

export function useAllStreaks() {
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const accounts = await getProgram().account['streak'].all();
      setStreaks(accounts.map((a) => rawToStreak(a.publicKey.toBase58(), a.account)));
    } catch {
      setStreaks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetch(); }, [fetch]);

  return { streaks, loading, refetch: fetch };
}

// Returns all participant PDAs for a given user address, along with the streak pubkeys.
export function useUserParticipants(userAddress: string | null) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userAddress) { setParticipants([]); return; }
    setLoading(true);
    try {
      const userPk = new PublicKey(userAddress);
      getProgram()
        .account['participant'].all([
          { memcmp: { offset: 8, bytes: userPk.toBase58() } },
        ])
        .then((accounts) => {
          setParticipants(accounts.map((a) => rawToParticipant(a.publicKey.toBase58(), a.account)));
        })
        .catch(() => setParticipants([]))
        .finally(() => setLoading(false));
    } catch {
      setParticipants([]);
      setLoading(false);
    }
  }, [userAddress]);

  return { participants, loading };
}

// Fetches streaks that the user has joined (via their participant accounts).
export function useUserStreaks(userAddress: string | null) {
  const { participants, loading: pLoading } = useUserParticipants(userAddress);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (participants.length === 0) { setStreaks([]); return; }
    setLoading(true);
    const streakKeys = [...new Set(participants.map((p) => p.streak))];
    Promise.all(
      streakKeys.map((key) =>
        getProgram()
          .account['streak'].fetchNullable(new PublicKey(key))
          .then((raw) => (raw ? rawToStreak(key, raw) : null))
          .catch(() => null)
      )
    )
      .then((results) => setStreaks(results.filter((s): s is Streak => s !== null)))
      .finally(() => setLoading(false));
  }, [participants]);

  return { streaks, participants, loading: pLoading || loading };
}
