'use client';

import { formatUsdc } from '@/app/lib/constants';
import type { Streak } from '@/app/lib/types';

interface Props {
  streak: Streak;
}

export function RewardPool({ streak }: Props) {
  const slashedCount = streak.participantCount - streak.activeCount - streak.completedCount;

  return (
    <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-6 shadow-inner relative overflow-hidden">
      <div className="absolute top-[-50px] right-[-50px] w-[150px] h-[150px] bg-green-500/10 blur-[50px] rounded-full pointer-events-none"></div>
      
      <p className="text-xs font-bold text-smoke-600 uppercase tracking-widest mb-2">
        Protocol Reward Pool
      </p>
      <p className="font-mono text-3xl font-black text-green-400 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)]">
        {formatUsdc(streak.totalPool)} <span className="text-sm font-bold text-green-400/60 uppercase tracking-widest ml-1">USDC</span>
      </p>
      
      {slashedCount > 0 && (
        <p className="text-xs font-medium text-smoke-500 mt-2">
          Includes stake from <span className="text-red-400 font-bold">{slashedCount} slashed</span> participant{slashedCount !== 1 ? 's' : ''}
        </p>
      )}
      {streak.activeCount > 0 && (
        <p className="text-xs font-medium text-smoke-500 mt-1">
          To be split among <span className="text-white font-bold">{streak.activeCount} active</span> participant{streak.activeCount !== 1 ? 's' : ''}
        </p>
      )}

      {streak.totalPool > 0 && streak.activeCount > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs font-bold text-smoke-600 uppercase tracking-widest">Estimated share per completer</p>
          <p className="font-mono text-base font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)] mt-1">
            ~{formatUsdc(Math.floor(streak.totalPool / streak.activeCount))} USDC
          </p>
        </div>
      )}
    </div>
  );
}
