'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@/app/lib/wallet-context';
import { PublicKey } from '@solana/web3.js';
import { Loader2, Coins, Globe, ArrowRight, Wallet, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatUsdc } from '@/app/lib/constants';
import { buildJoinStreakIxs } from '@/app/lib/solana';
import { useSolanaTransaction } from '@/app/lib/use-solana-tx';
import {
  EVM_CHAINS,
  connectEvmWallet,
  getEvmChainId,
  getStakeRoutes,
  executeStakeRoute,
  formatRouteTime,
  formatRouteFee,
} from '@/app/lib/lifi';
import type { Route } from '@lifi/sdk';
import type { Streak } from '@/app/lib/types';

interface Props {
  streak: Streak;
  userAddress?: string;
  onJoined: () => void;
}

type Tab = 'solana' | 'cross-chain';

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function StakeWidget({ streak, userAddress, onJoined }: Props) {
  const { publicKey } = useWallet();
  const { sendTransaction, sending } = useSolanaTransaction();

  // Cross-chain state
  const [tab, setTab] = useState<Tab>('solana');
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [fromChain, setFromChain] = useState(EVM_CHAINS[0].id); // Base
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [bridgeDone, setBridgeDone] = useState(false);

  // ─── Solana join ─────────────────────────────────────────────────────────────

  async function handleSolanaJoin() {
    if (!publicKey) { toast.error('Connect your Solana wallet first'); return; }
    try {
      const ixs = await buildJoinStreakIxs(publicKey, new PublicKey(streak.pubkey));
      await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });
      toast.success('Joined! Stake locked in escrow.');
      onJoined();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join streak');
    }
  }

  // ─── EVM wallet ──────────────────────────────────────────────────────────────

  const handleConnectMetaMask = useCallback(async () => {
    try {
      const addr = await connectEvmWallet();
      setEvmAddress(addr);
      const chainId = await getEvmChainId();
      const supported = EVM_CHAINS.find((c) => c.id === chainId);
      if (supported) setFromChain(supported.id);
      toast.success(`MetaMask connected: ${truncate(addr)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'MetaMask connection failed');
    }
  }, []);

  // ─── LI.FI route fetching ─────────────────────────────────────────────────────

  async function handleGetRoutes() {
    if (!evmAddress) { toast.error('Connect MetaMask first'); return; }
    if (!userAddress) { toast.error('Connect your Solana wallet first'); return; }

    setLoadingRoutes(true);
    setRoutes([]);
    setSelectedRoute(null);

    try {
      const result = await getStakeRoutes({
        fromChainId: fromChain,
        fromAddress: evmAddress,
        toAddress: userAddress,
        stakeAmountUsdc: streak.stakeAmount,
      });

      if (result.length === 0) {
        toast.error('No bridge routes found for this chain/amount');
        return;
      }

      setRoutes(result);
      setSelectedRoute(result[0]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch routes');
    } finally {
      setLoadingRoutes(false);
    }
  }

  // ─── LI.FI route execution ────────────────────────────────────────────────────

  async function handleBridgeAndJoin() {
    if (!selectedRoute) return;
    setExecuting(true);

    try {
      await executeStakeRoute(selectedRoute, (updated) => {
        setSelectedRoute(updated);
      });
      setBridgeDone(true);
      toast.success('Bridge complete! USDC arriving in your Solana wallet…');
      setTimeout(() => onJoined(), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bridge failed — please try again');
    } finally {
      setExecuting(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-6 shadow-inner relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-grape-500/5 to-transparent pointer-events-none" />

      <h3 className="text-sm font-bold text-smoke-500 uppercase tracking-widest mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-orchid-400 animate-pulse" />
        Stake to Join
      </h3>

      <div className="flex items-end gap-2 mb-6">
        <span className="font-mono text-4xl font-black text-white">{formatUsdc(streak.stakeAmount)}</span>
        <span className="text-sm font-bold text-grape-400 uppercase tracking-widest mb-1">USDC</span>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 mb-6 bg-black/30 border border-white/5 rounded-xl p-1.5">
        <button
          onClick={() => setTab('solana')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
            tab === 'solana'
              ? 'bg-grape-500 text-white shadow-[0_0_15px_rgba(94,84,142,0.5)]'
              : 'text-smoke-600 hover:text-white hover:bg-white/5'
          }`}
        >
          <Coins size={14} />
          Solana
        </button>
        <button
          onClick={() => setTab('cross-chain')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all ${
            tab === 'cross-chain'
              ? 'bg-grape-500 text-white shadow-[0_0_15px_rgba(94,84,142,0.5)]'
              : 'text-smoke-600 hover:text-white hover:bg-white/5'
          }`}
        >
          <Globe size={14} />
          Cross-Chain
          <span className="text-[9px] font-bold uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded px-1 py-0.5 leading-none">
            Mainnet
          </span>
        </button>
      </div>

      {/* ── Solana tab ── */}
      {tab === 'solana' && (
        <div className="space-y-4">
          <p className="text-sm text-smoke-500 leading-relaxed">
            Transfer {formatUsdc(streak.stakeAmount)} USDC from your Solana wallet directly into the secure protocol escrow.
          </p>
          <button
            onClick={() => void handleSolanaJoin()}
            disabled={sending}
            className="group relative overflow-hidden w-full flex items-center justify-center gap-2 bg-grape-500 text-white hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 rounded-xl py-3.5 text-base font-bold transition-all shadow-[0_0_20px_rgba(94,84,142,0.5)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]" />
            {sending && <Loader2 size={16} className="animate-spin relative" />}
            <span className="relative">{sending ? 'Joining Protocol…' : 'Join Protocol'}</span>
          </button>
        </div>
      )}

      {/* ── Cross-chain tab ── */}
      {tab === 'cross-chain' && (
        <div className="space-y-4">
          {bridgeDone ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle size={40} className="text-green-400 drop-shadow-[0_0_12px_rgba(74,222,128,0.6)]" />
              <p className="text-base font-bold text-white">Bridge complete!</p>
              <p className="text-sm text-smoke-500">USDC is arriving in your Solana wallet…</p>
            </div>
          ) : (
            <>
              {/* Step 1 — Connect MetaMask */}
              <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                <p className="text-xs font-bold text-smoke-600 uppercase tracking-widest mb-3">
                  Step 1 — EVM Wallet
                </p>
                {evmAddress ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="font-mono text-sm text-white">{truncate(evmAddress)}</span>
                    <button
                      onClick={() => { setEvmAddress(null); setRoutes([]); setSelectedRoute(null); }}
                      className="ml-auto text-xs text-smoke-600 hover:text-red-400 transition-colors"
                    >
                      disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => void handleConnectMetaMask()}
                    className="w-full flex items-center justify-center gap-2 border border-grape-400/30 text-white hover:bg-grape-500/10 hover:border-grape-400/60 rounded-lg py-2.5 text-sm font-bold transition-all"
                  >
                    <Wallet size={15} />
                    Connect MetaMask
                  </button>
                )}
              </div>

              {/* Step 2 — Pick source chain */}
              <div className="bg-black/30 border border-white/5 rounded-xl p-4">
                <p className="text-xs font-bold text-smoke-600 uppercase tracking-widest mb-3">
                  Step 2 — Source Chain
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {EVM_CHAINS.map((chain) => (
                    <button
                      key={chain.id}
                      onClick={() => { setFromChain(chain.id); setRoutes([]); setSelectedRoute(null); }}
                      className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                        fromChain === chain.id
                          ? 'bg-grape-500 text-white border-grape-500 shadow-[0_0_10px_rgba(94,84,142,0.4)]'
                          : 'border-white/10 text-smoke-500 hover:border-grape-400/40 hover:text-white'
                      }`}
                    >
                      {chain.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 3 — Fetch routes */}
              <button
                onClick={() => void handleGetRoutes()}
                disabled={loadingRoutes || !evmAddress || !userAddress}
                className="w-full flex items-center justify-center gap-2 border border-grape-400/30 text-smoke-500 hover:bg-white/5 hover:text-white disabled:opacity-40 rounded-xl py-3 text-sm font-bold transition-all"
              >
                {loadingRoutes
                  ? <><Loader2 size={16} className="animate-spin" /> Finding best route…</>
                  : 'Get Bridge Route'
                }
              </button>

              {/* Step 4 — Route details + execute */}
              {selectedRoute && (
                <div className="bg-black/30 border border-grape-400/20 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-smoke-600 uppercase tracking-widest">
                    Best Route via LI.FI
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <p className="text-smoke-600 mb-0.5">You send</p>
                      <p className="font-mono font-bold text-white">
                        {formatUsdc(streak.stakeAmount)} USDC
                      </p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <p className="text-smoke-600 mb-0.5">Arrives on Solana</p>
                      <p className="font-mono font-bold text-green-400">
                        ~{formatUsdc(Number(selectedRoute.toAmountMin ?? streak.stakeAmount))} USDC
                      </p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <p className="text-smoke-600 mb-0.5">Est. time</p>
                      <p className="font-bold text-white">
                        {formatRouteTime(selectedRoute.steps[0]?.estimate?.executionDuration ?? 0)}
                      </p>
                    </div>
                    <div className="bg-black/20 rounded-lg p-2.5">
                      <p className="text-smoke-600 mb-0.5">Gas fees</p>
                      <p className="font-bold text-white">
                        {formatRouteFee(
                          selectedRoute.steps[0]?.estimate?.gasCosts?.[0]?.amountUSD ?? '0'
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => void handleBridgeAndJoin()}
                    disabled={executing}
                    className="group relative overflow-hidden w-full flex items-center justify-center gap-2 bg-grape-500 text-white hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 rounded-xl py-3.5 text-base font-bold transition-all mt-1 shadow-[0_0_20px_rgba(94,84,142,0.5)]"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]" />
                    {executing
                      ? <><Loader2 size={16} className="animate-spin relative" /><span className="relative">Bridging…</span></>
                      : <><ArrowRight size={16} className="relative" /><span className="relative">Bridge & Join Protocol</span></>
                    }
                  </button>

                  <p className="text-[10px] text-smoke-700 text-center">
                    Powered by LI.FI — best-rate cross-chain routing
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
