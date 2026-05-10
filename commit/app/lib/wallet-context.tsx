'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { SOLANA_RPC } from './constants';

interface SolanaProvider {
  isPhantom?: boolean;
  publicKey: { toBytes(): Uint8Array; toString(): string } | null;
  isConnected: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  disconnect(): Promise<void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
  signAndSendTransaction(tx: Transaction, opts?: object): Promise<{ signature: string }>;
}

function getProvider(): SolanaProvider | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    phantom?: { solana?: SolanaProvider };
    solana?: SolanaProvider;
    solflare?: SolanaProvider;
  };
  // Prefer Phantom's namespaced provider, fall back to window.solana
  return w.phantom?.solana ?? w.solana ?? w.solflare ?? null;
}

interface WalletCtx {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (tx: Transaction, connection: Connection) => Promise<string>;
}

const WalletContext = createContext<WalletCtx>({
  connected: false,
  connecting: false,
  publicKey: null,
  address: null,
  connect: async () => {},
  disconnect: async () => {},
  sendTransaction: async () => { throw new Error('No wallet'); },
});

export function WalletContextProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open('https://phantom.app', '_blank');
      return;
    }
    setConnecting(true);
    try {
      const resp = await provider.connect();
      setPublicKey(new PublicKey(resp.publicKey.toString()));
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    await provider?.disconnect();
    setPublicKey(null);
  }, []);

  const sendTransaction = useCallback(async (tx: Transaction, connection: Connection) => {
    const provider = getProvider();
    if (!provider || !publicKey) throw new Error('Wallet not connected');

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = publicKey;

    const signed = await provider.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    return sig;
  }, [publicKey]);

  const address = publicKey?.toBase58() ?? null;

  return (
    <WalletContext.Provider value={{
      connected: !!publicKey,
      connecting,
      publicKey,
      address,
      connect,
      disconnect,
      sendTransaction,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}

export function useConnection() {
  return { connection: new Connection(SOLANA_RPC, 'confirmed') };
}
