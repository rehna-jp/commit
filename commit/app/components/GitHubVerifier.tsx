'use client';

import { useState } from 'react';
import { GitBranch, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { VerifyCheckinResponse } from '@/app/lib/types';

interface Props {
  streakPubkey: string;
  participantPubkey: string;
  dayIndex: number;
  onVerified: (result: VerifyCheckinResponse) => void;
}

export function GitHubVerifier({ streakPubkey, participantPubkey, dayIndex, onVerified }: Props) {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<'idle' | 'verifying' | 'done'>('idle');
  const [result, setResult] = useState<VerifyCheckinResponse | null>(null);

  async function handleVerify() {
    if (!username.trim()) {
      toast.error('Enter your GitHub username');
      return;
    }
    setStatus('verifying');
    try {
      const res = await fetch('/api/verify-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_pubkey: participantPubkey,
          streak_pubkey: streakPubkey,
          day_index: dayIndex,
          github_username: username.trim(),
        }),
      });
      const data = (await res.json()) as VerifyCheckinResponse;
      setResult(data);
      setStatus('done');
      if (data.verdict) {
        onVerified(data);
        toast.success('GitHub activity verified!');
      } else {
        toast.error(data.reason);
      }
    } catch {
      toast.error('GitHub verification failed — please try again');
      setStatus('idle');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch size={16} className="text-orchid-400" />
        <p className="text-sm font-bold text-white uppercase tracking-widest">GitHub Auto-Verify</p>
      </div>
      <p className="text-sm text-smoke-500 leading-relaxed">
        We check the network for qualifying commits, PRs, or repo activity in the last 24 hours.
      </p>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Enter GitHub username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={status !== 'idle'}
          className="flex-1 bg-black/30 border border-grape-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder:text-smoke-600 focus:outline-none focus:border-orchid-500 focus:ring-1 focus:ring-orchid-500/50 transition-all"
          onKeyDown={(e) => e.key === 'Enter' && void handleVerify()}
        />
        <button
          onClick={() => void handleVerify()}
          disabled={status !== 'idle' || !username.trim()}
          className="bg-grape-500 text-white hover:bg-grape-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl px-6 py-3 text-sm font-bold transition-all shadow-[0_0_15px_rgba(94,84,142,0.4)]"
        >
          {status === 'verifying' ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            'Verify'
          )}
        </button>
      </div>

      {status === 'done' && result && (
        <div
          className={`rounded-xl p-5 border mt-4 ${
            result.verdict
              ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(74,222,128,0.1)]'
              : 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(248,113,113,0.1)]'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.verdict ? (
              <CheckCircle size={20} className="text-green-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-base font-bold text-white mb-1">
                {result.verdict ? 'Activity Confirmed' : 'No qualifying activity'}
              </p>
              <p className="text-sm text-smoke-500 leading-relaxed">{result.reason}</p>
            </div>
          </div>
          {!result.verdict && (
            <button
              onClick={() => { setStatus('idle'); setResult(null); }}
              className="mt-4 text-sm text-red-400 hover:text-red-300 font-bold tracking-wide transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
