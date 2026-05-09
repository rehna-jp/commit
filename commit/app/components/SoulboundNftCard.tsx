'use client';

import { Shield, Trophy, Calendar } from 'lucide-react';
import { HabitChip, HABIT_ICONS } from './HabitTypeSelector';
import { formatUsdc } from '@/app/lib/constants';
import { HabitType } from '@/app/lib/types';
import type { StreakProof } from '@/app/lib/types';

interface Props {
  proof: StreakProof;
  habitType?: HabitType;
}

export function SoulboundNftCard({ proof, habitType = HabitType.Code }: Props) {
  const HabitIcon = HABIT_ICONS[habitType];
  const completedDate = new Date(proof.completedAt * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="bg-orchid-50 dark:bg-grape-200 border border-orchid-500 dark:border-grape-300 rounded-2xl p-6 relative overflow-hidden">
      {/* Soulbound badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-orchid-500 dark:bg-grape-400 text-amethyst-500 dark:text-smoke-700 rounded-full px-2.5 py-1 text-xs font-medium">
        <Shield size={10} />
        Soulbound
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-grape-500 rounded-xl flex items-center justify-center">
          <HabitIcon size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-zinc-900 dark:text-white">{proof.habitName}</h3>
          <HabitChip habitType={habitType} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white dark:bg-grape-300 rounded-xl p-3">
          <p className="text-xs text-zinc-500 dark:text-smoke-600 mb-1">Duration</p>
          <p className="font-mono text-sm font-medium text-grape-500">{proof.durationDays} days</p>
        </div>
        <div className="bg-white dark:bg-grape-300 rounded-xl p-3">
          <p className="text-xs text-zinc-500 dark:text-smoke-600 mb-1">Stake Returned</p>
          <p className="font-mono text-sm font-medium text-grape-500">
            {formatUsdc(proof.stakeLamports)} USDC
          </p>
        </div>
        <div className="bg-white dark:bg-grape-300 rounded-xl p-3">
          <p className="text-xs text-zinc-500 dark:text-smoke-600 mb-1">Pool Earned</p>
          <p className="font-mono text-sm font-medium text-grape-500">
            +{formatUsdc(proof.poolShareLamports)} USDC
          </p>
        </div>
        <div className="bg-white dark:bg-grape-300 rounded-xl p-3">
          <p className="text-xs text-zinc-500 dark:text-smoke-600 mb-1">Record</p>
          <p className="text-sm font-medium text-zinc-700 dark:text-smoke-700">
            {proof.disputesUpheld}/{proof.disputesFiledAgainst} disputes
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-smoke-600 border-t border-orchid-500 dark:border-grape-400 pt-3">
        <div className="flex items-center gap-1.5">
          <Calendar size={12} />
          Completed {completedDate}
        </div>
        <div className="flex items-center gap-1">
          <Trophy size={12} className="text-lilac-500" />
          <span className="text-lilac-500">Non-transferable</span>
        </div>
      </div>

      {/* Mint address */}
      <p className="font-mono text-xs text-zinc-400 dark:text-smoke-500 mt-2 truncate">
        {proof.mint}
      </p>
    </div>
  );
}
