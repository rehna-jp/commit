'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/app/lib/wallet-context';
import { PublicKey } from '@solana/web3.js';
import { Loader2, Trophy, Clock, Users, TrendingUp, LogOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../../components/Navbar';
import { HabitChip } from '../../components/HabitTypeSelector';
import { Leaderboard } from '../../components/Leaderboard';
import { RewardPool } from '../../components/RewardPool';
import { AttestationCard } from '../../components/AttestationCard';
import { StakeWidget } from '../../components/StakeWidget';
import { StakeHealthPanel } from '../../components/StakeHealthPanel';
import { useStreak, useParticipant, useStreakParticipants } from '../../lib/use-chain-data';
import { useSolanaTransaction } from '../../lib/use-solana-tx';
import { buildClaimRewardIxs, buildWithdrawFailedIxs, buildSlashMissedIxs, buildCancelStreakIxs, findAttestationPda } from '../../lib/solana';
import { formatUsdc } from '../../lib/constants';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getProgram } from '../../lib/program';
import type { CheckinAttestation } from '../../lib/types';
import { AttestationState } from '../../lib/types';

export default function StreakDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const address = publicKey?.toBase58() ?? null;

  const { streak, loading: streakLoading, error: streakError } = useStreak(id ?? null);
  const { participant: userParticipant, refetch: refetchParticipant } = useParticipant(id ?? null, address);
  const { participants } = useStreakParticipants(id ?? null);
  const { sendTransaction, sending } = useSolanaTransaction();

  const now = Date.now() / 1000;
  const started = streak ? streak.startTimestamp <= now : false;
  const dayIndex = streak && started ? Math.floor((now - streak.startTimestamp) / 86400) : 0;

  const [attestations, setAttestations] = useState<CheckinAttestation[]>([]);
  const [attestationsLoading, setAttestationsLoading] = useState(false);

  // Build the full participant list: always include the connected user's participant
  // so their attestations show even if useStreakParticipants filter fails.
  const allParticipants = useMemo(() => {
    if (!userParticipant) return participants;
    const has = participants.some((p) => p.pubkey === userParticipant.pubkey);
    return has ? participants : [userParticipant, ...participants];
  }, [participants, userParticipant]);

  // Days (0-indexed) the connected user has a non-overturned attestation for
  const myAttestedDays = useMemo(() => {
    if (!userParticipant) return new Set<number>();
    return new Set(
      attestations
        .filter(a => a.participant === userParticipant.pubkey && a.state !== AttestationState.Overturned)
        .map(a => a.dayIndex)
    );
  }, [attestations, userParticipant]);

  // Past days with no accepted attestation — used to power the slash history display
  const missedDays = useMemo(() => {
    if (!userParticipant || !started) return [];
    const isEnded = streak ? dayIndex >= streak.durationDays : false;
    const cutoff = isEnded ? (streak!.durationDays - 1) : dayIndex - 1;
    if (cutoff < 0) return [];
    return Array.from({ length: cutoff + 1 }, (_, i) => i).filter(d => !myAttestedDays.has(d));
  }, [userParticipant, started, streak, dayIndex, myAttestedDays]);

  // Estimate USDC flowing into the reward pool once all callable slash_missed txs execute.
  // Slash is callable once the day after the last finalized day has fully elapsed:
  // startTimestamp + (lastFinalizedDay + 2) * 86400 — mirrors updated slash_missed contract.
  const pendingPoolContribution = useMemo(() => {
    if (!streak) return 0;
    const nowSec = Date.now() / 1000;
    const currentDay = Math.floor((nowSec - streak.startTimestamp) / 86400);
    const isEnded = currentDay >= streak.durationDays;
    const cutoff = isEnded ? streak.durationDays - 1 : currentDay - 1;
    if (cutoff < 0) return 0;

    return allParticipants.reduce((poolTotal, p) => {
      if (!p.isActive) return poolTotal;

      // Slash callable once the first missed day slot has fully elapsed
      const slashEligibleFrom = streak.startTimestamp + (p.currentStreak + 1) * 86400;
      if (nowSec < slashEligibleFrom) return poolTotal;

      // Gap between finalized days and elapsed days = number of pending slashes
      if (p.currentStreak >= currentDay) return poolTotal;

      const missedCount = currentDay - p.currentStreak;
      if (missedCount <= 0) return poolTotal;

      const projectedRemaining = Array.from({ length: missedCount }).reduce(
        (bal: number) => bal - Math.floor(bal * streak.penaltyPercent / 100),
        p.stakeLocked as number
      );
      return poolTotal + (p.stakeLocked - projectedRemaining);
    }, 0);
  }, [allParticipants, attestations, streak, dayIndex]);

  // Slash the connected user's own missed days — only triggered by explicit button click.
  async function handleApplyOwnSlash() {
    if (!userParticipant || !streak || !publicKey) return;
    const nowSec = Date.now() / 1000;
    const currentDay = Math.floor((nowSec - streak.startTimestamp) / 86400);
    const slashEligibleFrom = streak.startTimestamp + (userParticipant.currentStreak + 1) * 86400;
    if (nowSec < slashEligibleFrom || userParticipant.currentStreak >= currentDay) return;

    const streakPk = new PublicKey(streak.pubkey);
    const participantPk = new PublicKey(userParticipant.pubkey);
    const missedCount = currentDay - userParticipant.currentStreak;

    for (let i = 0; i < missedCount; i++) {
      try {
        const ixs = await buildSlashMissedIxs(publicKey, streakPk, participantPk, userParticipant.currentStreak + i);
        await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });
      } catch {
        break;
      }
    }
    await refetchParticipant();
    await fetchAttestations();
  }

  // Slash OTHER participants who are overdue — opt-in keeper action.
  const [slashingOthers, setSlashingOthers] = useState(false);
  async function handleSlashOthers() {
    if (!publicKey || !streak) return;
    setSlashingOthers(true);
    try {
      const nowSec = Date.now() / 1000;
      const currentDay = Math.floor((nowSec - streak.startTimestamp) / 86400);
      const streakPk = new PublicKey(streak.pubkey);

      for (const p of allParticipants) {
        if (!p.isActive) continue;
        if (userParticipant && p.pubkey === userParticipant.pubkey) continue;
        const slashEligibleFrom = streak.startTimestamp + (p.currentStreak + 1) * 86400;
        if (nowSec < slashEligibleFrom || p.currentStreak >= currentDay) continue;

        const missedCount = currentDay - p.currentStreak;
        const participantPk = new PublicKey(p.pubkey);
        for (let i = 0; i < missedCount; i++) {
          try {
            const ixs = await buildSlashMissedIxs(publicKey, streakPk, participantPk, p.currentStreak + i);
            await sendTransaction(ixs, {});
          } catch { break; }
        }
      }
      await refetchParticipant();
      await fetchAttestations();
      toast.success('Overdue slashes applied.');
    } catch {
      toast.error('Failed to slash some participants.');
    } finally {
      setSlashingOthers(false);
    }
  }

  // Participants (excluding self) who are currently slash-eligible
  const slashableOthers = useMemo(() => {
    if (!streak) return 0;
    const nowSec = Date.now() / 1000;
    const currentDay = Math.floor((nowSec - streak.startTimestamp) / 86400);
    return allParticipants.filter(p => {
      if (!p.isActive) return false;
      if (userParticipant && p.pubkey === userParticipant.pubkey) return false;
      const eligible = streak.startTimestamp + (p.currentStreak + 1) * 86400;
      return nowSec >= eligible && p.currentStreak < currentDay;
    }).length;
  }, [allParticipants, streak, userParticipant]);

  const fetchAttestations = useCallback(async () => {
    if (allParticipants.length === 0) return;
    setAttestationsLoading(true);
    try {
      const pdas = allParticipants.flatMap((p) =>
        Array.from({ length: dayIndex + 1 }, (_, day) =>
          findAttestationPda(new PublicKey(p.pubkey), day)[0]
        )
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raws: (any | null)[] = await (getProgram().account['checkinAttestation'].fetchMultiple(pdas) as Promise<(any | null)[]>);
      const results: CheckinAttestation[] = [];
      raws.forEach((raw, i) => {
        if (!raw) return;
        const pda = pdas[i];
        results.push({
          pubkey: pda.toBase58(),
          participant: raw.participant.toBase58(),
          streak: raw.streak.toBase58(),
          dayIndex: raw.dayIndex,
          photoHash: Array.from(raw.photoHash as number[]),
          phash: Number((raw.phash as { toString: () => string }).toString()),
          verifierSignature: Array.from(raw.verifierSignature as number[]),
          verdict: raw.verdict,
          reasonHash: Array.from(raw.reasonHash as number[]),
          createdAt: (raw.createdAt as { toNumber: () => number }).toNumber(),
          disputeWindowEnds: (raw.disputeWindowEnds as { toNumber: () => number }).toNumber(),
          state: (() => {
            const key = Object.keys(raw.state as object)[0];
            const m: Record<string, AttestationState> = {
              pending: AttestationState.Pending, disputed: AttestationState.Disputed,
              finalized: AttestationState.Finalized, overturned: AttestationState.Overturned,
            };
            return m[key] ?? AttestationState.Pending;
          })(),
          disputer: raw.disputer ? (raw.disputer as PublicKey).toBase58() : null,
          disputeBond: (raw.disputeBond as { toNumber: () => number }).toNumber(),
          finalVerdict: raw.finalVerdict ?? null,
          bump: raw.bump,
        });
      });
      setAttestations(results.sort((a, b) => b.dayIndex - a.dayIndex));
    } catch (e) {
      console.error('fetchAttestations failed:', e);
    } finally {
      setAttestationsLoading(false);
    }
  }, [allParticipants, dayIndex]);

  useEffect(() => { void fetchAttestations(); }, [fetchAttestations]);

  async function handleFinalized() {
    await refetchParticipant();
    await fetchAttestations();
  }
  const daysPassed = Math.min(dayIndex + 1, streak?.durationDays ?? 1);
  const progress = streak ? Math.round((daysPassed / streak.durationDays) * 100) : 0;
  const streakEnded = streak ? now >= streak.startTimestamp + streak.durationDays * 86400 : false;
  const canJoin = !userParticipant && streak && streak.participantCount < streak.maxParticipants;
  // currentStreak > 0 guards against lastFinalizedDay=0 being mistaken for "Day 0 finalized"
  // when the participant has never actually submitted anything (initial state is also 0).
  const todayIsFinalized = !!userParticipant &&
    userParticipant.currentStreak > 0 &&
    userParticipant.lastFinalizedDay >= dayIndex;
  const checkedInToday = userParticipant && streak
    ? todayIsFinalized ||
      userParticipant.lastCheckinTimestamp >= streak.startTimestamp + dayIndex * 86400
    : false;
  const canCheckin = userParticipant?.isActive && started && !streakEnded && !checkedInToday;
  // Claim: must have enough credits AND have actually finalized the last day
  const canClaim = userParticipant?.isActive && !userParticipant.hasClaimed &&
    streakEnded &&
    (userParticipant.currentStreak ?? 0) >= (streak?.durationDays ?? 999) &&
    (userParticipant.lastFinalizedDay + 1) >= (streak?.durationDays ?? 999);
  // Withdraw: didn't finalize the last day (mirrors contract lastFinalizedDay check)
  const canWithdraw = userParticipant?.isActive && !userParticipant.hasClaimed &&
    streakEnded &&
    (userParticipant.lastFinalizedDay + 1) < (streak?.durationDays ?? 0);

  async function handleClaim() {
    if (!publicKey || !id) return;
    try {
      const { ixs, completionMint } = await buildClaimRewardIxs(
        publicKey,
        new PublicKey(id)
      );
      await sendTransaction(ixs, {
        extraSigners: [completionMint],
        onStatus: (msg) => toast.info(msg),
      });
      toast.success('Reward claimed! Soulbound NFT minted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Claim failed');
    }
  }

  // Creator can cancel if no one has joined yet (before or after start — permissionless after start)
  const canCancel = connected && !!streak &&
    Number(streak.participantCount) === 0 &&
    !userParticipant &&
    (address === streak.creator || streak.startTimestamp <= now);

  async function handleCancel() {
    if (!publicKey || !id || !streak) return;
    try {
      const ixs = await buildCancelStreakIxs(publicKey, new PublicKey(id), new PublicKey(streak.creator));
      await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });
      toast.success('Streak cancelled. Rent returned to your wallet.');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Cancel failed');
    }
  }

  async function handleWithdraw() {
    if (!publicKey || !id) return;
    try {
      const ixs = await buildWithdrawFailedIxs(publicKey, new PublicKey(id));
      await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });
      toast.success('Remaining stake returned to your wallet.');
      await refetchParticipant();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Withdraw failed');
    }
  }

  if (streakLoading) {
    return (
      <div className="relative min-h-screen bg-[#07050d] text-white overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[20%] left-[50%] w-[40vw] h-[40vw] -translate-x-1/2 rounded-full bg-grape-600/20 blur-[150px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
        </div>
        <Navbar />
        <div className="relative z-10 flex items-center justify-center pt-32">
          <Loader2 size={32} className="animate-spin text-orchid-500 drop-shadow-[0_0_15px_rgba(202,121,165,0.8)]" />
        </div>
      </div>
    );
  }

  if (streakError || !streak) {
    return (
      <div className="relative min-h-screen bg-[#07050d] text-white overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[30%] left-[50%] w-[50vw] h-[50vw] -translate-x-1/2 rounded-full bg-grape-600/10 blur-[150px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
        </div>
        <Navbar />
        <div className="relative z-10 flex flex-col items-center justify-center pt-32 px-6 text-center">
          <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-10 max-w-md shadow-2xl">
            <p className="text-lg text-smoke-500 mb-6">{streakError ?? 'Streak not found on network.'}</p>
            <Link href="/dashboard" className="text-orchid-400 hover:text-orchid-300 text-base font-bold transition-colors">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#07050d] text-white selection:bg-grape-500/30 overflow-hidden pb-20">
      {/* Immersive Glowing Background */}
      <div className="absolute inset-0 z-0 pointer-events-none fixed">
        <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-lilac-900/10 blur-[150px]" />
        <div className="absolute bottom-[20%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-grape-600/10 blur-[150px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
      </div>

      <Navbar />
      
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
        {/* Header Section */}
        <div className="mb-10 bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Trophy size={160} />
          </div>

          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <HabitChip habitType={streak.habitType} />
              <span className="text-xs font-bold uppercase tracking-widest text-orchid-400 border border-orchid-400/30 bg-orchid-500/10 rounded-full px-3 py-1.5">
                {streak.durationDays} Days Protocol
              </span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl font-black text-white break-words mb-8 tracking-tight">
              {streak.name}
            </h1>

            {/* High-Tech Stats Panel */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-smoke-600 uppercase tracking-widest mb-1 flex items-center gap-1"><TrendingUp size={12}/> Entry Stake</span>
                <span className="text-2xl font-black text-white font-mono">{formatUsdc(streak.stakeAmount)}</span>
              </div>
              <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-smoke-600 uppercase tracking-widest mb-1 flex items-center gap-1"><Clock size={12}/> Penalty</span>
                <span className="text-2xl font-black text-red-400 font-mono">{streak.penaltyPercent}%</span>
              </div>
              <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-smoke-600 uppercase tracking-widest mb-1 flex items-center gap-1"><Users size={12}/> Active</span>
                <span className="text-2xl font-black text-white font-mono">{streak.activeCount}<span className="text-sm text-smoke-600">/{streak.maxParticipants}</span></span>
              </div>
              <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold text-smoke-600 uppercase tracking-widest mb-1 flex items-center gap-1"><Trophy size={12}/> Total Staked</span>
                <span className="text-2xl font-black text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)] font-mono">{formatUsdc(streak.participantCount * streak.stakeAmount)}</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-8 bg-[#13111c]/60 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between text-sm font-bold mb-3">
                <span className="text-smoke-400 uppercase tracking-widest">{started ? `Protocol Day ${daysPassed} of ${streak.durationDays}` : 'Protocol Pending Start'}</span>
                <span className="text-orchid-400 drop-shadow-[0_0_10px_rgba(202,121,165,0.8)]">{progress}%</span>
              </div>
              <div className="h-3 bg-grape-900/50 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-gradient-to-r from-grape-500 to-orchid-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(202,121,165,0.8)] relative" style={{ width: `${progress}%` }}>
                  <div className="absolute top-0 right-0 bottom-0 w-8 bg-white/30 blur-[4px]"></div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-4">
              {canJoin && !connected && (
                <Link href="/dashboard" className="bg-grape-500 text-white hover:bg-grape-600 rounded-xl px-6 py-3 text-base font-bold shadow-lg transition-transform hover:scale-105 active:scale-95">
                  Connect Wallet to Join
                </Link>
              )}
              {canCheckin && (
                <Link href={`/streak/${id}/checkin`} className="group relative overflow-hidden bg-grape-500 text-white rounded-xl px-8 py-3.5 text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(94,84,142,0.6)]">
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
                  <span className="relative">Submit Day {daysPassed} Proof</span>
                </Link>
              )}
              {checkedInToday && !userParticipant?.hasClaimed && started && !streakEnded && (
                todayIsFinalized ? (
                  <span className="flex items-center gap-2 text-base font-bold text-green-400 bg-green-400/10 border border-green-400/30 px-6 py-3 rounded-xl">
                    <Trophy size={18} /> Day {daysPassed} — Confirmed
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-base font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-6 py-3 rounded-xl">
                    <Clock size={18} /> Day {daysPassed} — Pending Attestation
                  </span>
                )
              )}
              {canClaim && (
                <button onClick={() => void handleClaim()} disabled={sending}
                  className="group relative overflow-hidden flex items-center gap-2 bg-orchid-500/10 border border-orchid-500 text-orchid-400 hover:bg-orchid-500/20 disabled:opacity-70 rounded-xl px-8 py-3.5 text-base font-bold transition-all hover:shadow-[0_0_20px_rgba(202,121,165,0.4)] active:scale-95">
                  <div className="absolute inset-0 bg-gradient-to-r from-orchid-400/0 via-orchid-400/20 to-orchid-400/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
                  {sending ? <Loader2 size={18} className="animate-spin relative" /> : <Trophy size={18} className="relative" />}
                  <span className="relative">Claim Reward & Mint NFT</span>
                </button>
              )}
              {canWithdraw && (
                <button onClick={() => void handleWithdraw()} disabled={sending}
                  className="flex items-center gap-2 bg-zinc-800/60 border border-zinc-600/50 text-zinc-300 hover:bg-zinc-700/60 hover:text-white disabled:opacity-50 rounded-xl px-8 py-3.5 text-base font-bold transition-all active:scale-95">
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                  <span>Withdraw Remaining Stake</span>
                </button>
              )}
              {userParticipant?.hasClaimed && (
                <span className="flex items-center gap-2 text-base font-bold text-green-400 bg-green-400/10 border border-green-400/30 px-6 py-3 rounded-xl">
                  <Trophy size={18} /> Protocol Completed
                </span>
              )}
              {canCancel && (
                <button onClick={() => void handleCancel()} disabled={sending}
                  className="flex items-center gap-2 bg-red-900/20 border border-red-500/30 text-red-400 hover:bg-red-900/40 hover:border-red-500/60 disabled:opacity-50 rounded-xl px-6 py-3 text-sm font-medium transition-all active:scale-95">
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Cancel Streak
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2 space-y-8">
            {connected && (
              <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-6 shadow-xl">
                {canJoin ? (
                  <StakeWidget streak={streak} userAddress={address ?? undefined} onJoined={() => {}} />
                ) : userParticipant ? (
                  <StakeHealthPanel
                    participant={userParticipant}
                    streak={streak}
                    missedDays={missedDays}
                    onApplySlash={() => void handleApplyOwnSlash()}
                    applying={sending}
                  />
                ) : null}
              </div>
            )}
            
            <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-6 sm:p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                Recent Network Attestations
                <span className="flex size-2 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]"></span>
              </h2>
              {attestationsLoading ? (
                <div className="flex items-center justify-center gap-3 py-10 text-smoke-500">
                  <Loader2 size={18} className="animate-spin text-orchid-500" />
                  <span className="text-sm font-medium">Loading attestations…</span>
                </div>
              ) : attestations.length === 0 ? (
                <div className="text-center py-10 bg-black/20 rounded-2xl border border-white/5">
                  <p className="text-smoke-500 font-medium">No check-ins submitted to the network yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {attestations.slice(0, 10).map((a) => {
                    const submitter = allParticipants.find((p) => p.pubkey === a.participant);
                    return (
                      <AttestationCard key={a.pubkey} attestation={a} streakId={id}
                        participantPda={a.participant}
                        submitterWallet={submitter?.user}
                        viewerAddress={address ?? undefined}
                        participantAddress={userParticipant?.pubkey}
                        onFinalized={() => void handleFinalized()} />
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-6 sm:p-8 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-medium text-white">Protocol Leaderboard</h2>
                {connected && slashableOthers > 0 && (
                  <button
                    onClick={() => void handleSlashOthers()}
                    disabled={slashingOthers || sending}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-400 border border-red-400/30 bg-red-400/10 hover:bg-red-400/20 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    {slashingOthers ? <Loader2 size={12} className="animate-spin" /> : null}
                    Slash {slashableOthers} overdue participant{slashableOthers !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
              <div className="bg-black/20 border border-grape-400/20 rounded-2xl overflow-hidden">
                <Leaderboard participants={allParticipants} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-6 shadow-xl">
              <RewardPool streak={streak} pendingPoolContribution={pendingPoolContribution} />
            </div>

            {streak.habitPrompt && (
              <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-2 h-full bg-gradient-to-b from-grape-500 to-orchid-500"></div>
                <h3 className="text-sm font-bold text-smoke-500 uppercase tracking-widest mb-3">Verifiable Condition</h3>
                <p className="text-base text-white leading-relaxed">{streak.habitPrompt}</p>
              </div>
            )}
            
            <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-6 shadow-xl font-mono text-xs text-smoke-500 space-y-3 overflow-hidden">
              <p className="text-white font-sans font-bold text-sm tracking-wide mb-2 uppercase">Contract Addresses</p>
              <div>
                <p className="text-grape-400 mb-0.5 uppercase text-[10px] tracking-widest">Protocol ID</p>
                <p className="truncate bg-black/20 p-2 rounded-lg border border-white/5">{streak.pubkey}</p>
              </div>
              <div>
                <p className="text-grape-400 mb-0.5 uppercase text-[10px] tracking-widest">Creator</p>
                <p className="truncate bg-black/20 p-2 rounded-lg border border-white/5">{streak.creator}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
