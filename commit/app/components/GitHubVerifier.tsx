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
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <GitBranch size={16} className="text-zinc-500" />
        <p className="text-sm font-medium text-zinc-700 dark:text-smoke-700">GitHub Auto-Verify</p>
      </div>
      <p className="text-xs text-zinc-500 dark:text-smoke-600">
        We check for qualifying commits, PRs, or repo activity in the last 24 hours.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="GitHub username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={status !== 'idle'}
          className="flex-1 bg-white dark:bg-grape-300 border border-zinc-200 dark:border-grape-400 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-grape-500"
          onKeyDown={(e) => e.key === 'Enter' && void handleVerify()}
        />
        <button
          onClick={() => void handleVerify()}
          disabled={status !== 'idle' || !username.trim()}
          className="bg-grape-500 text-white hover:bg-grape-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        >
          {status === 'verifying' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            'Verify'
          )}
        </button>
      </div>

      {status === 'done' && result && (
        <div
          className={`rounded-xl p-4 border ${
            result.verdict
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
              : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {result.verdict ? (
              <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                {result.verdict ? 'Activity found' : 'No qualifying activity'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-smoke-600 mt-0.5">{result.reason}</p>
            </div>
          </div>
          {!result.verdict && (
            <button
              onClick={() => { setStatus('idle'); setResult(null); }}
              className="mt-2 text-sm text-grape-500 hover:text-grape-600 font-medium"
            >
              Try Again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
