'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { PublicKey } from '@solana/web3.js';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../../components/Navbar';
import { HabitTypeSelector } from '../../components/HabitTypeSelector';
import { HabitType } from '../../lib/types';
import { useSolanaTransaction } from '../../lib/use-solana-tx';
import { buildCreateStreakIxs } from '../../lib/solana';
import { findSolanaWallet } from '../../lib/privy-utils';
import { toBaseUnits } from '../../lib/constants';

const DURATION_PRESETS = [7, 14, 21, 30];

export default function CreateStreakPage() {
  const router = useRouter();
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const solanaWallet = findSolanaWallet(wallets);

  const [name, setName] = useState('');
  const [habitType, setHabitType] = useState<HabitType>(HabitType.Code);
  const [habitPrompt, setHabitPrompt] = useState('');
  const [durationDays, setDurationDays] = useState(30);
  const [customDuration, setCustomDuration] = useState('');
  const [stakeAmount, setStakeAmount] = useState('5');
  const [penaltyPercent, setPenaltyPercent] = useState(50);
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [startDate, setStartDate] = useState('');

  const { sendTransaction, sending } = useSolanaTransaction();

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32 px-6 text-center">
          <h1 className="text-xl font-medium text-white mb-3">Connect to create a streak</h1>
          <button onClick={() => login()} className="bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-6 py-3 text-sm font-medium">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!solanaWallet?.address) { toast.error('No Solana wallet connected'); return; }
    if (!name.trim()) { toast.error('Enter a streak name'); return; }
    if (!startDate) { toast.error('Select a start date'); return; }
    if (new Date(startDate) <= new Date()) { toast.error('Start date must be in the future'); return; }

    const resolvedDuration = customDuration ? Number(customDuration) : durationDays;
    const stakeBaseUnits = toBaseUnits(Number(stakeAmount));
    const startTs = Math.floor(new Date(startDate).getTime() / 1000);

    try {
      const ixs = await buildCreateStreakIxs(new PublicKey(solanaWallet.address), {
        name: name.trim(),
        habitType,
        habitPrompt,
        durationDays: resolvedDuration,
        stakeAmount: stakeBaseUnits,
        penaltyPercent,
        maxParticipants,
        startTimestamp: startTs,
      });
      await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });
      toast.success('Streak created!');
      router.push('/dashboard');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create streak');
    }
  }

  const resolvedDuration = customDuration ? Number(customDuration) : durationDays;
  const minDate = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <div className="min-h-screen bg-amethyst-500">
      <Navbar />
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-2xl font-medium text-white mb-7">Create a Streak</h1>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div>
            <label className="text-xs font-medium text-smoke-500 uppercase tracking-wide block mb-1.5">Streak Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value.slice(0, 64))} maxLength={64}
              placeholder="e.g. Code daily for 30 days"
              className="w-full bg-grape-200 border border-grape-300 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-smoke-600 focus:outline-none focus:border-grape-500" />
            <p className="text-xs text-smoke-600 mt-1 text-right">{name.length}/64</p>
          </div>

          <div>
            <label className="text-xs font-medium text-smoke-500 uppercase tracking-wide block mb-1.5">Habit Type</label>
            <HabitTypeSelector value={habitType} onChange={setHabitType} />
          </div>

          <div>
            <label className="text-xs font-medium text-smoke-500 uppercase tracking-wide block mb-1.5">
              Habit Description <span className="text-smoke-600 normal-case font-normal">(goes into AI prompt)</span>
            </label>
            <textarea value={habitPrompt} onChange={(e) => setHabitPrompt(e.target.value.slice(0, 256))}
              placeholder="e.g. Show your code editor with an active project and visible recent edits"
              rows={3}
              className="w-full bg-grape-200 border border-grape-300 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-smoke-600 focus:outline-none focus:border-grape-500 resize-none" />
            <p className="text-xs text-smoke-600 mt-1 text-right">{habitPrompt.length}/256</p>
          </div>

          <div>
            <label className="text-xs font-medium text-smoke-500 uppercase tracking-wide block mb-1.5">Duration</label>
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((d) => (
                <button key={d} type="button" onClick={() => { setDurationDays(d); setCustomDuration(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${!customDuration && durationDays === d ? 'bg-grape-500 text-white border-grape-500' : 'border-grape-400 text-smoke-600 hover:border-grape-500'}`}>
                  {d}d
                </button>
              ))}
              <input type="number" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)}
                placeholder="Custom" min={1} max={365}
                className="w-24 bg-grape-200 border border-grape-400 rounded-lg px-3 py-2 text-sm text-white placeholder:text-smoke-600 focus:outline-none focus:border-grape-500" />
            </div>
            <p className="text-xs text-smoke-600 mt-1">{resolvedDuration} days selected</p>
          </div>

          <div>
            <label className="text-xs font-medium text-smoke-500 uppercase tracking-wide block mb-1.5">Stake Amount (USDC)</label>
            <div className="flex items-center gap-2">
              <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} min={1} step={1}
                className="w-32 bg-grape-200 border border-grape-300 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-grape-500" />
              <span className="text-sm text-smoke-600">USDC</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-smoke-500 uppercase tracking-wide block mb-1.5">
              Penalty — <span className="font-mono text-grape-500">{penaltyPercent}%</span>
            </label>
            <input type="range" min={10} max={100} step={5} value={penaltyPercent}
              onChange={(e) => setPenaltyPercent(Number(e.target.value))} className="w-full accent-grape-500" />
            <div className="flex justify-between text-xs text-smoke-600 mt-1">
              <span>10% (lenient)</span><span>100% (strict)</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-smoke-500 uppercase tracking-wide block mb-1.5">Max Participants</label>
            <input type="number" value={maxParticipants}
              onChange={(e) => setMaxParticipants(Math.min(50, Math.max(2, Number(e.target.value))))} min={2} max={50}
              className="w-32 bg-grape-200 border border-grape-300 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-grape-500" />
          </div>

          <div>
            <label className="text-xs font-medium text-smoke-500 uppercase tracking-wide block mb-1.5">Start Date & Time</label>
            <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} min={minDate}
              className="bg-grape-200 border border-grape-300 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-grape-500 w-full sm:w-auto" />
          </div>

          <button type="submit" disabled={sending}
            className="w-full flex items-center justify-center gap-2 bg-grape-500 text-white hover:bg-grape-600 disabled:opacity-70 rounded-lg py-3 text-sm font-medium transition-colors">
            {sending && <Loader2 size={16} className="animate-spin" />}
            Create Streak
          </button>
        </form>
      </div>
    </div>
  );
}
