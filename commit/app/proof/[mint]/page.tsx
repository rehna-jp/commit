'use client';

import { useParams } from 'next/navigation';
import { Loader2, ExternalLink } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { SoulboundNftCard } from '../../components/SoulboundNftCard';
import { useStreakProof, useStreak } from '../../lib/use-chain-data';

export default function ProofPage() {
  const { mint } = useParams<{ mint: string }>();
  const { proof, loading, error } = useStreakProof(mint ?? null);
  const { streak } = useStreak(proof?.streak ?? null);

  if (loading) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 size={24} className="animate-spin text-smoke-500" />
        </div>
      </div>
    );
  }

  if (error || !proof) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32 px-6 text-center">
          <p className="text-smoke-500 mb-2">{error ?? 'Proof not found'}</p>
          <p className="text-xs text-smoke-600 font-mono break-all max-w-xs">{mint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amethyst-500">
      <Navbar />
      <div className="mx-auto max-w-lg px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-medium text-white mb-1">Completion Proof</h1>
          <p className="text-sm text-smoke-500">Soulbound Token-2022 NFT</p>
        </div>

        <SoulboundNftCard proof={proof} habitType={streak?.habitType} />

        {/* Attestation history */}
        <div className="mt-5 bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-3">
            Attestation History ({proof.attestationHashes.length} days)
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-1.5">
            {proof.attestationHashes.map((hash, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 dark:text-smoke-600 w-10 shrink-0">Day {i + 1}</span>
                <span className="font-mono text-xs text-zinc-500 dark:text-smoke-600 truncate">
                  {Buffer.from(hash).toString('hex').slice(0, 28)}…
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Links */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-smoke-600">NFT Mint</p>
            <a
              href={`https://explorer.solana.com/address/${mint}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-grape-500 hover:text-grape-600"
            >
              View on Explorer <ExternalLink size={10} />
            </a>
          </div>
          <p className="font-mono text-xs text-smoke-600 break-all">{mint}</p>
        </div>
      </div>
    </div>
  );
}
