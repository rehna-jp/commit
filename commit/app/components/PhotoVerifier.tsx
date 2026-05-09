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
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-zinc-200 dark:border-grape-400 rounded-xl p-6 text-center cursor-pointer hover:border-grape-500 transition-colors"
      >
        {imagePreview ? (
          <img
            src={imagePreview}
            alt="Check-in preview"
            className="mx-auto max-h-48 rounded-lg object-contain"
          />
        ) : (
          <>
            <div className="flex justify-center gap-3 mb-2 text-zinc-400">
              <Camera size={24} />
              <Upload size={24} />
            </div>
            <p className="text-sm text-zinc-500 dark:text-smoke-600">
              Tap to take a photo or upload
            </p>
            <p className="text-xs text-zinc-400 dark:text-smoke-500 mt-1">JPEG or PNG, max 4MB</p>
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
          className="w-full bg-grape-500 text-white hover:bg-grape-600 rounded-lg py-2.5 text-sm font-medium transition-colors"
        >
          {x402Enabled ? 'Pay & Verify (0.001 USDC)' : 'Verify Check-In'}
        </button>
      )}

      {status === 'verifying' && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-zinc-500 dark:text-smoke-600">
          <Loader2 size={16} className="animate-spin" />
          AI is reviewing your check-in…
        </div>
      )}

      {status === 'done' && result && (
        <div
          className={`rounded-xl p-4 border ${
            result.verdict
              ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
              : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {result.verdict ? (
              <CheckCircle size={18} className="text-green-500 shrink-0 mt-0.5" />
            ) : (
              <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">
                {result.verdict ? 'Approved' : 'Rejected'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-smoke-600 mt-0.5">{result.reason}</p>
            </div>
          </div>
          {!result.verdict && (
            <button
              onClick={() => {
                setStatus('idle');
                setResult(null);
              }}
              className="mt-3 text-sm text-grape-500 hover:text-grape-600 font-medium"
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
