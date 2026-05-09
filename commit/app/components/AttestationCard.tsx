'use client';

import Link from 'next/link';
import { CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';
import { AttestationState, type CheckinAttestation } from '@/app/lib/types';
import { useEffect, useState } from 'react';

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

const STATE_STYLES: Record<AttestationState, { pill: string; dot: string; label: string }> = {
  [AttestationState.Pending]: {
    pill: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
    label: 'Pending',
  },
  [AttestationState.Disputed]: {
    pill: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
    label: 'Disputed',
  },
  [AttestationState.Finalized]: {
    pill: 'bg-green-100 text-green-800',
    dot: 'bg-green-500',
    label: 'Finalized',
  },
  [AttestationState.Overturned]: {
    pill: 'bg-zinc-100 text-zinc-600',
    dot: 'bg-zinc-400',
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
    <div className="bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-xl p-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <StateIcon
          size={18}
          className={
            attestation.state === AttestationState.Finalized
              ? 'text-green-500'
              : attestation.state === AttestationState.Disputed
                ? 'text-blue-500'
                : attestation.state === AttestationState.Overturned
                  ? 'text-zinc-400'
                  : 'text-amber-500'
          }
        />
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">
            Day {attestation.dayIndex + 1}
          </p>
          {attestation.state === AttestationState.Pending && secondsLeft > 0 && (
            <p className="text-xs text-zinc-500 dark:text-smoke-500 mt-0.5">
              Dispute window: {formatCountdown(secondsLeft)}
            </p>
          )}
          {attestation.state === AttestationState.Disputed && attestation.disputer && (
            <p className="text-xs text-zinc-500 dark:text-smoke-500 mt-0.5">
              Disputed by {attestation.disputer.slice(0, 4)}...{attestation.disputer.slice(-4)}
            </p>
          )}
          {attestation.state === AttestationState.Overturned && (
            <p className="text-xs text-zinc-500 dark:text-smoke-500 mt-0.5">
              Overturned — stake slashed
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${style.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
        {canDispute && (
          <Link
            href={`/streak/${streakId}/dispute/${attestation.pubkey}`}
            className="text-xs border border-zinc-300 dark:border-grape-400 text-zinc-600 dark:text-smoke-600 hover:border-grape-500 hover:text-grape-500 rounded-lg px-3 py-1 transition-colors"
          >
            Dispute
          </Link>
        )}
        {attestation.state === AttestationState.Disputed && (
          <Link
            href={`/streak/${streakId}/dispute/${attestation.pubkey}`}
            className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg px-3 py-1 transition-colors"
          >
            Resolve
          </Link>
        )}
      </div>
    </div>
  );
}
