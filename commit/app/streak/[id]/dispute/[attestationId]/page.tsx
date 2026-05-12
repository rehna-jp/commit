'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useWallet } from '@/app/lib/wallet-context';
import { PublicKey } from '@solana/web3.js';
import { AlertTriangle, Clock, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Navbar } from '../../../../components/Navbar';
import { DisputeButton } from '../../../../components/DisputeButton';
import { useAttestation, useStreak, useParticipant } from '../../../../lib/use-chain-data';
import { useSolanaTransaction } from '../../../../lib/use-solana-tx';
import { buildDisputeCheckinIxs, buildResolveDisputeIxs, buildFinalizeCheckinIxs } from '../../../../lib/solana';
import { AttestationState, HabitType } from '../../../../lib/types';
import { formatUsdc, DISPUTE_BOND_BPS, DEVNET_MODE } from '../../../../lib/constants';
import type { VerifyCheckinResponse } from '../../../../lib/types';

const STATE_LABELS: Record<AttestationState, string> = {
  [AttestationState.Pending]: 'Awaiting dispute window',
  [AttestationState.Disputed]: 'Under dispute',
  [AttestationState.Finalized]: 'Accepted',
  [AttestationState.Overturned]: 'Rejected — participant slashed',
};

function formatCountdown(s: number): string {
  if (s <= 0) return 'Expired';
  if (DEVNET_MODE) {
    if (s < 60) return `${Math.ceil(s)}s remaining`;
    const m = Math.floor(s / 60), sec = Math.ceil(s % 60);
    return `${m}m ${sec}s remaining`;
  }
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m remaining`;
}

export default function DisputePage() {
  const { id, attestationId } = useParams<{ id: string; attestationId: string }>();
  const { connected, publicKey, connect } = useWallet();
  const address = publicKey?.toBase58() ?? null;

  const [now, setNow] = useState(Date.now() / 1000);
  const router = useRouter();
  const [counterResult, setCounterResult] = useState<VerifyCheckinResponse | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<{ verdict: boolean } | null>(null);
  const [disputePhoto, setDisputePhoto] = useState<string | null>(null);
  const [disputeMethod, setDisputeMethod] = useState<'photo' | 'github'>('photo');
  const [githubUsername, setGithubUsername] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), DEVNET_MODE ? 1_000 : 10_000);
    return () => clearInterval(t);
  }, []);

  const { attestation, loading: attLoading } = useAttestation(attestationId ?? null);
  const { streak } = useStreak(id ?? null);
  const { participant: userParticipant } = useParticipant(id ?? null, address);
  const { sendTransaction, sending } = useSolanaTransaction();

  const secondsLeft = attestation ? attestation.disputeWindowEnds - now : 0;
  const bondAmount = streak ? Math.floor((streak.stakeAmount * DISPUTE_BOND_BPS) / 10_000) : 0;

  const canDispute = attestation?.state === AttestationState.Pending &&
    secondsLeft > 0 && !!userParticipant &&
    userParticipant.pubkey !== attestation.participant;

  const canFinalize = attestation?.state === AttestationState.Pending && secondsLeft <= 0;

  async function handleFinalize() {
    if (!address || !id || !attestation) return;
    try {
      const caller = new PublicKey(address!);
      const streakPk = new PublicKey(id);
      const participantPk = new PublicKey(attestation.participant);
      const attestationPk = new PublicKey(attestation.pubkey);
      const ixs = await buildFinalizeCheckinIxs(caller, attestationPk, participantPk, streakPk);
      await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });
      toast.success('Check-in finalized — accepted on-chain.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Finalization failed');
    }
  }

  async function handleDispute() {
    if (!address || !id || !attestation) return;
    try {
      const disputer = new PublicKey(address!);
      const streak_ = new PublicKey(id);
      const targetParticipant = new PublicKey(attestation.participant);
      const attestationPk = new PublicKey(attestation.pubkey);
      const ixs = await buildDisputeCheckinIxs(disputer, streak_, targetParticipant, attestationPk);
      await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });
      toast.success('Dispute filed! Bond locked.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dispute failed');
    }
  }

  async function handleResolve() {
    if (!address || !id || !attestation || !streak) return;

    // Validate inputs before calling APIs
    if (disputeMethod === 'github' && !githubUsername.trim()) {
      toast.error('Enter the GitHub username used for the original check-in');
      return;
    }
    if (disputeMethod === 'photo' && !disputePhoto) {
      toast.error('Upload the original check-in photo first');
      return;
    }

    setResolving(true);
    try {
      let data: VerifyCheckinResponse;

      if (disputeMethod === 'github') {
        // GitHub check-in: re-run verify-github with the same username.
        // The event ID is deterministic so it reproduces the same photo_hash.
        const res = await fetch('/api/verify-github', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participant_pubkey: attestation.participant,
            streak_pubkey: id,
            day_index: attestation.dayIndex,
            github_username: githubUsername.trim(),
          }),
        });
        data = (await res.json()) as VerifyCheckinResponse;
      } else {
        // Photo check-in: use the stricter counter prompt
        const habitLabels = ['Code', 'Read', 'Write', 'Design', 'Gym'];
        const res = await fetch('/api/verify-counter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participant_pubkey: attestation.participant,
            streak_pubkey: id,
            day_index: attestation.dayIndex,
            habit_type: habitLabels[streak.habitType],
            habit_prompt: streak.habitPrompt,
            photo_base64: disputePhoto,
          }),
        });
        data = (await res.json()) as VerifyCheckinResponse;
      }

      if (!data.verifier_signature) {
        setCounterResult(data);
        toast.error(
          disputeMethod === 'github'
            ? 'No qualifying GitHub activity found — check the username is correct and you have recent commits.'
            : 'Could not verify the photo — make sure it is the exact original image.'
        );
        return;
      }

      setCounterResult(data);

      // Build and submit the resolve_dispute transaction
      const counterMsg = buildCounterAttestationMessage(data, attestation.participant, id, attestation.dayIndex);
      const resolver = new PublicKey(address!);
      const disputer = attestation.disputer ? new PublicKey(attestation.disputer) : resolver;

      const ixs = await buildResolveDisputeIxs({
        streakPubkey: id,
        targetParticipantPubkey: attestation.participant,
        attestationPubkey: attestation.pubkey,
        disputerPubkey: disputer.toBase58(),
        resolverPubkey: resolver.toBase58(),
        counterVerdict: data.verdict,
        counterReasonHash: Buffer.from(data.reason_hash, 'hex'),
        counterSignature: Buffer.from(data.verifier_signature, 'hex'),
        counterAttestationMessage: counterMsg,
      });
      await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });

      // Show outcome screen instead of staying on the same page
      setResolved({ verdict: data.verdict });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Resolution failed — please try again');
    } finally {
      setResolving(false);
    }
  }

  if (attLoading) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex items-center justify-center pt-32">
          <Loader2 size={24} className="animate-spin text-smoke-500" />
        </div>
      </div>
    );
  }

  if (!attestation) {
    return (
      <div className="min-h-screen bg-amethyst-500">
        <Navbar />
        <div className="flex flex-col items-center justify-center pt-32 px-6 text-center">
          <p className="text-smoke-500">Attestation not found.</p>
        </div>
      </div>
    );
  }

  // Outcome screen shown after dispute is resolved on-chain
  if (resolved) {
    return (
      <div className="min-h-screen bg-[#07050d] text-white flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className={`max-w-md w-full rounded-3xl border p-10 text-center shadow-2xl ${
            resolved.verdict
              ? 'bg-green-400/5 border-green-400/20'
              : 'bg-red-400/5 border-red-400/20'
          }`}>
            {resolved.verdict ? (
              <CheckCircle size={56} className="text-green-400 mx-auto mb-6" />
            ) : (
              <XCircle size={56} className="text-red-400 mx-auto mb-6" />
            )}

            <h2 className="text-2xl font-medium text-white mb-3">
              {resolved.verdict ? 'Check-in confirmed' : 'Check-in rejected'}
            </h2>

            <p className="text-sm text-smoke-500 mb-6 leading-relaxed">
              {resolved.verdict
                ? 'The AI re-reviewed the proof and confirmed it was valid. The dispute failed — the disputer loses their bond, which goes to you.'
                : 'The AI re-reviewed the proof and could not confirm it. Your stake has been slashed and the disputer receives their bond back plus a bounty.'}
            </p>

            <button
              onClick={() => router.push(`/streak/${id}`)}
              className="bg-grape-500 text-white hover:bg-grape-600 rounded-xl px-6 py-3 text-sm font-medium transition-colors"
            >
              Back to Streak
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amethyst-500">
      <Navbar />
      <div className="mx-auto max-w-xl px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle size={20} className="text-amber-400 shrink-0" />
          <h1 className="text-xl font-medium text-white">Attestation Dispute</h1>
        </div>

        {/* Info card */}
        <div className="bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-xl p-4 sm:p-5 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-xs text-zinc-500 dark:text-smoke-600 mb-0.5">Day</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Day {attestation.dayIndex + 1}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 dark:text-smoke-600 mb-0.5">State</p>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">{STATE_LABELS[attestation.state]}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-zinc-500 dark:text-smoke-600 mb-0.5">Participant</p>
              <p className="font-mono text-xs text-zinc-500 dark:text-smoke-600 truncate">{attestation.participant}</p>
            </div>
          </div>

          {attestation.state === AttestationState.Pending && (
            <div className={`flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 ${secondsLeft > 0 ? 'text-amber-700 bg-amber-50' : 'text-zinc-500 bg-zinc-50'}`}>
              <Clock size={14} className="shrink-0" />
              {formatCountdown(secondsLeft)}
            </div>
          )}
          {attestation.state === AttestationState.Disputed && attestation.disputer && (
            <div className="flex items-center gap-1.5 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
              <AlertTriangle size={14} />
              Disputed by {attestation.disputer.slice(0, 6)}…{attestation.disputer.slice(-4)}
            </div>
          )}
          {attestation.state === AttestationState.Finalized && (
            <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <CheckCircle size={14} /> Check-in accepted — no dispute was raised in time
            </div>
          )}
          {attestation.state === AttestationState.Overturned && (
            <div className="flex items-center gap-1.5 text-sm text-zinc-600 bg-zinc-100 rounded-lg px-3 py-2">
              <XCircle size={14} /> Check-in rejected — the dispute succeeded and the participant was slashed
            </div>
          )}
        </div>

        {!connected ? (
          <div className="text-center py-6">
            <p className="text-sm text-smoke-500 mb-4">Connect to participate in disputes</p>
            <button onClick={() => void connect()} className="bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-6 py-2.5 text-sm font-medium">
              Connect
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {canDispute && (
              <div>
                <p className="text-xs text-zinc-500 dark:text-smoke-600 mb-3">
                  You&apos;ll stake <span className="font-mono text-grape-500">{formatUsdc(bondAmount)} USDC</span> as a bond.
                  If the AI agrees the check-in was invalid, you get your bond back plus a 30% reward from the slash.
                  If the check-in was valid, you lose your bond.
                </p>
                <DisputeButton
                  streakId={id}
                  attestationId={attestationId}
                  bondAmount={bondAmount}
                  onDispute={handleDispute}
                />
              </div>
            )}

            {canFinalize && (
              <div>
                <p className="text-sm text-zinc-500 dark:text-smoke-600 mb-3">
                  Nobody challenged this check-in in time. Click below to officially confirm it on-chain.
                </p>
                <button
                  onClick={() => void handleFinalize()}
                  disabled={sending}
                  className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700 disabled:opacity-70 rounded-lg px-5 py-2.5 text-sm font-medium w-full sm:w-auto justify-center"
                >
                  {sending && <Loader2 size={14} className="animate-spin" />}
                  Finalize Check-in
                </button>
              </div>
            )}

            {attestation.state === AttestationState.Disputed && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500 dark:text-smoke-600">
                  Someone has challenged this check-in. To settle it, re-submit the original proof — the AI will take a second, stricter look. If it passes, the dispute fails and you keep your stake. If it fails, you get slashed.
                </p>

                {/* Method selector — only for Code habit which supports both */}
                {streak?.habitType === HabitType.Code && (
                  <div className="flex gap-2 bg-black/20 rounded-lg p-1 border border-white/5">
                    {(['github', 'photo'] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setDisputeMethod(m)}
                        className={`flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-all ${
                          disputeMethod === m
                            ? 'bg-grape-500 text-white'
                            : 'text-zinc-500 dark:text-smoke-600 hover:text-white'
                        }`}
                      >
                        {m === 'github' ? 'GitHub' : 'Photo'}
                      </button>
                    ))}
                  </div>
                )}

                {/* GitHub input */}
                {disputeMethod === 'github' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-smoke-600 mb-1.5">
                      GitHub username used for original check-in
                    </label>
                    <input
                      type="text"
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                      placeholder="e.g. rehna-p"
                      className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-smoke-600 focus:outline-none focus:border-grape-400/40"
                    />
                    <p className="text-[11px] text-zinc-500 dark:text-smoke-600 mt-1">
                      The same GitHub activity must still be visible in your public events feed.
                    </p>
                  </div>
                )}

                {/* Photo upload */}
                {disputeMethod === 'photo' && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 dark:text-smoke-600 mb-1.5">
                      Original check-in photo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const result = ev.target?.result as string;
                          setDisputePhoto(result.split(',')[1] ?? null);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="block w-full text-xs text-zinc-500 dark:text-smoke-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-grape-500/10 file:text-grape-400 hover:file:bg-grape-500/20 cursor-pointer"
                    />
                    {disputePhoto && (
                      <p className="text-[11px] text-green-600 dark:text-green-400 mt-1">Photo loaded — ready to submit.</p>
                    )}
                    <p className="text-[11px] text-zinc-500 dark:text-smoke-600 mt-1">
                      Must be the exact original photo — a different image will fail the on-chain hash check.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => void handleResolve()}
                  disabled={resolving || sending || (disputeMethod === 'photo' && !disputePhoto) || (disputeMethod === 'github' && !githubUsername.trim())}
                  className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 rounded-lg px-5 py-2.5 text-sm font-medium w-full sm:w-auto justify-center"
                >
                  {(resolving || sending) && <Loader2 size={14} className="animate-spin" />}
                  Run Counter-Review &amp; Resolve
                </button>
                {counterResult && !counterResult.verifier_signature && (
                  <div className="mt-3 rounded-xl p-3 text-sm bg-red-50 text-red-700">
                    <p className="font-medium">Proof not accepted</p>
                    <p className="text-xs mt-0.5 opacity-80">{counterResult.reason ?? 'Could not verify the submitted proof.'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function buildCounterAttestationMessage(
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
  msg[offset] = result.verdict ? 0x01 : 0x00; offset += 1;
  msg.set(Buffer.from(result.reason_hash, 'hex').slice(0, 32), offset);
  return msg;
}
