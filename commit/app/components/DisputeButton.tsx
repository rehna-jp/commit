'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { formatUsdc } from '@/app/lib/constants';

interface Props {
  streakId: string;
  attestationId: string;
  bondAmount: number; // USDC base units
  onDispute: () => Promise<void>;
}

export function DisputeButton({ bondAmount, onDispute }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onDispute();
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-1.5 border border-zinc-300 dark:border-grape-400 text-zinc-600 dark:text-smoke-600 hover:border-red-400 hover:text-red-600 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
      >
        <AlertTriangle size={14} />
        File Dispute
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-amber-500" />
              <h3 className="text-sm font-medium text-zinc-900 dark:text-white">File a Dispute</h3>
            </div>

            <p className="text-sm text-zinc-600 dark:text-smoke-600 mb-4">
              You will lock{' '}
              <span className="font-mono font-medium text-grape-500">
                {formatUsdc(bondAmount)} USDC
              </span>{' '}
              as a dispute bond.
            </p>

            <div className="bg-zinc-50 dark:bg-grape-300 rounded-xl p-3 mb-4 space-y-1.5 text-xs text-zinc-500 dark:text-smoke-600">
              <p>✓ If your dispute succeeds, you get your bond back plus a 30% bounty.</p>
              <p>✗ If your dispute fails, you lose the bond.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => void handleConfirm()}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-grape-500 text-white hover:bg-grape-600 disabled:opacity-70 rounded-lg py-2.5 text-sm font-medium"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Confirm Dispute
              </button>
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="flex-1 border border-zinc-300 dark:border-grape-400 text-zinc-700 dark:text-smoke-700 hover:bg-zinc-50 rounded-lg py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
