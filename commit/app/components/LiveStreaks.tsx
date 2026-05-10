'use client';

import Link from 'next/link';
import { ArrowRight, Loader2 } from 'lucide-react';
import { StreakCard } from './StreakCard';
import { useAllStreaks } from '../lib/use-chain-data';

export function LiveStreaks() {
  const { streaks, loading } = useAllStreaks();
  const showcase = streaks.slice(0, 3);

  return (
    <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h2 className="text-3xl font-bold text-white">Live Protocol Data</h2>
          <span className="flex size-2.5 animate-pulse rounded-full bg-green-400 shadow-[0_0_10px_#4ade80]"></span>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-smoke-500 hover:text-lilac-400 transition-colors flex items-center gap-1 group"
        >
          Explore Network <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-smoke-600">
          <Loader2 size={20} className="animate-spin text-orchid-500" />
          <span className="text-sm">Syncing with Solana…</span>
        </div>
      ) : showcase.length === 0 ? (
        <div className="text-center py-20 text-smoke-600 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-sm">
          <p className="text-lg mb-2">No active streaks on-chain yet.</p>
          <Link href="/streak/create" className="text-orchid-400 hover:text-orchid-300 text-sm font-medium transition-colors">
            Be the first to create one
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {showcase.map((streak) => (
            <StreakCard key={streak.pubkey} streak={streak} />
          ))}
        </div>
      )}
    </section>
  );
}
