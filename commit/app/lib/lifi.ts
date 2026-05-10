// LI.FI cross-chain route fetching and execution — SDK v3 + viem + window.ethereum
import { createConfig, EVM, getRoutes, executeRoute, type RoutesRequest, type Route } from '@lifi/sdk';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { LIFI_SOLANA_CHAIN_ID, USDC_MINT_STR } from './constants';

// USDC contract addresses per EVM chain
export const EVM_USDC: Record<number, string> = {
  1:     '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum
  8453:  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum
  10:    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // Optimism
  137:   '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Polygon
  56:    '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // BNB Chain
};

export const EVM_CHAINS = [
  { id: 8453,  label: 'Base',     symbol: 'USDC' },
  { id: 42161, label: 'Arbitrum', symbol: 'USDC' },
  { id: 1,     label: 'Ethereum', symbol: 'USDC' },
  { id: 10,    label: 'Optimism', symbol: 'USDC' },
  { id: 137,   label: 'Polygon',  symbol: 'USDC' },
  { id: 56,    label: 'BNB Chain',symbol: 'USDC' },
];

function getEthereum() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (typeof window !== 'undefined' ? (window as any).ethereum : null) as any;
}

function buildWalletClient(): WalletClient {
  return createWalletClient({ transport: custom(getEthereum()) });
}

let _lifiConfigured = false;

export function configureLifi() {
  if (_lifiConfigured) return;
  _lifiConfigured = true;

  createConfig({
    integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR ?? 'commit',
    providers: [
      EVM({
        getWalletClient: async () => buildWalletClient(),
        switchChain: async (chainId) => {
          await getEthereum().request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: `0x${chainId.toString(16)}` }],
          });
          return buildWalletClient();
        },
      }),
    ],
  });
}

// ─── EVM wallet helpers ───────────────────────────────────────────────────────

export async function connectEvmWallet(): Promise<string> {
  const ethereum = getEthereum();
  if (!ethereum) throw new Error('MetaMask not found. Install it at metamask.io');
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' }) as string[];
  if (!accounts[0]) throw new Error('No account returned from MetaMask');
  return accounts[0];
}

export async function getEvmChainId(): Promise<number> {
  const ethereum = getEthereum();
  const hex = await ethereum.request({ method: 'eth_chainId' }) as string;
  return parseInt(hex, 16);
}

// ─── Route fetching ───────────────────────────────────────────────────────────

export interface StakeRouteParams {
  fromChainId: number;
  fromAddress: string;
  toAddress: string;
  stakeAmountUsdc: number; // in USDC base units (6 decimals)
}

export async function getStakeRoutes(params: StakeRouteParams): Promise<Route[]> {
  configureLifi();

  const fromToken = EVM_USDC[params.fromChainId];
  if (!fromToken) throw new Error(`No USDC address for chain ${params.fromChainId}`);

  const request: RoutesRequest = {
    fromChainId: params.fromChainId,
    fromTokenAddress: fromToken,
    fromAmount: params.stakeAmountUsdc.toString(),
    fromAddress: params.fromAddress,
    toChainId: LIFI_SOLANA_CHAIN_ID,
    toTokenAddress: USDC_MINT_STR,
    toAddress: params.toAddress,
    options: {
      slippage: 0.005,
      allowSwitchChain: true,
    },
  };

  const result = await getRoutes(request);
  return result.routes;
}

// ─── Route execution ──────────────────────────────────────────────────────────

export async function executeStakeRoute(
  route: Route,
  onUpdate: (route: Route) => void,
): Promise<Route> {
  configureLifi();
  return executeRoute(route, { updateRouteHook: onUpdate });
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatRouteTime(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  return `~${Math.round(seconds / 60)}m`;
}

export function formatRouteFee(gasCostUsd: string): string {
  return `$${parseFloat(gasCostUsd).toFixed(2)}`;
}
