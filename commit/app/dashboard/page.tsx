'use client';

import { useWallet } from '@/app/lib/wallet-context';
import Link from 'next/link';
import { Plus, Loader2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { StreakCard } from '../components/StreakCard';
import { useAllStreaks, useUserStreaks } from '../lib/use-chain-data';

export default function DashboardPage() {
  const { connected, connecting, publicKey, connect } = useWallet();
  const address = publicKey?.toBase58() ?? null;

  const { streaks: allStreaks, loading: allLoading } = useAllStreaks();
  const { streaks: myStreaks, participants, loading: myLoading } = useUserStreaks(address);

  const myStreakKeys = new Set(myStreaks.map((s) => s.pubkey));
  const browseStreaks = allStreaks.filter((s) => !myStreakKeys.has(s.pubkey));
  const now = Date.now() / 1000;

  if (connecting) {
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

  if (!connected) {
    return (
      <div className="relative min-h-screen bg-[#07050d] text-white overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[30%] left-[50%] w-[50vw] h-[50vw] -translate-x-1/2 rounded-full bg-grape-600/10 blur-[150px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
        </div>
        <Navbar />
        <div className="relative z-10 flex flex-col items-center justify-center pt-40 px-6 text-center">
          <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-10 max-w-md shadow-2xl">
            <h1 className="text-3xl font-bold text-white mb-4">Connect to get started</h1>
            <p className="text-base text-smoke-500 mb-10">
              Connect your wallet to view your active streaks, check in daily, and claim your rewards.
            </p>
            <button
              onClick={() => void connect()}
              className="group relative overflow-hidden w-full bg-grape-500 text-white rounded-xl px-6 py-4 text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(94,84,142,0.5)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
              <span className="relative">Connect Wallet</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#07050d] text-white selection:bg-grape-500/30 overflow-hidden">
      {/* Immersive Glowing Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-lilac-900/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-grape-600/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
      </div>

      <Navbar />
      
      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12 bg-white/5 backdrop-blur-md border border-grape-400/10 rounded-2xl p-6 shadow-xl">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-3">
              Dashboard
              <span className="flex size-2.5 animate-pulse rounded-full bg-green-400 shadow-[0_0_10px_#4ade80]"></span>
            </h1>
            {address && (
              <p className="font-mono text-sm text-smoke-500 mt-2 bg-black/20 inline-block px-3 py-1 rounded-md border border-white/5">
                {address.slice(0, 8)}...{address.slice(-6)}
              </p>
            )}
          </div>
          <Link
            href="/streak/create"
            className="group relative overflow-hidden flex items-center justify-center gap-2 bg-grape-500 text-white rounded-xl px-6 py-3 text-sm font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(94,84,142,0.5)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
            <Plus size={18} className="relative transition-transform group-hover:rotate-90" />
            <span className="relative hidden sm:inline">Create New Streak</span>
            <span className="relative sm:hidden">New Streak</span>
          </Link>
        </div>

        {/* My Streaks */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">Active Streaks</h2>
          {myLoading ? (
            <div className="flex items-center gap-3 text-smoke-500 py-8 bg-white/5 rounded-2xl justify-center border border-white/5 backdrop-blur-sm">
              <Loader2 size={20} className="animate-spin text-orchid-500" />
              <span className="text-sm font-medium tracking-wide">Syncing your data...</span>
            </div>
          ) : myStreaks.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-2xl p-10 text-center shadow-lg">
              <div className="w-16 h-16 bg-grape-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-grape-500/30">
                <Plus size={24} className="text-lilac-400" />
              </div>
              <p className="text-lg text-smoke-500 mb-6">You haven&apos;t joined any streaks yet.</p>
              <Link
                href="/streak/create"
                className="inline-flex items-center gap-2 bg-white/10 border border-grape-400/40 text-white hover:bg-grape-500 hover:border-grape-500 rounded-xl px-6 py-3 text-sm font-bold transition-all hover:scale-105 active:scale-95 hover:shadow-[0_0_20px_rgba(94,84,142,0.5)]"
              >
                <Plus size={16} />
                Create your first streak
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {myStreaks.map((streak) => {
                const participant = participants.find((p) => p.streak === streak.pubkey);
                const started = streak.startTimestamp <= now;
                const daysPassed = started
                  ? Math.floor((now - streak.startTimestamp) / 86400) + 1
                  : 0;
                const checkedInToday = participant
                  ? participant.lastFinalizedDay >= daysPassed - 1
                  : false;
                return (
                  <StreakCard
                    key={streak.pubkey}
                    streak={streak}
                    showCheckin={started && !checkedInToday && !!participant?.isActive}
                    currentDay={daysPassed}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Browse Public Streaks */}
        <section>
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-white">Network Streaks</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-grape-400/30 to-transparent"></div>
          </div>
          
          {allLoading ? (
            <div className="flex items-center gap-3 text-smoke-500 py-8 bg-white/5 rounded-2xl justify-center border border-white/5 backdrop-blur-sm">
              <Loader2 size={20} className="animate-spin text-orchid-500" />
              <span className="text-sm font-medium tracking-wide">Loading network protocol...</span>
            </div>
          ) : browseStreaks.length === 0 ? (
            <div className="text-center py-12 text-smoke-600 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-sm">
              <p className="text-lg mb-2">No open streaks available in the network.</p>
              <p className="text-sm">Be the pioneer and start one!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {browseStreaks.map((streak) => (
                <StreakCard key={streak.pubkey} streak={streak} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
