'use client';

import Link from 'next/link';
import { Users, Clock, TrendingUp } from 'lucide-react';
import { HabitChip, HABIT_ICONS } from './HabitTypeSelector';
import { formatUsdc } from '@/app/lib/constants';
import type { Streak } from '@/app/lib/types';

interface Props {
  streak: Streak;
  showCheckin?: boolean;
  currentDay?: number;
}

export function StreakCard({ streak, showCheckin, currentDay }: Props) {
  const now = Date.now() / 1000;
  const started = streak.startTimestamp <= now;
  const daysPassed = started
    ? Math.min(Math.floor((now - streak.startTimestamp) / 86400) + 1, streak.durationDays)
    : 0;
  const progress = Math.round((daysPassed / streak.durationDays) * 100);
  const HabitIcon = HABIT_ICONS[streak.habitType];

  const daysLabel = started
    ? `Day ${daysPassed} of ${streak.durationDays}`
    : `Starts in ${Math.ceil((streak.startTimestamp - now) / 86400)} days`;

  return (
    <div className="relative group bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(153,134,209,0.3)] hover:border-grape-400/40">
      <div className="absolute inset-0 bg-gradient-to-br from-grape-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none"></div>
      
      <div className="relative z-10 flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="bg-grape-500/20 p-1.5 rounded-lg border border-grape-500/30">
              <HabitIcon size={16} className="text-lilac-400 drop-shadow-[0_0_8px_rgba(190,149,196,0.6)]" />
            </div>
            <h3 className="text-base font-bold text-white truncate group-hover:text-lilac-400 transition-colors">
              {streak.name}
            </h3>
          </div>
          <HabitChip habitType={streak.habitType} />
        </div>
        <div className="text-right ml-4 shrink-0">
          <p className="font-mono text-lg font-bold bg-gradient-to-r from-white to-smoke-600 bg-clip-text text-transparent">
            {formatUsdc(streak.stakeAmount)} <span className="text-sm">USDC</span>
          </p>
          <p className="text-xs uppercase tracking-wider font-semibold text-grape-500">Stake</p>
        </div>
      </div>

      {/* Progress */}
      <div className="relative z-10 mb-5 bg-[#13111c]/60 p-3 rounded-xl border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-smoke-500">{daysLabel}</span>
          <span className="text-xs font-bold text-orchid-400 drop-shadow-[0_0_5px_rgba(202,121,165,0.5)]">{progress}%</span>
        </div>
        <div className="h-2 bg-grape-900/50 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-grape-500 to-orchid-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(202,121,165,0.8)] relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-4 bg-white/30 blur-[2px]"></div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="relative z-10 grid grid-cols-3 gap-2 mb-5">
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/5 border border-white/5">
          <Users size={14} className="text-smoke-600 mb-1" />
          <span className="text-xs font-medium text-smoke-500"><span className="text-white">{streak.activeCount}</span>/{streak.maxParticipants}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/5 border border-white/5">
          <TrendingUp size={14} className="text-smoke-600 mb-1" />
          <span className="text-xs font-medium text-smoke-500"><span className="text-white font-mono">{formatUsdc(streak.totalPool)}</span> USDC</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-white/5 border border-white/5">
          <Clock size={14} className="text-red-400/70 mb-1" />
          <span className="text-xs font-medium text-smoke-500"><span className="text-white">{streak.penaltyPercent}%</span> slash</span>
        </div>
      </div>

      {/* Actions */}
      <div className="relative z-10 flex items-center gap-3">
        <Link
          href={`/streak/${streak.pubkey}`}
          className="flex-1 text-center border border-grape-400/40 text-smoke-600 hover:text-white hover:bg-white/10 rounded-lg px-4 py-2.5 text-sm font-medium transition-all active:scale-95"
        >
          View Details
        </Link>
        {showCheckin && started && (
          <Link
            href={`/streak/${streak.pubkey}/checkin`}
            className="group/btn relative overflow-hidden flex-1 text-center bg-grape-500 text-white rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:shadow-[0_0_15px_rgba(94,84,142,0.6)] active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover/btn:opacity-100 group-hover/btn:animate-[shimmer_2s_infinite]"></div>
            <span className="relative">Check In {currentDay ? `(Day ${currentDay})` : ''}</span>
          </Link>
        )}
        {!started && (
          <Link
            href={`/streak/${streak.pubkey}`}
            className="group/btn relative overflow-hidden flex-1 text-center bg-orchid-500/10 text-orchid-400 border border-orchid-500/30 hover:border-orchid-500/60 hover:bg-orchid-500/20 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:shadow-[0_0_15px_rgba(202,121,165,0.4)] active:scale-95"
          >
             <div className="absolute inset-0 bg-gradient-to-r from-orchid-400/0 via-orchid-400/20 to-orchid-400/0 opacity-0 transition-opacity duration-500 group-hover/btn:opacity-100 group-hover/btn:animate-[shimmer_2s_infinite]"></div>
            <span className="relative">Join Streak</span>
          </Link>
        )}
      </div>
    </div>
  );
}
