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
    <nav className="relative z-50 mt-6 mx-auto max-w-6xl px-4">
      <div className="h-16 rounded-2xl border border-grape-400/20 bg-white/5 backdrop-blur-xl shadow-lg flex items-center justify-between px-6 transition-all hover:bg-white/10 hover:border-grape-400/30">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="relative">
             <div className="absolute inset-0 bg-grape-500 blur-lg opacity-40 group-hover:opacity-80 transition-opacity"></div>
             <Image src="/commit-logo.png" alt="commit" width={36} height={36} className="relative rounded-lg" />
          </div>
          <span className="font-bold text-lg text-white tracking-tight hidden sm:block">
            commit<span className="text-orchid-500 animate-pulse">.</span>
          </span>
        </Link>

        <div className="flex items-center gap-3 sm:gap-4">
          {authenticated ? (
            <>
              <Link
                href="/dashboard"
                className="hidden sm:block text-sm font-medium text-smoke-500 hover:text-white transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/streak/create"
                className="group relative overflow-hidden bg-grape-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(94,84,142,0.4)] hover:shadow-[0_0_20px_rgba(94,84,142,0.6)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
                <span className="relative hidden sm:inline">+ New Streak</span>
                <span className="relative sm:hidden">+ New</span>
              </Link>
              {displayAddr && (
                <span className="font-mono text-xs bg-[#13111c]/60 border border-grape-400/30 text-lilac-400 px-3 py-2 rounded-lg backdrop-blur-md">
                  <span className="inline-block size-1.5 rounded-full bg-green-400 mr-2 animate-pulse"></span>
                  {displayAddr}
                </span>
              )}
              <button
                onClick={() => void logout()}
                className="text-smoke-600 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-lg transition-all active:scale-95 border border-transparent hover:border-white/10"
                aria-label="Disconnect"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <button
              onClick={() => login()}
              className="group relative overflow-hidden flex items-center gap-2 bg-white/10 border border-grape-400/40 text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition-all hover:scale-105 active:scale-95 hover:bg-grape-500 shadow-lg hover:shadow-[0_0_20px_rgba(94,84,142,0.5)]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:animate-[shimmer_2s_infinite]"></div>
              <Wallet size={16} className="relative transition-transform group-hover:-rotate-12" />
              <span className="relative">Connect</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
