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
    <div className="bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-xl p-5 hover:border-l-[3px] hover:border-l-grape-500 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <HabitIcon size={15} className="text-grape-500 shrink-0" />
            <h3 className="text-sm font-medium text-zinc-900 dark:text-white truncate">
              {streak.name}
            </h3>
          </div>
          <HabitChip habitType={streak.habitType} />
        </div>
        <div className="text-right ml-3 shrink-0">
          <p className="font-mono text-sm font-medium text-grape-500">
            {formatUsdc(streak.stakeAmount)} USDC
          </p>
          <p className="text-xs text-zinc-500 dark:text-smoke-500">stake</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-500 dark:text-smoke-500">{daysLabel}</span>
          <span className="text-xs text-zinc-500 dark:text-smoke-500">{progress}%</span>
        </div>
        <div className="h-1.5 bg-grape-900 dark:bg-grape-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-grape-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-smoke-600">
          <Users size={12} />
          <span>{streak.activeCount}/{streak.maxParticipants} active</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-smoke-600">
          <TrendingUp size={12} />
          <span className="font-mono">{formatUsdc(streak.totalPool)} USDC pool</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-smoke-600">
          <Clock size={12} />
          <span>{streak.penaltyPercent}% slash</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Link
          href={`/streak/${streak.pubkey}`}
          className="flex-1 text-center border border-zinc-300 dark:border-grape-400 text-zinc-700 dark:text-smoke-700 hover:bg-zinc-50 dark:hover:bg-grape-300 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          View
        </Link>
        {showCheckin && started && (
          <Link
            href={`/streak/${streak.pubkey}/checkin`}
            className="flex-1 text-center bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Check In {currentDay ? `(Day ${currentDay})` : ''}
          </Link>
        )}
        {!started && (
          <Link
            href={`/streak/${streak.pubkey}`}
            className="flex-1 text-center bg-orchid-50 text-grape-500 hover:bg-orchid-800 border border-orchid-500 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            Join Streak
          </Link>
        )}
      </div>
    </div>
  );
}
