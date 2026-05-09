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
      <div className="text-center py-10 text-zinc-500 dark:text-smoke-600 text-sm">
        No participants yet.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sorted.map((p, idx) => (
        <div
          key={p.pubkey}
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-zinc-50 dark:hover:bg-grape-300 transition-colors"
        >
          <span className="w-6 text-center text-xs font-medium text-zinc-400 dark:text-smoke-600">
            {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`}
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono text-zinc-700 dark:text-smoke-700 truncate">
              {truncate(p.user)}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="font-mono text-sm font-medium text-grape-500">
              {p.currentStreak}d
            </span>
            <span
              className={`w-2 h-2 rounded-full ${
                !p.isActive
                  ? 'bg-red-400'
                  : p.hasClaimed
                    ? 'text-grape-500'
                    : 'bg-green-400'
              }`}
            >
              {p.hasClaimed && (
                <Trophy size={8} className="text-grape-500" />
              )}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
