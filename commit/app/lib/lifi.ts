// LI.FI cross-chain route fetching and execution using SDK v3 API
import { createConfig, getRoutes, executeRoute, type RoutesRequest, type Route } from '@lifi/sdk';
import { LIFI_SOLANA_CHAIN_ID, USDC_MINT } from './constants'; // USDC_MINT is a {toBase58()} shim here

let configured = false;

function ensureConfig() {
  if (configured) return;
  createConfig({ integrator: process.env.NEXT_PUBLIC_LIFI_INTEGRATOR || 'commit' });
  configured = true;
}

export interface StakeRouteParams {
  fromChainId: number;
  fromTokenAddress: string;
  fromAmount: string;
  fromAddress: string;
  toAddress: string;
}

export async function getStakeRoutes(params: StakeRouteParams): Promise<Route[]> {
  ensureConfig();

  const request: RoutesRequest = {
    fromChainId: params.fromChainId,
    fromTokenAddress: params.fromTokenAddress,
    fromAmount: params.fromAmount,
    fromAddress: params.fromAddress,
    toChainId: LIFI_SOLANA_CHAIN_ID,
    toTokenAddress: USDC_MINT.toBase58(),
    toAddress: params.toAddress,
    options: {
      slippage: 0.005,
      allowSwitchChain: true,
    },
  };

  const result = await getRoutes(request);
  return result.routes;
}

export async function executeStakeRoute(
  signer: unknown,
  route: Route,
  onUpdate: (route: Route) => void
): Promise<Route> {
  ensureConfig();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options = { updateRouteHook: onUpdate, executionOptions: { signer } } as any;
  return executeRoute(route, options);
}

export function formatRouteTime(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `~${mins}m`;
}

export function formatRouteFee(gasCostUsd: string): string {
  const n = parseFloat(gasCostUsd);
  return `$${n.toFixed(2)} gas`;
}
