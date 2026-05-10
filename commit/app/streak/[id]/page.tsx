'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@/app/lib/wallet-context';
import { PublicKey } from '@solana/web3.js';
import { Loader2, Trophy, Clock, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../../components/Navbar';
import { HabitChip } from '../../components/HabitTypeSelector';
import { Leaderboard } from '../../components/Leaderboard';
import { RewardPool } from '../../components/RewardPool';
import { AttestationCard } from '../../components/AttestationCard';
import { StakeWidget } from '../../components/StakeWidget';
import { useStreak, useParticipant, useStreakParticipants, useStreakAttestations } from '../../lib/use-chain-data';
import { useSolanaTransaction } from '../../lib/use-solana-tx';
import { buildClaimRewardIxs } from '../../lib/solana';
import { formatUsdc } from '../../lib/constants';

export default function StreakDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { connected, publicKey } = useWallet();
  const address = publicKey?.toBase58() ?? null;

  const { streak, loading: streakLoading, error: streakError } = useStreak(id ?? null);
  const { participant: userParticipant } = useParticipant(id ?? null, address);
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
              {canClaim && (
                <button onClick={() => void handleClaim()} disabled={sending}
                  className="group relative overflow-hidden flex items-center gap-2 bg-orchid-500/10 border border-orchid-500 text-orchid-400 hover:bg-orchid-500/20 disabled:opacity-70 rounded-xl px-8 py-3.5 text-base font-bold transition-all hover:shadow-[0_0_20px_rgba(202,121,165,0.4)] active:scale-95">
                  <div className="absolute inset-0 bg-gradient-to-r from-orchid-400/0 via-orchid-400/20 to-orchid-400/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
                  {sending ? <Loader2 size={18} className="animate-spin relative" /> : <Trophy size={18} className="relative" />}
                  <span className="relative">Claim Reward & Mint NFT</span>
                </button>
              )}
              {userParticipant?.hasClaimed && (
                <span className="flex items-center gap-2 text-base font-bold text-green-400 bg-green-400/10 border border-green-400/30 px-6 py-3 rounded-xl">
                  <Trophy size={18} /> Protocol Completed
                </span>
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
                  <div className="bg-black/20 border border-green-400/20 rounded-2xl p-5 flex items-center gap-3">
                    <span className="inline-block size-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-white">You are a participant</p>
                      <p className="text-xs text-smoke-500 mt-0.5">Your stake of {formatUsdc(userParticipant.stakeLocked)} USDC is locked in escrow</p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
            
            <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-6 sm:p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                Recent Network Attestations
                <span className="flex size-2 animate-pulse rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]"></span>
              </h2>
              {attestations.length === 0 ? (
                <div className="text-center py-10 bg-black/20 rounded-2xl border border-white/5">
                  <p className="text-smoke-500 font-medium">No check-ins submitted to the network yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {attestations.slice(0, 10).map((a) => (
                    <AttestationCard key={a.pubkey} attestation={a} streakId={id}
                      viewerAddress={address ?? undefined} participantAddress={userParticipant?.pubkey} />
                  ))}
                </div>
              )}
            </div>
            
            <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-6 sm:p-8 shadow-xl">
              <h2 className="text-xl font-bold text-white mb-6">Protocol Leaderboard</h2>
              <div className="bg-black/20 border border-grape-400/20 rounded-2xl overflow-hidden">
                <Leaderboard participants={participants} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-6 shadow-xl">
              <RewardPool streak={streak} />
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
