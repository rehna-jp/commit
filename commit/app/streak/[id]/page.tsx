'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { PublicKey } from '@solana/web3.js';
import { Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../../components/Navbar';
import { HabitChip } from '../../components/HabitTypeSelector';
import { Leaderboard } from '../../components/Leaderboard';
import { RewardPool } from '../../components/RewardPool';
import { AttestationCard } from '../../components/AttestationCard';
import { StakeWidget } from '../../components/StakeWidget';
import { findSolanaWallet } from '../../lib/privy-utils';
import { useStreak, useParticipant, useStreakParticipants, useStreakAttestations } from '../../lib/use-chain-data';
import { useSolanaTransaction } from '../../lib/use-solana-tx';
import { buildClaimRewardIxs } from '../../lib/solana';
import { formatUsdc } from '../../lib/constants';

export default function StreakDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const solanaWallet = findSolanaWallet(wallets);

  const { streak, loading: streakLoading, error: streakError } = useStreak(id ?? null);
  const { participant: userParticipant } = useParticipant(id ?? null, solanaWallet?.address ?? null);
  const { participants } = useStreakParticipants(id ?? null);
  const { attestations } = useStreakAttestations(id ?? null);
  const { sendTransaction, sending } = useSolanaTransaction();

  const now = Date.now() / 1000;
  const started = streak ? streak.startTimestamp <= now : false;
  const daysPassed = streak && started
    ? Math.min(Math.floor((now - streak.startTimestamp) / 86400) + 1, streak.durationDays)
    : 0;
  const progress = streak ? Math.round((daysPassed / streak.durationDays) * 100) : 0;
  const canJoin = !userParticipant && streak && participants.length < streak.maxParticipants;
  const canCheckin = userParticipant?.isActive && started;
  const canClaim = userParticipant?.isActive && !userParticipant.hasClaimed &&
    daysPassed >= (streak?.durationDays ?? 999);

  async function handleClaim() {
    if (!solanaWallet?.address || !id) return;
    try {
      const { ixs, completionMint } = await buildClaimRewardIxs(
        new PublicKey(solanaWallet.address),
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

  if (streakLoading) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 size={24} className="animate-spin text-smoke-500" />
        </div>
      </div>
    );
  }

  if (streakError || !streak) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32 px-6 text-center">
          <p className="text-smoke-500 mb-4">{streakError ?? 'Streak not found'}</p>
          <Link href="/dashboard" className="text-grape-500 hover:text-grape-600 text-sm font-medium">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amethyst-500">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <HabitChip habitType={streak.habitType} />
            <span className="text-xs text-smoke-600 border border-grape-400 rounded-full px-2.5 py-1">
              {streak.durationDays} days
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-medium text-white break-words">{streak.name}</h1>

          <div className="flex gap-3 sm:gap-4 text-sm mb-4 mt-2 overflow-x-auto pb-1">
            <span className="font-mono font-medium text-grape-500 shrink-0">{formatUsdc(streak.stakeAmount)} USDC</span>
            <span className="text-smoke-500 shrink-0">{streak.penaltyPercent}% slash</span>
            <span className="text-smoke-500 shrink-0">{streak.activeCount}/{streak.maxParticipants} active</span>
            <span className="font-mono text-grape-500 shrink-0">{formatUsdc(streak.totalPool)} pool</span>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-smoke-600 mb-1">
              <span>{started ? `Day ${daysPassed} of ${streak.durationDays}` : 'Not started'}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-grape-300 rounded-full overflow-hidden">
              <div className="h-full bg-grape-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            {canJoin && !authenticated && (
              <Link href="/dashboard" className="bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-4 py-2 text-sm font-medium">
                Connect to Join
              </Link>
            )}
            {canCheckin && (
              <Link href={`/streak/${id}/checkin`} className="bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-4 py-2 text-sm font-medium">
                Check In (Day {daysPassed})
              </Link>
            )}
            {canClaim && (
              <button onClick={() => void handleClaim()} disabled={sending}
                className="flex items-center gap-2 bg-orchid-50 text-grape-500 border border-orchid-500 hover:bg-orchid-800 disabled:opacity-70 rounded-lg px-4 py-2 text-sm font-medium">
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                Claim Reward & Mint NFT
              </button>
            )}
            {userParticipant?.hasClaimed && (
              <span className="flex items-center gap-1.5 text-sm text-green-400">
                <Trophy size={14} /> Completed &amp; claimed
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {canJoin && authenticated && (
              <StakeWidget streak={streak} userAddress={solanaWallet?.address} onJoined={() => {}} />
            )}
            <div>
              <h2 className="text-base sm:text-lg font-medium text-white mb-3">Recent Check-ins</h2>
              {attestations.length === 0 ? (
                <div className="text-center py-8 text-smoke-600 text-sm">No check-ins yet.</div>
              ) : (
                <div className="space-y-2">
                  {attestations.slice(0, 10).map((a) => (
                    <AttestationCard key={a.pubkey} attestation={a} streakId={id}
                      viewerAddress={solanaWallet?.address} participantAddress={userParticipant?.pubkey} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-medium text-white mb-3">Leaderboard</h2>
              <div className="bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-xl overflow-hidden">
                <Leaderboard participants={participants} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <RewardPool streak={streak} />
            {streak.habitPrompt && (
              <div className="bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-xl p-4">
                <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-2">Habit Description</h3>
                <p className="text-sm text-zinc-500 dark:text-smoke-600">{streak.habitPrompt}</p>
              </div>
            )}
            <div className="bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-xl p-4 text-xs font-mono text-smoke-600 space-y-1 overflow-hidden">
              <p className="text-smoke-500 font-sans font-medium text-sm mb-1.5">Contract</p>
              <p className="truncate">Streak: {streak.pubkey}</p>
              <p className="truncate">Creator: {streak.creator}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
