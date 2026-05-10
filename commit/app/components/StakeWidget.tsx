'use client';

import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { PublicKey } from '@solana/web3.js';
import { ArrowRight, Loader2, Globe, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { formatUsdc, LIFI_CHAIN_IDS } from '@/app/lib/constants';
import { findSolanaWallet, findEvmWallet } from '@/app/lib/privy-utils';
import { getStakeRoutes, executeStakeRoute, formatRouteTime, formatRouteFee } from '@/app/lib/lifi';
import { buildJoinStreakIxs } from '@/app/lib/solana';
import { useSolanaTransaction } from '@/app/lib/use-solana-tx';
import type { Route } from '@lifi/sdk';
import type { Streak } from '@/app/lib/types';

interface Props {
  streak: Streak;
  userAddress?: string;
  onJoined: () => void;
}

type Tab = 'solana' | 'cross-chain';

const EVM_CHAINS = [
  { id: LIFI_CHAIN_IDS.ethereum, label: 'Ethereum', symbol: 'ETH' },
  { id: LIFI_CHAIN_IDS.base, label: 'Base', symbol: 'ETH' },
  { id: LIFI_CHAIN_IDS.arbitrum, label: 'Arbitrum', symbol: 'ETH' },
  { id: LIFI_CHAIN_IDS.optimism, label: 'Optimism', symbol: 'ETH' },
  { id: LIFI_CHAIN_IDS.polygon, label: 'Polygon', symbol: 'MATIC' },
];

export function StakeWidget({ streak, userAddress, onJoined }: Props) {
  const [tab, setTab] = useState<Tab>('solana');
  const [fromChain, setFromChain] = useState(LIFI_CHAIN_IDS.base);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [executing, setExecuting] = useState(false);
  const { wallets } = useWallets();
  const { sendTransaction, sending } = useSolanaTransaction();

  async function handleGetRoutes() {
    if (!userAddress) {
      toast.error('Connect wallet first');
      return;
    }
    const evmWallet = findEvmWallet(wallets);
    if (!evmWallet) {
      toast.error('Connect an EVM wallet for cross-chain staking');
      return;
    }
    setLoadingRoutes(true);
    setSelectedRoute(null);
    setRoutes([]);
    try {
      const stakeUsdc = streak.stakeAmount / 1e6;
      // Add 0.5% slippage buffer
      const amountWithBuffer = Math.ceil(stakeUsdc * 1.005 * 1e6);
      const result = await getStakeRoutes({
        fromChainId: fromChain,
        fromTokenAddress: '0x0000000000000000000000000000000000000000',
        fromAmount: amountWithBuffer.toString(),
        fromAddress: evmWallet.address,
        toAddress: userAddress,
      });
      setRoutes(result);
      if (result.length > 0) setSelectedRoute(result[0]);
    } catch {
      toast.error('Could not fetch routes — please try again');
    } finally {
      setLoadingRoutes(false);
    }
  }

  async function handleBridgeAndJoin() {
    if (!selectedRoute) return;
    const evmWallet = findEvmWallet(wallets);
    if (!evmWallet) return;
    setExecuting(true);
    try {
      const provider = await evmWallet.getEthereumProvider();
      await executeStakeRoute(provider, selectedRoute, (updated) => {
        setSelectedRoute(updated);
      });
      toast.success('Bridge complete! Joining streak…');
      onJoined();
    } catch {
      toast.error('Bridge failed — please try again');
    } finally {
      setExecuting(false);
    }
  }

  async function handleSolanaJoin() {
    if (!userAddress) { toast.error('Connect your Solana wallet first'); return; }
    try {
      const ixs = await buildJoinStreakIxs(
        new PublicKey(userAddress),
        new PublicKey(streak.pubkey)
      );
      await sendTransaction(ixs, { onStatus: (msg) => toast.info(msg) });
      toast.success('Joined! Stake locked in escrow.');
      onJoined();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join streak');
    }
  }

  return (
    <div className="bg-black/20 border border-grape-400/20 rounded-2xl p-6 shadow-inner relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-grape-500/5 to-transparent pointer-events-none"></div>
      
      <h3 className="text-sm font-bold text-smoke-500 uppercase tracking-widest mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-orchid-400 animate-pulse"></span>
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
        </button>
      </div>

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
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
            {sending && <Loader2 size={16} className="animate-spin relative" />}
            <span className="relative">{sending ? 'Joining Protocol…' : 'Join Protocol'}</span>
          </button>
        </div>
      )}

      {tab === 'cross-chain' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-smoke-600 uppercase tracking-widest mb-2 block">
              Origin Chain
            </label>
            <select
              value={fromChain}
              onChange={(e) => setFromChain(Number(e.target.value))}
              className="w-full bg-black/30 border border-grape-400/30 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-orchid-500 focus:ring-1 focus:ring-orchid-500/50 transition-all [color-scheme:dark]"
            >
              {EVM_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.symbol})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => void handleGetRoutes()}
            disabled={loadingRoutes}
            className="w-full flex items-center justify-center gap-2 border border-grape-400/30 text-smoke-500 hover:bg-white/5 hover:text-white rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-50"
          >
            {loadingRoutes ? <Loader2 size={16} className="animate-spin" /> : null}
            Calculate Bridge Route
          </button>

          {routes.length > 0 && selectedRoute && (
            <div className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-smoke-600 uppercase tracking-widest">Routing via LI.FI</span>
                <span className="text-orchid-400">
                  {formatRouteTime(selectedRoute.steps[0]?.estimate?.executionDuration ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-smoke-600 uppercase tracking-widest">Estimated Fees</span>
                <span className="text-orchid-400">
                  ${formatRouteFee(selectedRoute.steps[0]?.estimate?.gasCosts?.[0]?.amountUSD ?? '0')}
                </span>
              </div>
              <button
                onClick={() => void handleBridgeAndJoin()}
                disabled={executing}
                className="group relative overflow-hidden w-full flex items-center justify-center gap-2 bg-grape-500 text-white hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100 rounded-xl py-3.5 text-base font-bold transition-all mt-2 shadow-[0_0_20px_rgba(94,84,142,0.5)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
                {executing ? (
                  <Loader2 size={16} className="animate-spin relative" />
                ) : (
                  <ArrowRight size={16} className="relative" />
                )}
                <span className="relative">{executing ? 'Bridging Assets…' : 'Bridge & Join Protocol'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
