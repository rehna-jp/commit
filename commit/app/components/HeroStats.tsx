'use client';

import { TrendingUp, Lock } from 'lucide-react';
import { useAllStreaks } from '../lib/use-chain-data';
import { formatUsdc } from '../lib/constants';

export function HeroStats() {
  const { streaks, loading } = useAllStreaks();

  const totalStaked = streaks.reduce(
    (sum, s) => sum + s.participantCount * s.stakeAmount,
    0
  );
  const totalParticipants = streaks.reduce((sum, s) => sum + s.participantCount, 0);
  const activeParticipants = streaks.reduce((sum, s) => sum + s.activeCount, 0);
  const completionRate = totalParticipants > 0
    ? Math.round((activeParticipants / totalParticipants) * 100)
    : 0;

  return (
    <div className="mt-24 w-full max-w-4xl mx-auto grid grid-cols-2 gap-4">
      <div className="relative rounded-2xl border border-grape-400/20 bg-white/5 p-6 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col items-center">
        <div className="absolute top-0 right-0 p-4 opacity-20"><TrendingUp size={48} /></div>
        <p className="text-xs uppercase tracking-widest text-smoke-600 font-semibold mb-2">Active Participants</p>
        {loading ? (
          <p className="text-4xl font-black text-green-400">—</p>
        ) : (
          <p className="text-4xl font-black text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">
            {activeParticipants}
            <span className="text-lg text-smoke-600 ml-1">/ {totalParticipants}</span>
          </p>
        )}
        <p className="text-xs text-smoke-600 mt-1">{completionRate}% still active</p>
      </div>
      <div className="relative rounded-2xl border border-grape-400/20 bg-white/5 p-6 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col items-center">
        <div className="absolute top-0 left-0 p-4 opacity-20"><Lock size={48} /></div>
        <p className="text-xs uppercase tracking-widest text-smoke-600 font-semibold mb-2">Total Staked</p>
        {loading ? (
          <p className="text-4xl font-black text-orchid-400">—</p>
        ) : (
          <p className="text-4xl font-black bg-gradient-to-r from-orchid-400 to-lilac-400 bg-clip-text text-transparent">
            {formatUsdc(totalStaked)}
          </p>
        )}
        <p className="text-xs text-smoke-600 mt-1">USDC locked across {streaks.length} streak{streaks.length !== 1 ? 's' : ''}</p>
      </div>
    </div>
  );
}
