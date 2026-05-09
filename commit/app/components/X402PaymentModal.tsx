'use client';

import { Loader2 } from 'lucide-react';
import { useState } from 'react';

interface Props {
  onConfirm: () => void;
  onCancel: () => void;
}

export function X402PaymentModal({ onConfirm, onCancel }: Props) {
  const [paying, setPaying] = useState(false);

  function handlePay() {
    setPaying(true);
    // The actual payment + retry happens in the caller (PhotoVerifier)
    // This modal just confirms the intent
    setTimeout(() => {
      onConfirm();
    }, 100);
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-2xl p-6 max-w-sm w-full">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-smoke-600 uppercase tracking-wide mb-4">
          Verification Fee
        </h3>

        <p className="font-mono text-3xl font-medium text-grape-500 mb-1">0.001 USDC</p>
        <p className="text-sm text-zinc-500 dark:text-smoke-600 mb-6">
          This covers the AI verification cost for your check-in.
        </p>

        <div className="flex gap-3">
          <button
            onClick={handlePay}
            disabled={paying}
            className="flex-1 flex items-center justify-center gap-2 bg-grape-500 text-white hover:bg-grape-600 disabled:opacity-70 rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            {paying ? <Loader2 size={14} className="animate-spin" /> : null}
            Pay &amp; Verify
          </button>
          <button
            onClick={onCancel}
            disabled={paying}
            className="flex-1 border border-zinc-300 dark:border-grape-400 text-zinc-700 dark:text-smoke-700 hover:bg-zinc-50 dark:hover:bg-grape-300 rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
