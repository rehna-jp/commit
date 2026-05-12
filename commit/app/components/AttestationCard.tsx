'use client';

import Link from 'next/link';
import { CheckCircle, AlertTriangle, Clock, XCircle, Loader2 } from 'lucide-react';
import { AttestationState, type CheckinAttestation } from '@/app/lib/types';
import { DEVNET_MODE } from '@/app/lib/constants';
import { useEffect, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import { toast } from 'sonner';
import { buildFinalizeCheckinIxs } from '@/app/lib/solana';
import { useSolanaTransaction } from '@/app/lib/use-solana-tx';

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
  participantPda?: string;
  submitterWallet?: string;   // actual wallet address of whoever checked in
  viewerAddress?: string;
  participantAddress?: string;
  onFinalized?: () => void;
}

export function AttestationCard({ attestation, streakId, participantPda, submitterWallet, viewerAddress, participantAddress, onFinalized }: Props) {
  const [now, setNow] = useState(Date.now() / 1000);
  const { sendTransaction, sending } = useSolanaTransaction();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 1_000);
    return () => clearInterval(t);
  }, []);

  async function handleFinalize() {
    if (!viewerAddress || !participantPda) return;
    try {
      const ixs = await buildFinalizeCheckinIxs(
        new PublicKey(viewerAddress),
        new PublicKey(attestation.pubkey),
        new PublicKey(participantPda),
        new PublicKey(streakId),
      );
      await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });
      toast.success('Check-in finalized! Streak count updated.');
      onFinalized?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Finalize failed');
    }
  }

  const style = STATE_STYLES[attestation.state];
  const secondsLeft = attestation.disputeWindowEnds - now;
  const windowExpired = secondsLeft <= 0;
  const canFinalize =
    attestation.state === AttestationState.Pending &&
    windowExpired &&
    !!viewerAddress;
  const canDispute =
    attestation.state === AttestationState.Pending &&
    !windowExpired &&
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

  const createdDate = new Date(attestation.createdAt * 1000);
  const timeStr = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = createdDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const photoHashHex = Buffer.from(attestation.photoHash).toString('hex').slice(0, 16);
  const explorerUrl = `https://explorer.solana.com/address/${attestation.pubkey}?cluster=devnet`;

  return (
    <div className="bg-black/20 border border-white/5 rounded-xl p-4 hover:bg-black/30 transition-colors">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <StateIcon
            size={15}
            className={
              attestation.state === AttestationState.Finalized ? 'text-green-400' :
              attestation.state === AttestationState.Disputed   ? 'text-blue-400'  :
              attestation.state === AttestationState.Overturned ? 'text-red-400'   : 'text-amber-400'
            }
          />
          <span className="text-sm font-bold text-white">Day {attestation.dayIndex + 1}</span>
          <span className="text-xs text-smoke-600">{dateStr} · {timeStr}</span>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase ${style.pill}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
          {style.label}
        </span>
      </div>

      {/* Detail rows */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-smoke-600 font-semibold">Wallet</span>
          <span className="font-mono text-xs text-smoke-400">
            {submitterWallet
              ? `${submitterWallet.slice(0, 6)}…${submitterWallet.slice(-6)}`
              : `${attestation.participant.slice(0, 6)}…${attestation.participant.slice(-6)}`}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-smoke-600 font-semibold">Photo Hash</span>
          <span className="font-mono text-xs text-smoke-400">{photoHashHex}…</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-smoke-600 font-semibold">Attestation PDA</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-grape-400 hover:text-lilac-400 transition-colors"
          >
            {attestation.pubkey.slice(0, 6)}…{attestation.pubkey.slice(-6)} ↗
          </a>
        </div>
        {attestation.state === AttestationState.Pending && secondsLeft > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-smoke-600 font-semibold">Dispute Window</span>
            <span className="font-mono text-xs text-amber-400">{formatCountdown(secondsLeft)} remaining</span>
          </div>
        )}
        {attestation.state === AttestationState.Disputed && attestation.disputer && (
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-widest text-smoke-600 font-semibold">Disputed By</span>
            <span className="font-mono text-xs text-blue-400">
              {attestation.disputer.slice(0, 6)}…{attestation.disputer.slice(-6)}
            </span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(canFinalize || canDispute || attestation.state === AttestationState.Disputed) && (
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          {canFinalize && (
            <button
              onClick={() => void handleFinalize()}
              disabled={sending}
              className="text-xs font-bold rounded-lg px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : null}
              Finalize Check-in
            </button>
          )}
          {(canDispute || attestation.state === AttestationState.Disputed) && (
            <Link
              href={`/streak/${streakId}/dispute/${attestation.pubkey}`}
              className={`text-xs font-bold rounded-lg px-3 py-1.5 transition-colors ${
                attestation.state === AttestationState.Disputed
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20'
              }`}
            >
              {attestation.state === AttestationState.Disputed ? 'View Dispute' : 'Dispute'}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
