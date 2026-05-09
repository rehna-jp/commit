// Privy wallet type utilities — handle Solana wallets from useWallets()
import type { ConnectedWallet } from '@privy-io/react-auth';

// useWallets() is typed as ConnectedWallet[] (Ethereum), but includes Solana at runtime.
// Use `(w as SolanaOrEvm).type` to discriminate without TypeScript errors.
export interface SolanaOrEvm extends Omit<ConnectedWallet, 'type'> {
  type: 'ethereum' | 'solana';
}

export function findSolanaWallet(wallets: ConnectedWallet[]): ConnectedWallet | undefined {
  return wallets.find((w) => (w as unknown as SolanaOrEvm).type === 'solana');
}

export function findEvmWallet(wallets: ConnectedWallet[]): ConnectedWallet | undefined {
  return wallets.find((w) => (w as unknown as SolanaOrEvm).type === 'ethereum');
}
