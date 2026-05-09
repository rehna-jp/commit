// TypeScript types matching on-chain account structures

export enum HabitType {
  Code = 0,
  Read = 1,
  Write = 2,
  Design = 3,
  Gym = 4,
}

export enum AttestationState {
  Pending = 0,
  Disputed = 1,
  Finalized = 2,
  Overturned = 3,
}

export const HABIT_LABELS: Record<HabitType, string> = {
  [HabitType.Code]: 'Code',
  [HabitType.Read]: 'Read',
  [HabitType.Write]: 'Write',
  [HabitType.Design]: 'Design',
  [HabitType.Gym]: 'Gym',
};

export interface Streak {
  pubkey: string;
  creator: string;
  name: string;
  habitType: HabitType;
  habitPrompt: string;
  durationDays: number;
  stakeAmount: number;
  penaltyPercent: number;
  maxParticipants: number;
  startTimestamp: number;
  totalPool: number;
  participantCount: number;
  activeCount: number;
  completedCount: number;
  escrowTokenAccount: string;
  phashRegistry: string;
  bump: number;
}

export interface Participant {
  pubkey: string;
  user: string;
  streak: string;
  stakeLocked: number;
  currentStreak: number;
  lastFinalizedDay: number;
  lastCheckinTimestamp: number;
  isActive: boolean;
  hasClaimed: boolean;
  disputesFiledAgainst: number;
  disputesUpheld: number;
  bump: number;
}

export interface CheckinAttestation {
  pubkey: string;
  participant: string;
  streak: string;
  dayIndex: number;
  photoHash: number[];
  phash: number;
  verifierSignature: number[];
  verdict: boolean;
  reasonHash: number[];
  createdAt: number;
  disputeWindowEnds: number;
  state: AttestationState;
  disputer: string | null;
  disputeBond: number;
  finalVerdict: boolean | null;
  bump: number;
}

export interface StreakProof {
  pubkey: string;
  owner: string;
  mint: string;
  streak: string;
  habitName: string;
  durationDays: number;
  stakeLamports: number;
  poolShareLamports: number;
  completedAt: number;
  attestationHashes: number[][];
  disputesFiledAgainst: number;
  disputesUpheld: number;
  bump: number;
}

export interface VerifyCheckinResponse {
  verdict: boolean;
  reason: string;
  photo_hash: string;
  phash: string;
  reason_hash: string;
  verifier_signature: string | null;
  verifier_pubkey: string;
}
