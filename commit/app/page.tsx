"use client";

import { ThemeToggle } from "./components/theme-toggle";
import { ClusterSelect } from "./components/cluster-select";
import { WalletButton } from "./components/wallet-button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold tracking-tight">commit</span>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <ClusterSelect />
          <WalletButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-20">
        <h1 className="text-5xl font-black tracking-tight">commit</h1>
        <p className="mt-3 text-base text-muted">
          Stake USDC on daily habits. AI-verified check-ins. On-chain accountability.
        </p>
      </main>
    </div>
  );
}
