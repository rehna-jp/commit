// Program constants — string addresses to avoid SSR crashes from PublicKey at module level
// Import PublicKey inside functions only, never at module level.

// Known-good devnet USDC mint — replace via env once a different mint is needed
const DEVNET_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const SYSTEM_PROGRAM = '11111111111111111111111111111111';

function resolveEnv(key: string | undefined, fallback: string): string {
  if (!key || key.startsWith('<') || key.length < 32) return fallback;
  return key;
}

export const PROGRAM_ID_STR = resolveEnv(
  process.env.NEXT_PUBLIC_PROGRAM_ID,
  '3Gd8xHLKGjj8evBtwQUTnawSTwWdbeAxZmtVyxMPm29G'
);

export const USDC_MINT_STR = resolveEnv(
  process.env.NEXT_PUBLIC_USDC_MINT,
  DEVNET_USDC_MINT
);

export const VERIFIER_PUBKEY =
  process.env.NEXT_PUBLIC_VERIFIER_PUBLIC_KEY || '2rssPceyyYTERjZCjyNPXv3GCuw1fDjyBpxKecZ1MAQE';

export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.devnet.solana.com';

export const LIFI_SOLANA_CHAIN_ID = 1151111081099710;

export const USDC_DECIMALS = 6;

export const DISPUTE_WINDOW_SECONDS = process.env.NEXT_PUBLIC_DEVNET_MODE === 'true' ? 60 : 86_400;
export const DISPUTE_BOND_BPS = 1000;
export const DISPUTE_BOUNTY_BPS = 3000;
export const PHASH_HAMMING_THRESHOLD = 8;

export const DEVNET_MODE = process.env.NEXT_PUBLIC_DEVNET_MODE === 'true';

export const LIFI_CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  bnb: 56,
};

export function formatUsdc(baseUnits: number): string {
  return (baseUnits / 10 ** USDC_DECIMALS).toFixed(2);
}

export function toBaseUnits(usdc: number): number {
  return Math.round(usdc * 10 ** USDC_DECIMALS);
}

// Lazy getters — call inside functions/effects, never at module level
export function getProgramId() {
  const { PublicKey } = require('@solana/web3.js') as typeof import('@solana/web3.js');
  return new PublicKey(PROGRAM_ID_STR);
}

export function getUsdcMint() {
  const { PublicKey } = require('@solana/web3.js') as typeof import('@solana/web3.js');
  return new PublicKey(USDC_MINT_STR);
}

// Keep USDC_MINT as a string alias for LiFi / server-side uses
export const USDC_MINT = { toBase58: () => USDC_MINT_STR };
