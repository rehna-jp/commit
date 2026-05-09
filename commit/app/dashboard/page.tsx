'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { findSolanaWallet } from '@/app/lib/privy-utils';
import Link from 'next/link';
import { Plus, Loader2 } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { StreakCard } from '../components/StreakCard';
import { MOCK_STREAKS } from '../lib/mock-data';

export default function DashboardPage() {
  const { authenticated, login, ready } = usePrivy();
  const { wallets } = useWallets();
  const solanaWallet = findSolanaWallet(wallets);

  // TODO: Replace with real on-chain fetches once IDL is deployed
  const myStreaks = MOCK_STREAKS.slice(0, 2);
  const browseStreaks = MOCK_STREAKS.slice(2);
  const now = Date.now() / 1000;

  if (!ready) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 size={24} className="animate-spin text-smoke-500" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32 px-6 text-center">
          <h1 className="text-2xl font-medium text-white mb-3">Connect to get started</h1>
          <p className="text-sm text-smoke-500 mb-8 max-w-sm">
            Connect your wallet to view your streaks and check in daily.
          </p>
          <button
            onClick={() => login()}
            className="bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-6 py-3 text-sm font-medium transition-colors"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amethyst-500">
      <Navbar />
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-medium text-white">Dashboard</h1>
            {solanaWallet?.address && (
              <p className="font-mono text-xs text-smoke-500 mt-1">
                {solanaWallet.address.slice(0, 8)}...{solanaWallet.address.slice(-6)}
              </p>
            )}
          </div>
          <Link
            href="/streak/create"
            className="flex items-center gap-2 bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            New Streak
          </Link>
        </div>

        {/* My Streaks */}
        <section className="mb-10">
          <h2 className="text-lg font-medium text-white mb-4">My Streaks</h2>
          {myStreaks.length === 0 ? (
            <div className="bg-grape-200/30 border border-grape-300 rounded-xl p-8 text-center">
              <p className="text-sm text-smoke-500 mb-4">You haven&apos;t joined any streaks yet.</p>
              <Link
                href="/streak/create"
                className="inline-flex items-center gap-2 bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              >
                <Plus size={14} />
                Create your first streak
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myStreaks.map((streak) => {
                const started = streak.startTimestamp <= now;
                const daysPassed = started
                  ? Math.floor((now - streak.startTimestamp) / 86400) + 1
                  : 0;
                const checkedInToday = false; // TODO: check attestation state
                return (
                  <StreakCard
                    key={streak.pubkey}
                    streak={streak}
                    showCheckin={started && !checkedInToday}
                    currentDay={daysPassed}
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* Browse Public Streaks */}
        <section>
          <h2 className="text-lg font-medium text-white mb-4">Browse Streaks</h2>
          {browseStreaks.length === 0 ? (
            <div className="text-center py-10 text-smoke-600 text-sm">
              No open streaks available — be the first!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
