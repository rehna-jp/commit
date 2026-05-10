'use client';

import Link from 'next/link';
import { CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { AttestationState, type CheckinAttestation } from '@/app/lib/types';
import { DEVNET_MODE } from '@/app/lib/constants';
import { useEffect, useState } from 'react';

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  if (DEVNET_MODE) {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const m = Math.floor(seconds / 60), s = Math.ceil(seconds % 60);
    return `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const STATE_STYLES: Record<AttestationState, { pill: string; dot: string; label: string }> = {
  [AttestationState.Pending]: {
    pill: 'bg-amber-900/30 text-amber-400 border border-amber-500/30',
    dot: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
    label: 'Pending',
  },
  [AttestationState.Disputed]: {
    pill: 'bg-blue-900/30 text-blue-400 border border-blue-500/30',
    dot: 'bg-blue-400 shadow-[0_0_8px_#60a5fa]',
    label: 'Disputed',
  },
  [AttestationState.Finalized]: {
    pill: 'bg-green-900/30 text-green-400 border border-green-500/30',
    dot: 'bg-green-400 shadow-[0_0_8px_#4ade80]',
    label: 'Finalized',
  },
  [AttestationState.Overturned]: {
    pill: 'bg-red-900/30 text-red-400 border border-red-500/30',
    dot: 'bg-red-400 shadow-[0_0_8px_#f87171]',
    label: 'Overturned',
  },
};

interface Props {
  attestation: CheckinAttestation;
  streakId: string;
  viewerAddress?: string;
  participantAddress?: string;
}

export function AttestationCard({ attestation, streakId, viewerAddress, participantAddress }: Props) {
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 30_000);
    return () => clearInterval(t);
  }, []);

  const style = STATE_STYLES[attestation.state];
  const secondsLeft = attestation.disputeWindowEnds - now;
  const canDispute =
    attestation.state === AttestationState.Pending &&
    secondsLeft > 0 &&
    viewerAddress &&
    participantAddress &&
    viewerAddress.toLowerCase() !== participantAddress.toLowerCase();

  const StateIcon =
    attestation.state === AttestationState.Finalized
      ? CheckCircle
      : attestation.state === AttestationState.Disputed
        ? AlertTriangle
        : attestation.state === AttestationState.Overturned
          ? XCircle
          : Clock;

  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-3 sm:p-4 hover:bg-black/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0">
          <StateIcon
            size={16}
            className={`shrink-0 mt-0.5 ${
              attestation.state === AttestationState.Finalized
                ? 'text-green-400'
                : attestation.state === AttestationState.Disputed
                  ? 'text-blue-400'
                  : attestation.state === AttestationState.Overturned
                    ? 'text-red-400'
                    : 'text-amber-400'
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">
              Day {attestation.dayIndex + 1}
            </p>
            {attestation.state === AttestationState.Pending && secondsLeft > 0 && (
              <p className="text-xs font-mono text-amber-400 mt-1">
                {formatCountdown(secondsLeft)} window
              </p>
            )}
            {attestation.state === AttestationState.Disputed && attestation.disputer && (
              <p className="text-xs font-mono text-blue-400 mt-1 truncate">
                Disputed by {attestation.disputer.slice(0, 4)}…{attestation.disputer.slice(-4)}
              </p>
            )}
            {attestation.state === AttestationState.Overturned && (
              <p className="text-xs font-medium text-red-400 mt-1">
                Overturned — stake slashed
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase ${style.pill}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
            {style.label}
          </span>
          {(canDispute || attestation.state === AttestationState.Disputed) && (
            <Link
              href={`/streak/${streakId}/dispute/${attestation.pubkey}`}
              className={`text-xs font-bold rounded-lg px-3 py-1.5 transition-colors ${
                attestation.state === AttestationState.Disputed
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 shadow-[0_0_10px_rgba(248,113,113,0.2)]'
              }`}
            >
              {attestation.state === AttestationState.Disputed ? 'Resolve' : 'Dispute'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
