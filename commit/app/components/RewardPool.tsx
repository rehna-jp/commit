'use client';

import { formatUsdc } from '@/app/lib/constants';
import type { Streak } from '@/app/lib/types';

interface Props {
  streak: Streak;
}

export function RewardPool({ streak }: Props) {
  const slashedCount = streak.participantCount - streak.activeCount - streak.completedCount;

  return (
    <div className="bg-orchid-50 dark:bg-grape-200 border border-orchid-500 dark:border-grape-300 rounded-xl p-5">
      <p className="text-xs font-medium text-zinc-500 dark:text-smoke-600 uppercase tracking-wide mb-2">
        Reward Pool
      </p>
      <p className="font-mono text-2xl font-medium text-grape-500">
        {formatUsdc(streak.totalPool)} <span className="text-sm text-zinc-500">USDC</span>
      </p>
      {slashedCount > 0 && (
        <p className="text-xs text-zinc-500 dark:text-smoke-600 mt-1">
          from {slashedCount} slashed participant{slashedCount !== 1 ? 's' : ''}
        </p>
      )}
      {streak.activeCount > 0 && (
        <p className="text-xs text-zinc-500 dark:text-smoke-600">
          to split among {streak.activeCount} active participant{streak.activeCount !== 1 ? 's' : ''}
        </p>
      )}

      {streak.totalPool > 0 && streak.activeCount > 0 && (
        <div className="mt-3 pt-3 border-t border-orchid-500 dark:border-grape-400">
          <p className="text-xs text-zinc-500 dark:text-smoke-600">Estimated share per completer</p>
          <p className="font-mono text-sm font-medium text-grape-500 mt-0.5">
            ~{formatUsdc(Math.floor(streak.totalPool / streak.activeCount))} USDC
          </p>
        </div>
      )}
    </div>
  );
}
