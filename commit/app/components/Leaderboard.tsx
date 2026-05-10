'use client';

import { Trophy } from 'lucide-react';
import type { Participant } from '@/app/lib/types';

interface Props {
  participants: Participant[];
}

function truncate(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function Leaderboard({ participants }: Props) {
  const sorted = [...participants].sort((a, b) => b.currentStreak - a.currentStreak);

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10 text-smoke-500 text-sm font-medium">
        No participants yet.
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {sorted.map((p, idx) => (
        <div
          key={p.pubkey}
          className="flex items-center gap-4 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
        >
          <span className="w-8 text-center text-sm font-bold text-smoke-600">
            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono text-white truncate">
              {truncate(p.user)}
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="font-mono text-sm font-bold text-orchid-400 drop-shadow-[0_0_8px_rgba(202,121,165,0.4)]">
              {p.currentStreak}d
            </span>
            <span
              className={`flex items-center justify-center w-5 h-5 rounded-full ${
                !p.isActive
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : p.hasClaimed
                    ? 'bg-grape-500/20 text-grape-400 border border-grape-500/30 shadow-[0_0_10px_rgba(94,84,142,0.5)]'
                    : 'bg-green-500/20 border border-green-500/30 shadow-[0_0_8px_rgba(74,222,128,0.4)]'
              }`}
            >
              {p.hasClaimed ? (
                <Trophy size={10} />
              ) : p.isActive ? (
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
              ) : (
                <div className="w-2 h-2 rounded-full bg-red-400"></div>
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
