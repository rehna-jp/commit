'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { PublicKey } from '@solana/web3.js';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../../../components/Navbar';
import { PhotoVerifier } from '../../../components/PhotoVerifier';
import { GitHubVerifier } from '../../../components/GitHubVerifier';
import { HabitChip } from '../../../components/HabitTypeSelector';
import { findSolanaWallet } from '../../../lib/privy-utils';
import { useStreak, useParticipant } from '../../../lib/use-chain-data';
import { useSolanaTransaction } from '../../../lib/use-solana-tx';
import { buildSubmitCheckinIxs, findParticipantPda } from '../../../lib/solana';
import { HabitType } from '../../../lib/types';
import type { VerifyCheckinResponse } from '../../../lib/types';

type Method = 'photo' | 'github';

export default function CheckinPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const solanaWallet = findSolanaWallet(wallets);

  const [method, setMethod] = useState<Method>('photo');
  const [success, setSuccess] = useState(false);

  const { streak, loading } = useStreak(id ?? null);
  const { participant } = useParticipant(id ?? null, solanaWallet?.address ?? null);
  const { sendTransaction, sending } = useSolanaTransaction();

  const now = Date.now() / 1000;
  const dayIndex = streak && streak.startTimestamp <= now
    ? Math.floor((now - streak.startTimestamp) / 86400)
    : 0;

  const participantPubkey = (() => {
    if (!solanaWallet?.address || !id) return null;
    try {
      const [pda] = findParticipantPda(new PublicKey(id), new PublicKey(solanaWallet.address));
      return pda.toBase58();
    } catch { return null; }
  })();

  async function handleVerified(result: VerifyCheckinResponse) {
    if (!result.verifier_signature || !participantPubkey || !id) {
      toast.error('Missing data — please try again');
      return;
    }
    try {
      const ixs = await buildSubmitCheckinIxs({
        participantPubkey,
        streakPubkey: id,
        dayIndex,
        verifierSignature: Buffer.from(result.verifier_signature, 'hex'),
        attestationMessage: buildAttestationMessage(result, participantPubkey, id, dayIndex),
        photoHash: Buffer.from(result.photo_hash, 'hex'),
        phash: BigInt('0x' + result.phash),
        verdictTrue: true,
        reasonHash: Buffer.from(result.reason_hash, 'hex'),
      });
      await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });
      setSuccess(true);
      toast.success('Check-in recorded on-chain!');
      setTimeout(() => router.push(`/streak/${id}`), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record check-in');
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32 px-6 text-center">
          <h1 className="text-xl font-medium text-white mb-4">Connect wallet to check in</h1>
          <button onClick={() => login()} className="bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-6 py-3 text-sm font-medium">
            Connect
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32 px-6 text-center">
          <CheckCircle size={48} className="text-green-400 mb-4" />
          <h1 className="text-xl font-medium text-white mb-2">Check-in recorded!</h1>
          <p className="text-sm text-smoke-500">Redirecting…</p>
        </div>
      </div>
    );
  }

  if (loading || !streak) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 size={24} className="animate-spin text-smoke-500" />
        </div>
      </div>
    );
  }

  if (!participant?.isActive) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32 px-6 text-center">
          <p className="text-smoke-500 mb-4">You are not an active participant in this streak.</p>
          <a href={`/streak/${id}`} className="text-grape-500 text-sm font-medium">View streak</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amethyst-500">
      <Navbar />
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-1">
            <HabitChip habitType={streak.habitType} />
          </div>
          <h1 className="text-xl font-medium text-white">{streak.name}</h1>
          <p className="text-sm text-smoke-500 mt-1">Day {dayIndex + 1} of {streak.durationDays}</p>
        </div>

        {streak.habitType === HabitType.Code && (
          <div className="flex gap-1 mb-5 bg-grape-300 rounded-lg p-1">
            {(['photo', 'github'] as Method[]).map((m) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition-colors ${method === m ? 'bg-white dark:bg-grape-400 text-zinc-900 dark:text-white' : 'text-smoke-600'}`}>
                {m === 'github' ? 'GitHub' : 'Photo'}
              </button>
            ))}
          </div>
        )}

        <div className="bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-xl p-4 sm:p-5">
          {method === 'github' && streak.habitType === HabitType.Code ? (
            <GitHubVerifier
              streakPubkey={id}
              participantPubkey={participantPubkey ?? ''}
              dayIndex={dayIndex}
              onVerified={(r) => void handleVerified(r)}
            />
          ) : (
            <PhotoVerifier
              streakPubkey={id}
              participantPubkey={participantPubkey ?? ''}
              dayIndex={dayIndex}
              habitType={streak.habitType}
              habitPrompt={streak.habitPrompt}
              onVerified={(r) => void handleVerified(r)}
            />
          )}
        </div>

        {sending && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-smoke-500">
            <Loader2 size={16} className="animate-spin" />
            Recording on-chain…
          </div>
        )}

        <p className="text-xs text-smoke-600 text-center mt-4">
          Approved check-ins enter a 24h dispute window before finalization.
        </p>
      </div>
    </div>
  );
}

function buildAttestationMessage(
  result: VerifyCheckinResponse,
  participantPubkey: string,
  streakPubkey: string,
  dayIndex: number
): Uint8Array {
  const msg = new Uint8Array(171);
  const view = new DataView(msg.buffer);
  let offset = 0;
  msg.set(new PublicKey(result.verifier_pubkey).toBytes(), offset); offset += 32;
  msg.set(new PublicKey(participantPubkey).toBytes(), offset); offset += 32;
  msg.set(new PublicKey(streakPubkey).toBytes(), offset); offset += 32;
  view.setUint16(offset, dayIndex, true); offset += 2;
  msg.set(Buffer.from(result.photo_hash, 'hex').slice(0, 32), offset); offset += 32;
  view.setBigUint64(offset, BigInt('0x' + result.phash), true); offset += 8;
  msg[offset] = 0x01; offset += 1;
  msg.set(Buffer.from(result.reason_hash, 'hex').slice(0, 32), offset);
  return msg;
}
