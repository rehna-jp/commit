'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { LogOut, Wallet } from 'lucide-react';
import { findSolanaWallet } from '@/app/lib/privy-utils';

function truncate(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function Navbar() {
  const { authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const solanaWallet = findSolanaWallet(wallets);
  const displayAddr = solanaWallet?.address
    ? truncate(solanaWallet.address)
    : user?.email?.address
      ? user.email.address.split('@')[0]
      : null;

  return (
    <nav className="border-b border-grape-300 bg-amethyst-500/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/">
          <Image src="/commit-logo.png" alt="commit" width={32} height={32} className="rounded" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          {authenticated ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:block text-sm text-smoke-500 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/streak/create"
                className="bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-3 sm:px-4 py-1.5 text-sm font-medium transition-colors"
              >
                <span className="hidden sm:inline">+ New Streak</span>
                <span className="sm:hidden">+ New</span>
              </Link>
              {displayAddr && (
                <span className="font-mono text-xs bg-grape-300 text-grape-900 px-2 sm:px-2.5 py-1 rounded-lg">
                  {displayAddr}
                </span>
              )}
              <button
                onClick={() => void logout()}
                className="text-smoke-500 hover:text-white transition-colors"
                aria-label="Disconnect"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => login()}
              className="flex items-center gap-1.5 bg-grape-500 text-white hover:bg-grape-600 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
            >
              <Wallet size={14} />
              Connect
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
