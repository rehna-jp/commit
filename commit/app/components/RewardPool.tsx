'use client';

import { formatUsdc } from '@/app/lib/constants';
import type { Streak } from '@/app/lib/types';

interface Props {
  streak: Streak;
}

export function RewardPool({ streak }: Props) {
  const totalStaked = streak.participantCount * streak.stakeAmount;
  const slashedCount = streak.participantCount - streak.activeCount - streak.completedCount;
  const perCompleterShare = streak.totalPool > 0 && streak.activeCount > 0
    ? Math.floor(streak.totalPool / streak.activeCount)
    : 0;

  return (
    <div className="space-y-3">
      {/* Escrow — total staked by all participants */}
      <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-5 shadow-inner">
        <p className="text-xs font-bold text-smoke-600 uppercase tracking-widest mb-1">
          Total Staked in Escrow
        </p>
        <p className="font-mono text-2xl font-black text-white">
          {formatUsdc(totalStaked)}{' '}
          <span className="text-sm font-bold text-smoke-600 uppercase tracking-widest">USDC</span>
        </p>
        <p className="text-xs text-smoke-600 mt-1">
          {streak.participantCount} participant{streak.participantCount !== 1 ? 's' : ''} × {formatUsdc(streak.stakeAmount)} USDC
        </p>
      </div>

      {/* Reward pool — grows only when participants are slashed */}
      <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-5 shadow-inner relative overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] w-[150px] h-[150px] bg-green-500/10 blur-[50px] rounded-full pointer-events-none"></div>
        <p className="text-xs font-bold text-smoke-600 uppercase tracking-widest mb-1">
          Reward Pool
        </p>
        <p className="font-mono text-2xl font-black text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">
          {formatUsdc(streak.totalPool)}{' '}
          <span className="text-sm font-bold text-green-400/60 uppercase tracking-widest ml-1">USDC</span>
        </p>
        <p className="text-xs text-smoke-600 mt-1">
          {streak.totalPool === 0
            ? 'Grows when participants miss a day and get slashed'
            : slashedCount > 0
              ? `Funded by ${slashedCount} slashed participant${slashedCount !== 1 ? 's' : ''}`
              : 'Funded by slashed stakes'}
        </p>

        {perCompleterShare > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-xs font-bold text-smoke-600 uppercase tracking-widest">Est. share per completer</p>
            <p className="font-mono text-base font-bold text-white mt-1">
              ~{formatUsdc(perCompleterShare)} USDC
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
