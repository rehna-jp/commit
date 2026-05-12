'use client';

import { AlertTriangle } from 'lucide-react';
import { formatUsdc } from '@/app/lib/constants';
import type { Streak } from '@/app/lib/types';

interface Props {
  streak: Streak;
  // Total USDC that will flow into the pool once pending slash_missed calls are made
  pendingPoolContribution?: number;
}

export function RewardPool({ streak, pendingPoolContribution = 0 }: Props) {
  const totalStaked = streak.participantCount * streak.stakeAmount;
  // Participants who dropped out (not active, not completed = fully slashed out)
  const droppedCount = streak.participantCount - streak.activeCount - streak.completedCount;
  // Pool as % of total staked — shows how much has flowed from escrow into the prize pool
  const poolFillPct = totalStaked > 0 ? Math.min(Math.round((streak.totalPool / totalStaked) * 100), 100) : 0;
  // Estimated share: distribute pool among participants still active or completed
  const eligibleCount = streak.activeCount + streak.completedCount;
  const perCompleterShare = streak.totalPool > 0 && eligibleCount > 0
    ? Math.floor(streak.totalPool / eligibleCount)
    : 0;

  return (
    <div className="space-y-3">
      {/* Escrow total */}
      <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-5">
        <p className="text-[10px] font-medium text-smoke-600 uppercase tracking-widest mb-1">
          Total Staked in Escrow
        </p>
        <p className="font-mono text-2xl font-medium text-white">
          {formatUsdc(totalStaked)}{' '}
          <span className="text-sm font-medium text-smoke-600 uppercase tracking-widest">USDC</span>
        </p>
        <p className="text-xs text-smoke-600 mt-1">
          {streak.participantCount} participant{streak.participantCount !== 1 ? 's' : ''} × {formatUsdc(streak.stakeAmount)} USDC
        </p>
      </div>

      {/* Reward pool */}
      <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-5 space-y-4">
        <div>
          <p className="text-[10px] font-medium text-smoke-600 uppercase tracking-widest mb-1">
            Reward Pool
          </p>
          <p className="font-mono text-2xl font-medium text-green-400">
            {formatUsdc(streak.totalPool)}{' '}
            <span className="text-sm font-medium text-green-400/60 uppercase tracking-widest ml-1">USDC</span>
          </p>

          {/* Pool fill bar */}
          {totalStaked > 0 && (
            <div className="mt-3">
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full transition-all duration-700"
                  style={{ width: `${poolFillPct}%` }}
                />
              </div>
              <p className="text-[10px] text-smoke-600 mt-1">
                {poolFillPct}% of total staked slashed to pool
              </p>
            </div>
          )}
        </div>

        {/* Source breakdown */}
        <div className="pt-3 border-t border-white/5 space-y-2">
          <p className="text-[10px] font-medium text-smoke-600 uppercase tracking-widest">Pool Source</p>

          <div className="flex items-center justify-between text-xs">
            <span className="text-smoke-500">Penalty per missed day</span>
            <span className="font-mono font-medium text-amber-400">{streak.penaltyPercent}% of remaining stake</span>
          </div>

          {streak.totalPool === 0 && pendingPoolContribution === 0 ? (
            <p className="text-xs text-smoke-600">
              No slashes yet — pool grows each time a participant misses a day.
            </p>
          ) : (
            <div className="flex items-center justify-between text-xs">
              <span className="text-smoke-500">Dropped participants</span>
              <span className="font-mono font-medium text-red-400">{droppedCount}</span>
            </div>
          )}

          {pendingPoolContribution > 0 && (
            <div className="flex items-start gap-2 mt-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
              <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-400/80">
                +{formatUsdc(pendingPoolContribution)} USDC pending — slash not yet applied on-chain
              </p>
            </div>
          )}
        </div>

        {/* Est. per-completer share */}
        {perCompleterShare > 0 && (
          <div className="pt-3 border-t border-white/5">
            <p className="text-[10px] font-medium text-smoke-600 uppercase tracking-widest mb-1">
              Est. Share per Completer
            </p>
            <p className="font-mono text-base font-medium text-white">
              ~{formatUsdc(perCompleterShare)}{' '}
              <span className="text-xs text-smoke-600">USDC</span>
            </p>
            <p className="text-[10px] text-smoke-600 mt-0.5">
              distributed among {eligibleCount} remaining participant{eligibleCount !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
