'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';

// toSolanaWalletConnectors() reads from the browser wallet-standard registry at runtime,
// so Phantom (and any wallet-standard wallet) shows "Connect" instead of "Download".
const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: false });

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email', 'wallet', 'google'],
        appearance: {
          theme: 'dark',
          accentColor: '#5e548e',
          walletChainType: 'ethereum-and-solana',
          landingHeader: 'commit.',
          loginMessage: 'Stake it. Prove it. Let the chain decide.',
        },
        embeddedWallets: {
          solana: { createOnLogin: 'users-without-wallets' },
        },
        externalWallets: {
          // Disable WalletConnect — it requires a cloud project ID and crashes without one.
          walletConnect: { enabled: false },
          // Use wallet-standard discovery so installed wallets show "Connect" not "Download".
          solana: { connectors: solanaConnectors },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="bottom-right" richColors />
      </QueryClientProvider>
    </PrivyProvider>
  );
}
