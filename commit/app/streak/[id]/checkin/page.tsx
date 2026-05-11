'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useWallet } from '@/app/lib/wallet-context';
import { PublicKey } from '@solana/web3.js';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../../../components/Navbar';
import { PhotoVerifier } from '../../../components/PhotoVerifier';
import { GitHubVerifier } from '../../../components/GitHubVerifier';
import { HabitChip } from '../../../components/HabitTypeSelector';
import { useStreak, useParticipant } from '../../../lib/use-chain-data';
import { useSolanaTransaction } from '../../../lib/use-solana-tx';
import { buildSubmitCheckinIxs, findParticipantPda } from '../../../lib/solana';
import { HabitType } from '../../../lib/types';
import type { VerifyCheckinResponse } from '../../../lib/types';

type Method = 'photo' | 'github';

export default function CheckinPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { connected, publicKey, connect } = useWallet();
  const address = publicKey?.toBase58() ?? null;

  const [method, setMethod] = useState<Method>('photo');
  const [success, setSuccess] = useState(false);

  const { streak, loading } = useStreak(id ?? null);
  const { participant } = useParticipant(id ?? null, address);
  const { sendTransaction, sending } = useSolanaTransaction();

  const now = Date.now() / 1000;
  const dayIndex = streak && streak.startTimestamp <= now
    ? Math.floor((now - streak.startTimestamp) / 86400)
    : 0;

  const participantPubkey = (() => {
    if (!address || !id) return null;
    try {
      const [pda] = findParticipantPda(new PublicKey(id), new PublicKey(address));
      return pda.toBase58();
    } catch { return null; }
  })();

  async function handleVerified(result: VerifyCheckinResponse) {
    if (!result.verifier_signature || !participantPubkey || !id || !address) {
      toast.error('Missing data — please try again');
      return;
    }
    try {
      const ixs = await buildSubmitCheckinIxs({
        participantPubkey,
        userPubkey: address,
        streakPubkey: id,
        dayIndex,
        verifierSignature: Buffer.from(result.verifier_signature, 'hex'),
        attestationMessage: buildAttestationMessage(result, address, id, dayIndex),
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
            <h1 className="text-3xl font-bold text-white mb-4">Connect wallet to check in</h1>
            <button onClick={() => void connect()} className="group relative overflow-hidden w-full bg-grape-500 text-white rounded-xl px-6 py-4 text-base font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(94,84,142,0.5)]">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
              <span className="relative">Connect Wallet</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="relative min-h-screen bg-[#07050d] text-white overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[30%] left-[50%] w-[50vw] h-[50vw] -translate-x-1/2 rounded-full bg-green-900/20 blur-[150px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
        </div>
        <Navbar />
        <div className="relative z-10 flex flex-col items-center justify-center pt-40 px-6 text-center">
          <div className="bg-white/5 backdrop-blur-xl border border-green-400/20 rounded-3xl p-10 max-w-md shadow-2xl">
            <CheckCircle size={64} className="text-green-400 mb-6 drop-shadow-[0_0_15px_rgba(74,222,128,0.5)] mx-auto" />
            <h1 className="text-3xl font-bold text-white mb-3">Check-in recorded!</h1>
            <p className="text-sm text-smoke-500 font-mono">Redirecting to protocol dashboard…</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !streak) {
    return (
      <div className="relative min-h-screen bg-[#07050d] text-white overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[20%] left-[50%] w-[40vw] h-[40vw] -translate-x-1/2 rounded-full bg-grape-600/20 blur-[150px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
        </div>
        <Navbar />
        <div className="relative z-10 flex items-center justify-center pt-32">
          <Loader2 size={32} className="animate-spin text-orchid-500 drop-shadow-[0_0_15px_rgba(202,121,165,0.8)]" />
        </div>
      </div>
    );
  }

  if (!participant?.isActive) {
    return (
      <div className="relative min-h-screen bg-[#07050d] text-white overflow-hidden">
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-[30%] left-[50%] w-[50vw] h-[50vw] -translate-x-1/2 rounded-full bg-grape-600/10 blur-[150px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
        </div>
        <Navbar />
        <div className="relative z-10 flex flex-col items-center justify-center pt-40 px-6 text-center">
          <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-10 max-w-md shadow-2xl">
            <p className="text-lg text-smoke-500 mb-6">You are not an active participant in this streak.</p>
            <a href={`/streak/${id}`} className="text-orchid-400 hover:text-orchid-300 text-base font-bold transition-colors">View streak</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#07050d] text-white selection:bg-grape-500/30 overflow-hidden pb-20">
      {/* Immersive Glowing Background */}
      <div className="absolute inset-0 z-0 pointer-events-none fixed">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-orchid-900/10 blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-grape-600/10 blur-[150px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 mix-blend-overlay"></div>
      </div>

      <Navbar />
      <div className="relative z-10 mx-auto max-w-xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white/5 backdrop-blur-xl border border-grape-400/20 rounded-3xl p-8 sm:p-10 shadow-2xl">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <HabitChip habitType={streak.habitType} />
              <span className="flex size-2.5 animate-pulse rounded-full bg-green-400 shadow-[0_0_10px_#4ade80]"></span>
            </div>
            <h1 className="text-3xl font-black text-white bg-gradient-to-r from-white to-smoke-600 bg-clip-text text-transparent mb-2">{streak.name}</h1>
            <p className="text-sm font-bold text-orchid-400 uppercase tracking-widest drop-shadow-[0_0_10px_rgba(202,121,165,0.4)]">Protocol Day {dayIndex + 1} of {streak.durationDays}</p>
          </div>

          {streak.habitType === HabitType.Code && (
            <div className="flex gap-2 mb-8 bg-black/30 rounded-xl p-1.5 border border-white/5">
              {(['photo', 'github'] as Method[]).map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-bold capitalize transition-all ${method === m ? 'bg-grape-500 text-white shadow-[0_0_15px_rgba(94,84,142,0.5)]' : 'text-smoke-600 hover:text-white hover:bg-white/5'}`}>
                  {m === 'github' ? 'GitHub Attestation' : 'Photo Attestation'}
                </button>
              ))}
            </div>
          )}

          <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-6 shadow-inner">
            {method === 'github' && streak.habitType === HabitType.Code ? (
              <GitHubVerifier
                streakPubkey={id}
                participantPubkey={address ?? ''}
                dayIndex={dayIndex}
                onVerified={(r) => void handleVerified(r)}
              />
            ) : (
              <PhotoVerifier
                streakPubkey={id}
                participantPubkey={address ?? ''}
                dayIndex={dayIndex}
                habitType={streak.habitType}
                habitPrompt={streak.habitPrompt}
                onVerified={(r) => void handleVerified(r)}
              />
            )}
          </div>

          {sending && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm font-bold text-orchid-400 p-4 bg-orchid-500/10 border border-orchid-500/20 rounded-xl">
              <Loader2 size={18} className="animate-spin" />
              Writing Attestation to Solana Network…
            </div>
          )}

          <p className="text-xs font-medium text-smoke-600 text-center mt-6">
            Approved check-ins enter a 24h dispute window before protocol finalization.
          </p>
        </div>
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
