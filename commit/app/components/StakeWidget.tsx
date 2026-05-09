'use client';

import { useState } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { ArrowRight, Loader2, Globe, Coins } from 'lucide-react';
import { toast } from 'sonner';
import { formatUsdc, LIFI_CHAIN_IDS } from '@/app/lib/constants';
import { findSolanaWallet, findEvmWallet } from '@/app/lib/privy-utils';
import { getStakeRoutes, executeStakeRoute, formatRouteTime, formatRouteFee } from '@/app/lib/lifi';
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
    toast.info('Joining streak requires the deployed Anchor program — coming soon!');
    // TODO: Build and send join_streak tx with Privy Solana wallet
    // const solanaWallet = wallets.find(w => w.chainType === 'solana');
    // const tx = await buildJoinStreakTx(new PublicKey(userAddress!), new PublicKey(streak.pubkey));
    // ...
  }

  return (
    <div className="bg-white dark:bg-grape-200 border border-zinc-200 dark:border-grape-300 rounded-xl p-5">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-white mb-4">
        Stake{' '}
        <span className="font-mono text-grape-500">{formatUsdc(streak.stakeAmount)} USDC</span> to
        Join
      </h3>

      {/* Tab selector */}
      <div className="flex gap-1 mb-4 bg-zinc-100 dark:bg-grape-300 rounded-lg p-1">
        <button
          onClick={() => setTab('solana')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
            tab === 'solana'
              ? 'bg-white dark:bg-grape-400 text-zinc-900 dark:text-white shadow-sm'
              : 'text-zinc-500 dark:text-smoke-600'
          }`}
        >
          <Coins size={14} />
          USDC on Solana
        </button>
        <button
          onClick={() => setTab('cross-chain')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${
            tab === 'cross-chain'
              ? 'bg-white dark:bg-grape-400 text-zinc-900 dark:text-white shadow-sm'
              : 'text-zinc-500 dark:text-smoke-600'
          }`}
        >
          <Globe size={14} />
          Cross-Chain
        </button>
      </div>

      {tab === 'solana' && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500 dark:text-smoke-600">
            Transfer {formatUsdc(streak.stakeAmount)} USDC from your Solana wallet into the streak
            escrow.
          </p>
          <button
            onClick={() => void handleSolanaJoin()}
            className="w-full bg-grape-500 text-white hover:bg-grape-600 rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            Join Streak
          </button>
        </div>
      )}

      {tab === 'cross-chain' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-500 dark:text-smoke-600 mb-1 block">
              From Chain
            </label>
            <select
              value={fromChain}
              onChange={(e) => setFromChain(Number(e.target.value))}
              className="w-full bg-white dark:bg-grape-300 border border-zinc-200 dark:border-grape-400 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-grape-500"
            >
              {EVM_CHAINS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => void handleGetRoutes()}
            disabled={loadingRoutes}
            className="w-full flex items-center justify-center gap-2 border border-zinc-300 dark:border-grape-400 text-zinc-700 dark:text-smoke-700 hover:bg-zinc-50 dark:hover:bg-grape-300 rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loadingRoutes ? <Loader2 size={14} className="animate-spin" /> : null}
            Get Route
          </button>

          {routes.length > 0 && selectedRoute && (
            <div className="bg-zinc-50 dark:bg-grape-300 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-smoke-600">Via LI.FI</span>
                <span className="text-zinc-500 dark:text-smoke-600">
                  {formatRouteTime(selectedRoute.steps[0]?.estimate?.executionDuration ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500 dark:text-smoke-600">Fees</span>
                <span className="text-zinc-500 dark:text-smoke-600">
                  {formatRouteFee(selectedRoute.steps[0]?.estimate?.gasCosts?.[0]?.amountUSD ?? '0')}
                </span>
              </div>
              <button
                onClick={() => void handleBridgeAndJoin()}
                disabled={executing}
                className="w-full flex items-center justify-center gap-2 bg-grape-500 text-white hover:bg-grape-600 disabled:opacity-70 rounded-lg py-2.5 text-sm font-medium transition-colors"
              >
                {executing ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ArrowRight size={14} />
                )}
                {executing ? 'Bridging…' : 'Bridge & Join'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
