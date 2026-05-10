'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { X402PaymentModal } from './X402PaymentModal';
import type { VerifyCheckinResponse } from '@/app/lib/types';
import type { HabitType } from '@/app/lib/types';

interface Props {
  streakPubkey: string;
  participantPubkey: string;
  dayIndex: number;
  habitType: HabitType;
  habitPrompt: string;
  onVerified: (result: VerifyCheckinResponse) => void;
}

export function PhotoVerifier({
  streakPubkey,
  participantPubkey,
  dayIndex,
  habitType,
  habitPrompt,
  onVerified,
}: Props) {
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'x402' | 'verifying' | 'done'>('idle');
  const [result, setResult] = useState<VerifyCheckinResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const x402Enabled = process.env.NEXT_PUBLIC_X402_ENABLED === 'true';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Image must be under 4MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = ev.target?.result as string;
      setImagePreview(data);
      setImageBase64(data.split(',')[1]);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }

  async function doVerify() {
    if (!imageBase64) return;
    setStatus('verifying');
    try {
      const res = await fetch('/api/verify-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_pubkey: participantPubkey,
          streak_pubkey: streakPubkey,
          day_index: dayIndex,
          habit_type: ['Code', 'Read', 'Write', 'Design', 'Gym'][habitType],
          habit_prompt: habitPrompt,
          photo_base64: imageBase64,
        }),
      });
      const data = (await res.json()) as VerifyCheckinResponse;
      setResult(data);
      setStatus('done');
      if (data.verdict) {
        onVerified(data);
        toast.success('Check-in approved!');
      } else {
        toast.error('Check-in rejected — ' + data.reason);
      }
    } catch {
      toast.error('Verification failed — please try again');
      setStatus('idle');
    }
  }

  function handleVerifyClick() {
    if (x402Enabled) {
      setStatus('x402');
    } else {
      void doVerify();
    }
  }

  return (
    <div className="space-y-5">
      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-grape-400/30 bg-black/30 rounded-2xl p-8 text-center cursor-pointer hover:border-orchid-500/50 hover:bg-orchid-500/10 transition-all group"
      >
        {imagePreview ? (
          <img
            src={imagePreview}
            alt="Check-in preview"
            className="mx-auto max-h-56 rounded-xl object-contain shadow-lg border border-white/10 group-hover:scale-[1.02] transition-transform"
          />
        ) : (
          <>
            <div className="flex justify-center gap-4 mb-4 text-smoke-600 group-hover:text-orchid-400 transition-colors">
              <Camera size={32} />
              <Upload size={32} />
            </div>
            <p className="text-base font-bold text-white mb-1">
              Tap to take a photo or upload
            </p>
            <p className="text-xs font-mono text-smoke-500 uppercase tracking-widest mt-2">JPEG or PNG, max 4MB</p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {imageBase64 && status === 'idle' && (
        <button
          onClick={handleVerifyClick}
          className="group relative overflow-hidden w-full bg-grape-500 text-white hover:scale-[1.02] rounded-xl py-3.5 text-base font-bold transition-all shadow-[0_0_20px_rgba(94,84,142,0.5)] mt-2"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
          <span className="relative">{x402Enabled ? 'Pay & Verify (0.001 USDC)' : 'Submit Attestation Proof'}</span>
        </button>
      )}

      {status === 'verifying' && (
        <div className="flex items-center justify-center gap-3 py-4 text-sm font-bold text-orchid-400 bg-orchid-500/10 border border-orchid-500/20 rounded-xl mt-2">
          <Loader2 size={18} className="animate-spin" />
          AI Oracle is analyzing your proof…
        </div>
      )}

      {status === 'done' && result && (
        <div
          className={`rounded-xl p-5 border mt-2 ${
            result.verdict
              ? 'bg-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(74,222,128,0.1)]'
              : 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(248,113,113,0.1)]'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.verdict ? (
              <CheckCircle size={20} className="text-green-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-base font-bold text-white mb-1">
                {result.verdict ? 'Proof Verified' : 'Proof Rejected'}
              </p>
              <p className="text-sm text-smoke-500 leading-relaxed">{result.reason}</p>
            </div>
          </div>
          {!result.verdict && (
            <button
              onClick={() => {
                setStatus('idle');
                setResult(null);
                setImageBase64(null);
                setImagePreview(null);
              }}
              className="mt-4 text-sm text-red-400 hover:text-red-300 font-bold tracking-wide transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {status === 'x402' && (
        <X402PaymentModal
          onConfirm={() => {
            setStatus('verifying');
            void doVerify();
          }}
          onCancel={() => setStatus('idle')}
        />
      )}
    </div>
  );
}
