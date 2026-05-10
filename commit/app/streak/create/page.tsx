'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/app/lib/wallet-context';
import { PublicKey } from '@solana/web3.js';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../../components/Navbar';
import { HabitTypeSelector } from '../../components/HabitTypeSelector';
import { HabitType } from '../../lib/types';
import { useSolanaTransaction } from '../../lib/use-solana-tx';
import { buildCreateStreakIxs } from '../../lib/solana';
import { toBaseUnits } from '../../lib/constants';

const DURATION_PRESETS = [7, 14, 21, 30];

export default function CreateStreakPage() {
  const router = useRouter();
  const { connected, publicKey, connect } = useWallet();

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

  if (!connected) {
    return (
      <div className="relative min-h-screen bg-[#07050d] text-white overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[30%] left-[50%] w-[50vw] h-[50vw] -translate-x-1/2 rounded-full bg-grape-600/10 blur-[150px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
        </div>
        <Navbar />
        <div className="relative z-10 flex flex-col items-center justify-center pt-40 px-6 text-center">
          <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-10 max-w-md shadow-2xl">
            <h1 className="text-3xl font-bold text-white mb-4">Connect to create a streak</h1>
            <p className="text-base text-smoke-500 mb-10">
              You must connect your Solana wallet to deploy a new habit streak to the protocol.
            </p>
            <button onClick={() => void connect()} className="group relative overflow-hidden w-full bg-grape-500 text-white rounded-xl px-6 py-4 text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(94,84,142,0.5)]">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
              <span className="relative">Connect Wallet</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey) { toast.error('No Solana wallet connected'); return; }
    if (!name.trim()) { toast.error('Enter a streak name'); return; }
    if (!startDate) { toast.error('Select a start date'); return; }
    if (new Date(startDate) <= new Date()) { toast.error('Start date must be in the future'); return; }

    const resolvedDuration = customDuration ? Number(customDuration) : durationDays;
    const stakeBaseUnits = toBaseUnits(Number(stakeAmount));
    const startTs = Math.floor(new Date(startDate).getTime() / 1000);

    try {
      const ixs = await buildCreateStreakIxs(publicKey, {
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
    <div className="relative min-h-screen bg-[#07050d] text-white selection:bg-grape-500/30 overflow-hidden pb-20">
      {/* Immersive Glowing Background */}
      <div className="absolute inset-0 z-0 pointer-events-none fixed">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-orchid-900/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-grape-600/10 blur-[150px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
      </div>

      <Navbar />
      <div className="relative z-10 mx-auto max-w-2xl px-4 sm:px-6 py-10 sm:py-14">
        <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-8">
            <h1 className="text-3xl font-bold text-white bg-gradient-to-r from-white to-smoke-600 bg-clip-text text-transparent">Deploy New Streak</h1>
            <span className="flex size-2.5 animate-pulse rounded-full bg-green-400 shadow-[0_0_10px_#4ade80]"></span>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
            <div>
              <label className="text-xs font-bold text-smoke-600 uppercase tracking-widest block mb-2">Streak Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value.slice(0, 64))} maxLength={64}
                placeholder="e.g. Code daily for 30 days"
                className="w-full bg-black/20 border border-grape-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder:text-smoke-600 focus:outline-none focus:border-orchid-500 focus:ring-1 focus:ring-orchid-500/50 focus:shadow-[0_0_15px_rgba(202,121,165,0.2)] transition-all" />
              <p className="text-xs text-smoke-600 mt-1.5 text-right font-mono">{name.length}/64</p>
            </div>

            <div>
              <label className="text-xs font-bold text-smoke-600 uppercase tracking-widest block mb-2">Habit Type</label>
              <HabitTypeSelector value={habitType} onChange={setHabitType} />
            </div>

            <div>
              <label className="text-xs font-bold text-smoke-600 uppercase tracking-widest block mb-2">
                Habit Description <span className="text-smoke-600/60 normal-case font-normal">(Verifiable AI Prompt)</span>
              </label>
              <textarea value={habitPrompt} onChange={(e) => setHabitPrompt(e.target.value.slice(0, 256))}
                placeholder="e.g. Show your code editor with an active project and visible recent edits"
                rows={3}
                className="w-full bg-black/20 border border-grape-400/30 rounded-xl px-4 py-3 text-sm text-white placeholder:text-smoke-600 focus:outline-none focus:border-orchid-500 focus:ring-1 focus:ring-orchid-500/50 focus:shadow-[0_0_15px_rgba(202,121,165,0.2)] transition-all resize-none" />
              <p className="text-xs text-smoke-600 mt-1.5 text-right font-mono">{habitPrompt.length}/256</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-smoke-600 uppercase tracking-widest block mb-2">Duration</label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((d) => (
                    <button key={d} type="button" onClick={() => { setDurationDays(d); setCustomDuration(''); }}
                      className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${!customDuration && durationDays === d ? 'bg-grape-500 text-white border-grape-500 shadow-[0_0_15px_rgba(94,84,142,0.4)]' : 'border-grape-400/30 text-smoke-500 bg-black/20 hover:border-grape-400/60 hover:text-white'}`}>
                      {d}d
                    </button>
                  ))}
                  <input type="number" value={customDuration} onChange={(e) => setCustomDuration(e.target.value)}
                    placeholder="Custom" min={1} max={365}
                    className="w-24 bg-black/20 border border-grape-400/30 rounded-lg px-3 py-2 text-sm text-white placeholder:text-smoke-600 focus:outline-none focus:border-orchid-500 focus:ring-1 focus:ring-orchid-500/50 transition-all" />
                </div>
                <p className="text-xs text-smoke-600 mt-2 font-mono">Running for <span className="text-white font-bold">{resolvedDuration}</span> days</p>
              </div>

              <div>
                <label className="text-xs font-bold text-smoke-600 uppercase tracking-widest block mb-2">Stake Amount (USDC)</label>
                <div className="flex items-center gap-3">
                  <input type="number" value={stakeAmount} onChange={(e) => setStakeAmount(e.target.value)} min={1} step={1}
                    className="flex-1 bg-black/20 border border-grape-400/30 rounded-xl px-4 py-3 text-lg font-bold text-white focus:outline-none focus:border-orchid-500 focus:ring-1 focus:ring-orchid-500/50 focus:shadow-[0_0_15px_rgba(202,121,165,0.2)] transition-all" />
                  <span className="text-sm font-bold tracking-wider text-grape-400">USDC</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-smoke-600 uppercase tracking-widest block mb-2">
                  Failure Penalty: <span className="font-mono text-orchid-400 ml-1">{penaltyPercent}%</span>
                </label>
                <input type="range" min={10} max={100} step={5} value={penaltyPercent}
                  onChange={(e) => setPenaltyPercent(Number(e.target.value))} className="w-full accent-orchid-500 bg-black/30 rounded-lg appearance-none h-2 cursor-pointer" />
                <div className="flex justify-between text-xs font-medium text-smoke-600 mt-2">
                  <span>10% (Lenient)</span><span>100% (Strict)</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-smoke-600 uppercase tracking-widest block mb-2">Max Participants</label>
                <input type="number" value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Math.min(50, Math.max(2, Number(e.target.value))))} min={2} max={50}
                  className="w-full bg-black/20 border border-grape-400/30 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orchid-500 focus:ring-1 focus:ring-orchid-500/50 transition-all" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-smoke-600 uppercase tracking-widest block mb-2">Start Date & Time</label>
              <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} min={minDate}
                className="w-full bg-black/20 border border-grape-400/30 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orchid-500 focus:ring-1 focus:ring-orchid-500/50 transition-all [color-scheme:dark]" />
            </div>

            <button type="submit" disabled={sending}
              className="group relative overflow-hidden w-full flex items-center justify-center gap-2 bg-grape-500 text-white disabled:opacity-70 disabled:hover:scale-100 rounded-xl py-4 mt-8 text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(94,84,142,0.5)]">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
              {sending && <Loader2 size={18} className="animate-spin relative" />}
              <span className="relative">Deploy Protocol to Solana</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
