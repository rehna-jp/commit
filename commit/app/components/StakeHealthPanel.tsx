'use client';

// Per-participant stake breakdown: original stake, realized slashes, and remaining balance.
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { formatUsdc } from '@/app/lib/constants';
import type { Participant, Streak } from '@/app/lib/types';

interface Props {
  participant: Participant;
  streak: Streak;
  // 0-indexed day numbers with no accepted attestation that have fully passed
  missedDays: number[];
  onApplySlash?: () => void;
  applying?: boolean;
}

export function StakeHealthPanel({ participant, streak, missedDays, onApplySlash, applying }: Props) {
  const now = Date.now() / 1000;
  const original = streak.stakeAmount;
  const remaining = participant.stakeLocked;
  const totalSlashed = original - remaining;
  const healthPct = original > 0 ? Math.round((remaining / original) * 100) : 100;

  // Mirrors slash_missed contract: gap = expected_day - current_streak.
  // Slash eligible once the first missed day slot has fully elapsed.
  const currentDay = Math.floor((now - streak.startTimestamp) / 86400);
  const slashEligibleFrom = streak.startTimestamp + (participant.currentStreak + 1) * 86400;
  const isSlashable = participant.isActive && now >= slashEligibleFrom
    && participant.currentStreak < currentDay && missedDays.length > 0;

  // Compound the penalty for each missed day (each slash_missed call takes penaltyPercent%
  // of the current remaining balance, so multiple misses compound)
  const projectedRemaining = isSlashable
    ? missedDays.reduce((bal) => bal - Math.floor(bal * streak.penaltyPercent / 100), remaining)
    : remaining;
  const pendingRisk = remaining - projectedRemaining;

  const barColor =
    healthPct === 100 ? 'bg-green-400' :
    healthPct > 60   ? 'bg-amber-400' :
                       'bg-red-400';

  const pctColor =
    healthPct === 100 ? 'text-green-400' :
    healthPct > 60   ? 'text-amber-400' :
                       'text-red-400';

  const sortedMisses = [...missedDays].sort((a, b) => a - b);

  return (
    <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full bg-green-400 animate-pulse shrink-0" />
          <p className="text-sm font-medium text-white">You are a participant</p>
        </div>
        {missedDays.length === 0 ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-2.5 py-1">
            <ShieldCheck size={11} />
            Full stake intact
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-1">
            <AlertTriangle size={11} />
            {missedDays.length} missed day{missedDays.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Health bar — reflects actual on-chain stakeLocked */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-medium text-smoke-600 uppercase tracking-widest">Stake Health</span>
          <span className={`text-xs font-medium ${pctColor}`}>{healthPct}%</span>
        </div>
        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${healthPct}%` }}
          />
        </div>
      </div>

      {/* Original | Realized Slash | Remaining */}
      <div className="grid grid-cols-3 gap-px bg-white/5 rounded-xl overflow-hidden text-center">
        <div className="bg-black/30 p-3">
          <p className="text-[10px] font-medium text-smoke-600 uppercase tracking-widest mb-1">Original</p>
          <p className="font-mono text-sm font-medium text-white">{formatUsdc(original)}</p>
          <p className="text-[10px] text-smoke-600 mt-0.5">USDC</p>
        </div>
        <div className="bg-black/30 p-3">
          <p className="text-[10px] font-medium text-smoke-600 uppercase tracking-widest mb-1">Slashed</p>
          <p className={`font-mono text-sm font-medium ${totalSlashed > 0 ? 'text-red-400' : 'text-smoke-600'}`}>
            {totalSlashed > 0 ? `−${formatUsdc(totalSlashed)}` : '—'}
          </p>
          {totalSlashed > 0 && <p className="text-[10px] text-red-400/60 mt-0.5">USDC</p>}
        </div>
        <div className="bg-black/30 p-3">
          <p className="text-[10px] font-medium text-smoke-600 uppercase tracking-widest mb-1">Remaining</p>
          <p className="font-mono text-sm font-medium text-green-400">{formatUsdc(remaining)}</p>
          <p className="text-[10px] text-green-400/60 mt-0.5">USDC</p>
        </div>
      </div>

      {/*
        Pending slash warning: shown when past grace period — slash_missed is now callable.
        In grace: no warning (slash not yet callable; recent submission is still settling).
      */}
      {pendingRisk > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2.5 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle size={13} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-medium text-amber-400">
                Up to {formatUsdc(pendingRisk)} USDC at risk
              </p>
              <p className="text-[10px] text-amber-400/60 mt-0.5">
                Penalty not yet applied on-chain — a small SOL gas fee is required to execute it.
              </p>
            </div>
          </div>
          {onApplySlash && (
            <button
              onClick={onApplySlash}
              disabled={applying}
              className="w-full text-center text-xs font-medium text-amber-400 border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              {applying ? 'Applying…' : 'Apply Penalty'}
            </button>
          )}
        </div>
      )}

      {/* Missed day log */}
      {sortedMisses.length > 0 && (
        <div className="pt-3 border-t border-white/5 space-y-1.5">
          <p className="text-[10px] font-medium text-smoke-600 uppercase tracking-widest mb-2">Missed Submissions</p>
          {sortedMisses.map(day => (
            <div
              key={day}
              className="flex items-center justify-between text-xs bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2"
            >
              <span className="text-red-400 font-medium">Day {day + 1} — no submission</span>
              <span className="font-mono text-[11px] text-red-400/70">{streak.penaltyPercent}% penalty</span>
            </div>
          ))}

        </div>
      )}
    </div>
  );
}
